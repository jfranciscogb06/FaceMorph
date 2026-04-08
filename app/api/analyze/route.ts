import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { computeObjectiveScores, computeOverallScore } from '@/lib/scoreFromLandmarks';

export const maxDuration = 60;

interface CalibrationExample {
  label: string;
  gender: string;
  ethnicity: string;
  overallScore: number;
  scores: { jawline: number; eyes: number; nose: number; lips: number; skinClarity: number };
  imageBase64: string;
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function buildCalibrationContent(examples: CalibrationExample[]): Anthropic.MessageParam['content'] {
  if (!examples || examples.length === 0) return [];

  const parts: Anthropic.ContentBlockParam[] = [
    {
      type: 'text',
      text: `REFERENCE EXAMPLES — use these as your scoring baseline. Study each face and its known scores carefully before analyzing the target face:\n`,
    },
  ];

  for (const ex of examples) {
    parts.push({
      type: 'text',
      text: `Reference face: "${ex.label}" (${ex.gender}, ${ex.ethnicity})\nGround truth scores → Overall: ${ex.overallScore} | Jawline: ${ex.scores.jawline} | Eyes: ${ex.scores.eyes} | Nose: ${ex.scores.nose} | Lips: ${ex.scores.lips} | Skin: ${ex.scores.skinClarity}`,
    });
    parts.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: ex.imageBase64 },
    });
  }

  parts.push({
    type: 'text',
    text: `\nNow analyze the TARGET face below. Score it relative to the reference examples above — if it looks better than a reference scored 6.0, score it higher; if worse, score it lower. Be precise and consistent.\n\nTARGET FACE:`,
  });

  return parts;
}

export async function POST(req: NextRequest) {
  console.log('[analyze] POST hit, API key present:', !!process.env.ANTHROPIC_API_KEY);
  try {
    const body = await req.json();
    const { image, gender, ethnicity, landmarks, calibrationExamples } = body;

    if (!image || !gender) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return NextResponse.json({ error: 'Invalid image format' }, { status: 400 });
    const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    const base64Data = match[2];

    console.log('[analyze] image bytes:', base64Data.length, 'calibration examples:', calibrationExamples?.length ?? 0);

    // Compute objective scores first so they can be passed into the prompt
    const objScores = (landmarks && landmarks.length >= 8)
      ? computeObjectiveScores(landmarks)
      : undefined;

    const { buildAnalysisPrompt } = await import('@/lib/analyzePrompt');
    const prompt = buildAnalysisPrompt(gender, ethnicity || [], landmarks || null, objScores);

    const calContent = buildCalibrationContent(calibrationExamples || []);

    const callOnce = async () => {
      const userContent: Anthropic.ContentBlockParam[] = [
        ...calContent,
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64Data },
        },
        { type: 'text', text: prompt },
      ];

      const res = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 5000,
        system: 'You are a brutally honest PSL facial analyst. You never inflate scores. PSL 4 is average — where most people land. PSL 5 is above average and already a compliment. PSL 6+ is genuinely attractive. You score objectively based on bone structure, symmetry, and feature quality. You do not soften scores out of politeness. An unremarkable face is a 4, not a 5. A soft jaw is a 3.5–4, not a 5. You always output valid JSON with no truncation.',
        messages: [{ role: 'user', content: userContent }],
      });
      const text = res.content[0]?.type === 'text' ? res.content[0].text : '';
      const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Non-JSON response: ' + text.slice(0, 300));

      // Fix unescaped control characters inside JSON string values
      let cleaned = jsonMatch[0]
        .replace(/[\u0000-\u001F\u007F]/g, (c) => {
          if (c === '\n') return '\\n';
          if (c === '\r') return '\\r';
          if (c === '\t') return '\\t';
          return '';
        });

      // If JSON is truncated (no closing brace), attempt to close it
      if (res.stop_reason === 'max_tokens') {
        console.warn('[analyze] response hit max_tokens, attempting JSON repair');
        // Close any open arrays and objects greedily
        let opens = 0;
        for (const ch of cleaned) { if (ch === '{') opens++; else if (ch === '}') opens--; }
        cleaned = cleaned.replace(/,\s*$/, '') + '}'.repeat(Math.max(0, opens));
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error('[analyze] JSON parse failed, raw:', cleaned.slice(0, 500));
        throw new Error('Malformed JSON from model');
      }
      delete parsed._obs;
      return parsed;
    };

    const [r1, r2] = await Promise.all([callOnce(), callOnce()]);
    console.log('[analyze] scores r1:', r1.scores, '| r2:', r2.scores);

    const avg2 = (a: number | undefined, b: number | undefined, fallback: number) => {
      const va = a ?? fallback;
      const vb = b ?? fallback;
      return Math.round(((va + vb) / 2) * 10) / 10;
    };

    // Fallback obj scores for when no landmarks were provided
    const fallbackObj = { symmetry: 4.5, goldenRatio: 4.5, facialThirds: 4.5 };
    const resolvedObj = objScores ?? fallbackObj;

    const mergedScores = {
      // Objective scores: use Claude's output (which was given the exact values) or fall back to computed
      symmetry:     avg2(r1.scores?.symmetry,     r2.scores?.symmetry,     resolvedObj.symmetry),
      goldenRatio:  avg2(r1.scores?.goldenRatio,  r2.scores?.goldenRatio,  resolvedObj.goldenRatio),
      facialThirds: avg2(r1.scores?.facialThirds, r2.scores?.facialThirds, resolvedObj.facialThirds),
      // Visual scores: averaged across two Claude calls
      jawline:      avg2(r1.scores?.jawline,      r2.scores?.jawline,      4.0),
      eyes:         avg2(r1.scores?.eyes,         r2.scores?.eyes,          4.0),
      nose:         avg2(r1.scores?.nose,         r2.scores?.nose,          4.0),
      lips:         avg2(r1.scores?.lips,         r2.scores?.lips,          4.0),
      skinClarity:  avg2(r1.scores?.skinClarity,  r2.scores?.skinClarity,   4.0),
    };

    // Override objective scores with the hard-computed values if landmarks exist — they are exact math
    if (objScores) {
      mergedScores.symmetry     = objScores.symmetry;
      mergedScores.goldenRatio  = objScores.goldenRatio;
      mergedScores.facialThirds = objScores.facialThirds;
    }

    const result = {
      ...r1,
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
