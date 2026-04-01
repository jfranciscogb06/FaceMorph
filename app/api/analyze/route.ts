import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { computeObjectiveScores, computeOverallScore } from '@/lib/scoreFromLandmarks';

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
        temperature: 0,
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

    // Three parallel calls — take median score per metric to eliminate outliers
    const [r1, r2, r3] = await Promise.all([callOnce(), callOnce(), callOnce()]);
    console.log('[analyze] scores r1:', r1.scores, '| r2:', r2.scores, '| r3:', r3.scores);

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

    // Merge deterministic landmark scores with AI visual scores
    const objScores = (landmarks && landmarks.length >= 8)
      ? computeObjectiveScores(landmarks)
      : { symmetry: 6.0, goldenRatio: 6.0, facialThirds: 6.0 };

    const mergedScores = {
      symmetry:     objScores.symmetry,
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
