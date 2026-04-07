import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { computeObjectiveScores, computeOverallScore } from '@/lib/scoreFromLandmarks';

async function flipImageHorizontal(base64: string, mediaType: string): Promise<string | null> {
  try {
    const { createCanvas, loadImage } = require('canvas');
    const img = await loadImage(`data:${mediaType};base64,${base64}`);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.translate(img.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    return canvas.toBuffer('image/jpeg').toString('base64');
  } catch (e) {
    console.error('[analyze] flipImage failed:', e);
    return null;
  }
}

async function scoreSymmetryByImageComparison(
  client: OpenAI,
  base64: string,
  flippedBase64: string,
  mediaType: string,
): Promise<number> {
  const res = await client.chat.completions.create({
    model: 'grok-4-1-fast-non-reasoning',
    max_tokens: 50,
    temperature: 0.2,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'IMAGE 1 — original face:' },
        { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
        { type: 'text', text: 'IMAGE 2 — the exact same face, horizontally flipped (mirror image):' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${flippedBase64}` } },
        { type: 'text', text: 'You are looking at the same face and its mirror flip. How similar are the two sides? Score facial symmetry 1–10 (10 = left and right halves are nearly identical, 1 = very asymmetric). All human faces have some natural asymmetry — a score of 6–8 is normal, 8+ means notably symmetric, below 5 means clearly asymmetric. Reply with a single decimal number only, e.g. 7.4' },
      ],
    }],
  });
  const text = res.choices[0]?.message?.content?.trim() || '6.0';
  const n = parseFloat(text.match(/\d+(\.\d+)?/)?.[0] ?? '6.0');
  return Math.round(Math.max(1, Math.min(10, n)) * 10) / 10;
}

export const maxDuration = 60;

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

export async function POST(req: NextRequest) {
  console.log('[analyze] POST hit, API key present:', !!process.env.XAI_API_KEY);
  try {
    const body = await req.json();
    const { image, gender, ethnicity, landmarks } = body;

    if (!image || !gender) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Extract base64 data and media type from data URL
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return NextResponse.json({ error: 'Invalid image format' }, { status: 400 });
    const mediaType = match[1];
    const base64Data = match[2];

    console.log('[analyze] image bytes:', base64Data.length, 'mediaType:', mediaType);

    const { buildAnalysisPrompt } = await import('@/lib/analyzePrompt');
    const prompt = buildAnalysisPrompt(gender, ethnicity || [], landmarks || null);

    const callOnce = async () => {
      const res = await client.chat.completions.create({
        model: 'grok-4-1-fast-non-reasoning',
        max_tokens: 2000,
        temperature: 0.4,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64Data}` } },
            { type: 'text', text: prompt },
          ],
        }],
      });
      const text = res.choices[0]?.message?.content || '';
      const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Non-JSON response: ' + text.slice(0, 300));
      const parsed = JSON.parse(jsonMatch[0]);
      delete parsed._obs;
      return parsed;
    };

    // Flip image for symmetry comparison + three parallel AI calls
    const flippedBase64 = await flipImageHorizontal(base64Data, mediaType);

    const [r1, r2, r3, visualSymmetry] = await Promise.all([
      callOnce(),
      callOnce(),
      callOnce(),
      flippedBase64
        ? scoreSymmetryByImageComparison(client, base64Data, flippedBase64, mediaType)
        : Promise.resolve(null as number | null),
    ]);
    console.log('[analyze] scores r1:', r1.scores, '| r2:', r2.scores, '| r3:', r3.scores, '| visualSymmetry:', visualSymmetry);

    const median3 = (a: number | undefined, b: number | undefined, c: number | undefined, fallback: number) => {
      const vals = [a ?? fallback, b ?? fallback, c ?? fallback].sort((x, y) => x - y);
      return Math.round(vals[1] * 10) / 10;
    };

    const aiResult = {
      ...r1,
      scores: {
        jawline:     median3(r1.scores?.jawline,     r2.scores?.jawline,     r3.scores?.jawline,     6.0),
        eyes:        median3(r1.scores?.eyes,        r2.scores?.eyes,        r3.scores?.eyes,        6.0),
        nose:        median3(r1.scores?.nose,        r2.scores?.nose,        r3.scores?.nose,        6.0),
        lips:        median3(r1.scores?.lips,        r2.scores?.lips,        r3.scores?.lips,        6.0),
        skinClarity: median3(r1.scores?.skinClarity, r2.scores?.skinClarity, r3.scores?.skinClarity, 6.0),
      },
    };

    // Landmark-based scores for golden ratio & facial thirds; visual AI for symmetry
    const objScores = (landmarks && landmarks.length >= 8)
      ? computeObjectiveScores(landmarks)
      : { symmetry: 6.0, goldenRatio: 6.0, facialThirds: 6.0 };

    const mergedScores = {
      symmetry:     visualSymmetry ?? objScores.symmetry,
      goldenRatio:  objScores.goldenRatio,
      facialThirds: objScores.facialThirds,
      jawline:      aiResult.scores?.jawline      ?? 6.0,
      eyes:         aiResult.scores?.eyes         ?? 6.0,
      nose:         aiResult.scores?.nose         ?? 6.0,
      lips:         aiResult.scores?.lips         ?? 6.0,
      skinClarity:  aiResult.scores?.skinClarity  ?? 6.0,
    };

    const result = {
      ...aiResult,
      scores: mergedScores,
      overallScore: computeOverallScore(mergedScores),
    };

    return NextResponse.json(result);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[analyze] catch block error:', msg, error);
    return NextResponse.json({ error: msg || 'Analysis failed' }, { status: 500 });
  }
}
