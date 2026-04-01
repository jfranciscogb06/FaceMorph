import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

export async function POST(req: NextRequest) {
  try {
    const { messages, analysisContext } = await req.json();

    const systemContent = analysisContext
      ? `You are a direct, no-nonsense looksmaxxing and grooming advisor. The user has this facial analysis:
- Overall score: ${analysisContext.overallScore}/10 (${analysisContext.styleCategory})
- Face shape: ${analysisContext.faceShape}
- Strengths: ${(analysisContext.strengths as string[]).join(', ')}
- Improvement areas: ${(analysisContext.improvements as string[]).join(', ')}
Give concise, specific, actionable advice based on their results. Be honest and direct. Keep responses under 4 sentences.`
      : `You are a direct looksmaxxing and grooming advisor. Give concise, specific, actionable advice about facial aesthetics, grooming, skincare, hairstyle, and lifestyle. Keep responses under 4 sentences.`;

    const response = await client.chat.completions.create({
      model: 'grok-4-1-fast',
      max_tokens: 350,
      messages: [
        { role: 'system', content: systemContent },
        ...messages,
      ],
    });

    return NextResponse.json({ message: response.choices[0]?.message?.content || '' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
