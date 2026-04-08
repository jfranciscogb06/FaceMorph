import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { detectWithFacePP } from '@/lib/facepp';
import { computeAllScores, computeOverallScore } from '@/lib/geometricScoring';

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

    console.log('[analyze] Face++ OK, head pose:', fpResult.headPose);

    // ── Step 2: Compute all scores mathematically ───────────────────────────
    const { scores, measurements } = computeAllScores(
      fpResult.landmarks,
      fpResult.skinStatus,
      fpResult.beautyScore,
      gender as 'male' | 'female',
    );

    const overallScore = computeOverallScore(scores);
    console.log('[analyze] computed scores:', scores, 'overall:', overallScore);

    // ── Step 3: Claude text-only analysis ───────────────────────────────────
    const ethnicityStr = ethnicity?.length > 0 ? ` of ${ethnicity.join('/')} background` : '';
    const prompt = buildTextPrompt(gender, ethnicityStr, scores, measurements, fpResult.faceShape, fpResult.headPose);

    const res = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: 'You are a direct, honest facial analyst. Write observations and advice based on the provided geometric measurements. Be specific and accurate. Output only valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    });

    const text = res.content[0]?.type === 'text' ? res.content[0].text : '';
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Non-JSON response from Claude');

    const cleaned = jsonMatch[0].replace(/[\u0000-\u001F\u007F]/g, (c) => {
      if (c === '\n') return '\\n';
      if (c === '\r') return '\\r';
      if (c === '\t') return '\\t';
      return '';
    });

    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      console.error('[analyze] JSON parse failed:', cleaned.slice(0, 300));
      throw new Error('Malformed JSON from Claude');
    }

    // ── Step 4: Assemble result ─────────────────────────────────────────────
    const result = {
      overallScore,
      scores,
      faceShape: fpResult.faceShape,
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

  return `You are a precise facial analyst. Below are the exact geometric measurements and PSL scores for a ${gender}${ethnicityStr}. Write specific observations based strictly on these numbers — do not guess or invent.

COMPUTED PSL SCORES (1-10 scale, PSL 4 = average population):
• Symmetry: ${scores.symmetry} — from landmark deviation analysis
• Golden Ratio: ${scores.goldenRatio} — IPD/face-width ratio: ${fmt(m.goldenRatioIPD)}
• Facial Thirds: ${scores.facialThirds} — max deviation from ideal 33/33/33%
• Jawline: ${scores.jawline} — gonial angle: ${fmt(m.gonialAngleDeg, '°')} | FWHR: ${fmt(m.fwhr)}
• Eyes: ${scores.eyes} — canthal tilt: ${fmt(m.canthalTiltDeg, '°')} | eye aspect ratio: ${fmt(m.eyeAspectRatio)}
• Nose: ${scores.nose} — nose width ratio: ${fmt(m.noseWidthRatio)} (ideal: 0.26)
• Lips: ${scores.lips} — fullness ratio: ${fmt(m.lipFullnessRatio)} | upper:lower ratio: ${fmt(m.lipUpperLowerRatio)} (ideal: 0.38)
• Skin: ${scores.skinClarity} — Face++ skin health/clarity analysis
• Face++ beauty score: ${fmt(m.beautyScore, '/100', 0)}

DETECTED FACE SHAPE: ${faceShape}
HEAD POSE: yaw ${headPose.yaw_angle.toFixed(1)}°, pitch ${headPose.pitch_angle.toFixed(1)}°, roll ${headPose.roll_angle.toFixed(1)}°

Canthal tilt reference: +3° to +5° = positive/hunter eyes (PSL attractive), 0° = neutral, negative = drooping
Gonial angle reference: 115-125° = sharp defined jaw, 128-135° = average, >140° = weak/undefined
FWHR reference: ~1.9 = ideal masculine, ~1.75 = ideal feminine
Nose ratio reference: 0.24-0.28 = ideal, >0.32 = wide

Based on these exact numbers, write observations and advice. Be specific — reference the actual measurements. Do not soften or inflate.

Output ONLY valid JSON:
{
  "styleCategory": "<Sharp|Balanced|Soft|Angular|Classic>",
  "strengths": ["<2-3 specific strengths backed by a high score above — name the metric>"],
  "improvements": ["<2-3 specific weaknesses backed by a low score — name the metric and what it means>"],
  "recommendations": [
    {
      "category": "<skincare|grooming|hairstyle|exercise|lifestyle>",
      "title": "<short title>",
      "description": "<1-2 sentences targeting the specific weak metric>",
      "priority": "<high|medium|low>"
    }
  ],
  "observations": {
    "jawline": "<describe what the gonial angle and FWHR numbers indicate about jaw structure>",
    "eyes": "<describe what the canthal tilt and aspect ratio indicate>",
    "nose": "<describe what the nose width ratio indicates>",
    "lips": "<describe what the fullness and upper/lower ratio indicate>",
    "symmetry": "<describe what the symmetry deviation indicates>",
    "skin": "<describe what the skin score indicates>"
  }
}`;
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
