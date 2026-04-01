import { NextRequest, NextResponse } from 'next/server';
import { detectFace } from '@/lib/detectFace';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    const base64 = image.replace(/^data:image\/\w+;base64,/, '');

    const result = await detectFace(base64);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json(result);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Landmark error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
