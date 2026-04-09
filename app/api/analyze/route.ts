import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { createCanvas, loadImage } from 'canvas';
import { detectWithFacePP } from '@/lib/facepp';
import { computeAllScores, computeOverallScore, deriveFaceShape } from '@/lib/geometricScoring';

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Tool definition — forces Claude to return structured, always-valid JSON
const ANALYSIS_TOOL: Anthropic.Tool = {
  name: 'submit_analysis',
  description: 'Submit the facial analysis result based on the computed geometric measurements.',
  input_schema: {
    type: 'object' as const,
    required: ['styleCategory', 'strengths', 'improvements', 'recommendations', 'observations'],
    properties: {
      styleCategory: { type: 'string', enum: ['Sharp', 'Balanced', 'Soft', 'Angular', 'Classic'] },
      strengths: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
      improvements: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
      recommendations: {
        type: 'array', maxItems: 3,
        items: {
          type: 'object',
          required: ['category', 'title', 'description', 'priority'],
          properties: {
            category: { type: 'string', enum: ['skincare', 'grooming', 'hairstyle', 'exercise', 'lifestyle'] },
            title: { type: 'string' },
            description: { type: 'string' },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
        },
      },
      observations: {
        type: 'object',
        required: ['jawline', 'eyes', 'nose', 'lips', 'symmetry', 'skin'],
        properties: {
          jawline:  { type: 'string' },
          eyes:     { type: 'string' },
          nose:     { type: 'string' },
          lips:     { type: 'string' },
          symmetry: { type: 'string' },
          skin:     { type: 'string' },
        },
      },
    },
  },
};

export async function POST(req: NextRequest) {
  console.log('[analyze] POST hit');
  try {
    const body = await req.json();
    const { image, gender, ethnicity } = body;

    if (!image || !gender) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return NextResponse.json({ error: 'Invalid image format' }, { status: 400 });
    const base64Data = match[2];

    // ── Step 1: Face++ landmark detection + attributes ──────────────────────
    console.log('[analyze] calling Face++');
    const fpResult = await detectWithFacePP(base64Data, gender as 'male' | 'female');

    if ('code' in fpResult) {
      // Quality error or no face detected
      return NextResponse.json({ error: fpResult.message }, { status: 422 });
    }

    const landmarkKeys = Object.keys(fpResult.landmarks);
    console.log('[analyze] Face++ landmarks count:', landmarkKeys.length, '| beauty:', fpResult.beautyScore, '| skin:', fpResult.skinStatus);
    console.log('[analyze] landmark keys:', landmarkKeys.join(', '));

    // ── Step 2: Compute all scores mathematically ───────────────────────────
    const { scores, measurements } = computeAllScores(
      fpResult.landmarks,
      fpResult.skinStatus,
      fpResult.beautyScore,
      gender as 'male' | 'female',
    );

    const overallScore = computeOverallScore(scores, fpResult.beautyScore);
    const faceShape = deriveFaceShape(fpResult.landmarks);
    const nullMetrics = Object.entries(measurements).filter(([, v]) => v === null).map(([k]) => k);
    console.log('[analyze] computed scores:', scores, 'overall:', overallScore, 'shape:', faceShape);
    console.log('[analyze] measurements:', measurements);
    if (nullMetrics.length) console.log('[analyze] NULL metrics (fell to default):', nullMetrics);

    // ── Step 3: Flip image for visual symmetry comparison ───────────────────
    let flippedBase64: string | null = null;
    try {
      const img = await loadImage(`data:image/jpeg;base64,${base64Data}`);
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      ctx.translate(img.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      flippedBase64 = canvas.toDataURL('image/jpeg').split(',')[1];
    } catch (e) {
      console.log('[analyze] image flip failed:', (e as Error).message);
    }

    // ── Step 4: Claude analysis (vision: original + flipped for symmetry) ───
    const ethnicityStr = ethnicity?.length > 0 ? ` of ${ethnicity.join('/')} background` : '';
    const prompt = buildTextPrompt(gender, ethnicityStr, scores, measurements, faceShape, fpResult.headPose);

    const userContent: Anthropic.MessageParam['content'] = flippedBase64
      ? [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Data } },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: flippedBase64 } },
          { type: 'text', text: prompt + '\n\nThe first image is the original face. The second image is the same face mirrored horizontally. Compare them to assess actual visual symmetry — note any visible differences in feature position, size, or shape between the two.' },
        ]
      : prompt;

    // Use tool_use to force structured output — guarantees valid JSON always
    const res = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: 'You are a direct, honest facial analyst. Write specific observations based on the provided geometric measurements and visual comparison.',
      tools: [ANALYSIS_TOOL],
      tool_choice: { type: 'tool', name: 'submit_analysis' },
      messages: [{ role: 'user', content: userContent }],
    });

    const toolUse = res.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined;
    if (!toolUse) throw new Error('Claude did not call the analysis tool');

    const analysis = toolUse.input as Record<string, unknown>;

    // ── Step 4: Assemble result ─────────────────────────────────────────────
    const result = {
      overallScore,
      scores,
      faceShape,
      styleCategory: analysis.styleCategory ?? 'Balanced',
      strengths: analysis.strengths ?? [],
      improvements: analysis.improvements ?? [],
      recommendations: analysis.recommendations ?? [],
      detailedAnalysis: buildDetailedAnalysis(scores, measurements, analysis),
    };

    return NextResponse.json(result);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[analyze] error:', msg);
    return NextResponse.json({ error: msg || 'Analysis failed' }, { status: 500 });
  }
}

