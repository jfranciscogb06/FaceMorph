import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const maxDuration = 60;

const SCRIPT = path.join(process.cwd(), 'scripts/detect-face.js');

function runDetector(base64Image: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [SCRIPT]);

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });

    child.on('close', (code) => {
      if (stdout) {
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error(`Script output parse error: ${stdout.slice(0, 200)}`));
        }
      } else {
        reject(new Error(`Script failed (code ${code}): ${stderr.slice(0, 300)}`));
      }
    });

    child.on('error', reject);

    // Write base64 image data to stdin
    child.stdin.write(base64Image);
    child.stdin.end();
  });
}

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    const base64 = image.replace(/^data:image\/\w+;base64,/, '');

    const result = await runDetector(base64);

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
