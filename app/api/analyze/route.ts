import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { computeObjectiveScores, computeOverallScore } from '@/lib/scoreFromLandmarks';

export const maxDuration = 60;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  console.log('[analyze] POST hit, API key present:', !!process.env.ANTHROPIC_API_KEY);
  try {
    const body = await req.json();
    const { image, gender, ethnicity, landmarks } = body;

    if (!image || !gender) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return NextResponse.json({ error: 'Invalid image format' }, { status: 400 });
    const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    const base64Data = match[2];

    console.log('[analyze] image bytes:', base64Data.length, 'mediaType:', mediaType);

    const { buildAnalysisPrompt } = await import('@/lib/analyzePrompt');
    const prompt = buildAnalysisPrompt(gender, ethnicity || [], landmarks || null);

    const callOnce = async () => {
      const res = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            { type: 'text', text: prompt },
          ],
        }],
      });
      const text = res.content[0]?.type === 'text' ? res.content[0].text : '';
      const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Non-JSON response: ' + text.slice(0, 300));
      const parsed = JSON.parse(jsonMatch[0]);
      delete parsed._obs;
      return parsed;
    };

    // Two parallel calls — take the average to reduce single-call variance
    const [r1, r2] = await Promise.all([callOnce(), callOnce()]);
    console.log('[analyze] scores r1:', r1.scores, '| r2:', r2.scores);

    const avg2 = (a: number | undefined, b: number | undefined, fallback: number) => {
      const va = a ?? fallback;
      const vb = b ?? fallback;
      return Math.round(((va + vb) / 2) * 10) / 10;
    };

    const aiResult = {
      ...r1,
      scores: {
        jawline:     avg2(r1.scores?.jawline,     r2.scores?.jawline,     5.0),
        eyes:        avg2(r1.scores?.eyes,        r2.scores?.eyes,        5.0),
        nose:        avg2(r1.scores?.nose,        r2.scores?.nose,        5.0),
        lips:        avg2(r1.scores?.lips,        r2.scores?.lips,        5.0),
        skinClarity: avg2(r1.scores?.skinClarity, r2.scores?.skinClarity, 5.0),
      },
    };

    const objScores = (landmarks && landmarks.length >= 8)
      ? computeObjectiveScores(landmarks)
      : { symmetry: 5.5, goldenRatio: 5.5, facialThirds: 5.5 };

    const mergedScores = {
      symmetry:     objScores.symmetry,
      goldenRatio:  objScores.goldenRatio,
      facialThirds: objScores.facialThirds,
      jawline:      aiResult.scores?.jawline      ?? 5.0,
      eyes:         aiResult.scores?.eyes         ?? 5.0,
      nose:         aiResult.scores?.nose         ?? 5.0,
      lips:         aiResult.scores?.lips         ?? 5.0,
      skinClarity:  aiResult.scores?.skinClarity  ?? 5.0,
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