// ─── Text prompt for Claude (no vision — pure text) ──────────────────────────

function buildTextPrompt(
  gender: string,
  ethnicityStr: string,
  scores: Record<string, number>,
  m: Record<string, number | null>,
  faceShape: string,
  headPose: { pitch_angle: number; roll_angle: number; yaw_angle: number },
): string {
  const fmt = (v: number | null, unit = '', decimals = 1) =>
    v !== null ? `${v.toFixed(decimals)}${unit}` : 'unavailable';

  return `Facial analysis for a ${gender}${ethnicityStr}. PSL scale: 4 = average population, 5 = above average, 6 = attractive, 7+ = very attractive.

COMPUTED PSL SCORES:
- Symmetry: ${scores.symmetry} (deviation: ${fmt(m.symmetryDeviation, '', 3)})
- Golden Ratio: ${scores.goldenRatio} (IPD/face-width: ${fmt(m.goldenRatioIPD)})
- Facial Thirds: ${scores.facialThirds} (lower/mid ratio deviation: ${fmt(m.facialThirdsMaxDev)}; 0 = perfect balance)
- Jawline: ${scores.jawline} (gonial angle: ${fmt(m.gonialAngleDeg, 'deg')} | FWHR: ${fmt(m.fwhr)} | projection: ${fmt(m.jawProjection, '', 3)})
- Eyes: ${scores.eyes} (canthal tilt: ${fmt(m.canthalTiltDeg, 'deg')} | aspect ratio: ${fmt(m.eyeAspectRatio)})
- Nose: ${scores.nose} (width ratio: ${fmt(m.noseWidthRatio)}, narrower = more refined; ~0.10 refined, ~0.15 average, >0.20 broad)
- Lips: ${scores.lips} (fullness: ${fmt(m.lipFullnessRatio)} | upper/lower: ${fmt(m.lipUpperLowerRatio)}, ideal 0.38)
- Skin: ${scores.skinClarity} (Face++ health analysis)
Face shape: ${faceShape} | Beauty score: ${fmt(m.beautyScore, '/100', 0)}

References: canthal tilt +3 to +5deg = hunter eyes; gonial angle 115-125deg = sharp jaw, 135+ = weak; FWHR 1.9 = ideal male, 1.75 = ideal female; jaw projection 0.15+ = defined/visible, 0.05 = recessed; nose ratio 0.24-0.28 = ideal.

Write honest, specific observations referencing the actual numbers. Call out weaknesses directly.`;
}

// ─── Build detailedAnalysis array from scores + observations ─────────────────

function buildDetailedAnalysis(
  scores: Record<string, number>,
  measurements: Record<string, number | null>,
  analysis: Record<string, unknown>,
): Array<{ feature: string; score: number; observation: string; tip: string }> {
  const obs = (analysis.observations as Record<string, string>) ?? {};
  const recs = (analysis.recommendations as Array<{ category: string; title: string; description: string }>) ?? [];

  const tipFor = (feature: string): string => {
    const rec = recs.find(r =>
      feature.toLowerCase().includes(r.category?.toLowerCase()) ||
      r.title?.toLowerCase().includes(feature.toLowerCase())
    );
    return rec?.description ?? `Focus on enhancing your ${feature.toLowerCase()} through targeted grooming.`;
  };

  return [
    { feature: 'Eyes',      score: scores.eyes,         observation: obs.eyes      ?? `Canthal tilt: ${measurements.canthalTiltDeg?.toFixed(1) ?? 'N/A'}°`,     tip: tipFor('eyes') },
    { feature: 'Jawline',   score: scores.jawline,      observation: obs.jawline   ?? `Gonial angle: ${measurements.gonialAngleDeg?.toFixed(1) ?? 'N/A'}°`,     tip: tipFor('jawline') },
    { feature: 'Nose',      score: scores.nose,         observation: obs.nose      ?? `Width ratio: ${measurements.noseWidthRatio?.toFixed(3) ?? 'N/A'}`,       tip: tipFor('nose') },
    { feature: 'Lips',      score: scores.lips,         observation: obs.lips      ?? `Fullness ratio: ${measurements.lipFullnessRatio?.toFixed(3) ?? 'N/A'}`,  tip: tipFor('lips') },
    { feature: 'Symmetry',  score: scores.symmetry,     observation: obs.symmetry  ?? `Deviation: ${measurements.symmetryDeviation?.toFixed(3) ?? 'N/A'}`,      tip: 'Consistent lighting and posture reduce the appearance of facial asymmetry.' },
    { feature: 'Skin',      score: scores.skinClarity,  observation: obs.skin      ?? 'Based on Face++ skin clarity analysis.',                                  tip: tipFor('skincare') },
  ];
}
