'use client';
import { useRef, useState, useCallback, useEffect } from 'react';

const W = 390, H = 668; // cropped just below score grid
const FPS = 30;
const DURATION = 2800;
const TOTAL_FRAMES = Math.ceil((DURATION / 1000) * FPS);

const OVERALL_BASE = 9.1;
const FACE_SHAPE = 'Oval · Balanced';

const METRICS_BASE = [
  { label: 'Symmetry',     val: 9.1 },
  { label: 'PHI Ratio',    val: 9.2 },
  { label: 'Face Thirds',  val: 8.8 },
  { label: 'Gonial Angle', val: 9.0 },
  { label: 'Canthal Tilt', val: 8.9 },
  { label: 'Nose',         val: 9.1 },
  { label: 'Lips',         val: 9.0 },
  { label: 'Glass Skin',   val: 9.2 },
];


function lerp(a: number, b: number, t: number) { return Math.round(a + (b - a) * t); }

function gradientColor(s: number): string {
  const t = Math.max(0, Math.min(1, s / 10));
  const r = t < 0.5 ? lerp(220, 250, t * 2) : lerp(250, 34, (t - 0.5) * 2);
  const g = t < 0.5 ? lerp(60, 200, t * 2)  : lerp(200, 197, (t - 0.5) * 2);
  const b = t < 0.5 ? lerp(60, 40, t * 2)   : lerp(40, 94, (t - 0.5) * 2);
  return `rgb(${r},${g},${b})`;
}

function scoreColor(val: number) {
  if (val >= 8.0) return '#22c55e';
  if (val >= 6.0) return '#eab308';
  if (val >= 4.0) return '#f97316';
  return '#ef4444';
}

function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

type Metric = { label: string; val: number };

function generateOffsets(): number[] {
  // Shuffle metric indices and assign tiers:
  //   1 metric  → 7.0–7.5 (low dip)
  //   2 metrics → 8.0–8.4 (mid)
  //   rest      → ±0.2 around base (high)
  const indices = Array.from({ length: METRICS_BASE.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const lowIdx  = new Set([indices[0]]);
  const midIdx  = new Set([indices[1], indices[2]]);

  return Array.from({ length: METRICS_BASE.length + 1 }, (_, i) => {
    if (i === 0) return (8.3 + Math.random() * 1.1) - OVERALL_BASE; // overall 8.3–9.4
    const mi = i - 1;
    if (lowIdx.has(mi)) return (7.0 + Math.random() * 0.5) - METRICS_BASE[mi].val;
    if (midIdx.has(mi)) return (8.0 + Math.random() * 0.4) - METRICS_BASE[mi].val;
    return (Math.random() - 0.5) * 0.4;
  });
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  t: number,
  overall: number,
  metrics: Metric[],
) {
  const p = easeOut(Math.min(t, 1));
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#f9fafb';
  ctx.fillRect(0, 0, W, H);

  // ── Photo ──
  const photoH = 300;
  if (img) {
    ctx.save();
    roundRect(ctx, 0, 0, W, photoH, 0);
    ctx.clip();
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const scale = Math.max(W / iw, photoH / ih);
    const dw = iw * scale, dh = ih * scale;
    ctx.drawImage(img, (W - dw) / 2, (photoH - dh) / 2, dw, dh);
    ctx.restore();
  } else {
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, W, photoH);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '500 14px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Drop a photo to preview', W / 2, photoH / 2);
    ctx.textBaseline = 'alphabetic';
  }

  // ── Score card ──
  const cardY = photoH - 30;
  const cardH = 80;
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.07)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;
  roundRect(ctx, 16, cardY, W - 32, cardH, 20);
  ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  const ringCX = 16 + 40, ringCY = cardY + cardH / 2;
  const ringR = 28, ringW = 5;
  const currentScore = overall * p;
  const col = gradientColor(currentScore); // animates red → yellow → green

  ctx.beginPath();
  ctx.arc(ringCX, ringCY, ringR, -Math.PI / 2, Math.PI * 1.5);
  ctx.strokeStyle = '#f3f4f6';
  ctx.lineWidth = ringW;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(ringCX, ringCY, ringR, -Math.PI / 2, -Math.PI / 2 + (currentScore / 10) * Math.PI * 2);
  ctx.strokeStyle = col;
  ctx.lineWidth = ringW;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.fillStyle = col;
  ctx.font = `800 16px -apple-system,BlinkMacSystemFont,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(currentScore.toFixed(1), ringCX, ringCY);
  ctx.textBaseline = 'alphabetic';

  // Face shape only — no name
  const textX = ringCX + ringR + 16;
  ctx.fillStyle = '#9ca3af';
  ctx.font = `400 13px -apple-system,BlinkMacSystemFont,sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(FACE_SHAPE, textX, cardY + cardH / 2 + 6);

  // ── Score Breakdown ──
  const sectionY = cardY + cardH + 20;
  ctx.fillStyle = '#111';
  ctx.font = `700 17px -apple-system,BlinkMacSystemFont,sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('Score Breakdown', 20, sectionY + 18);

  const gridY = sectionY + 30;
  const cellW = (W - 20 - 8) / 2;
  const cellH = 54;
  const cellGap = 8;

  metrics.forEach((m, i) => {
    const col2 = i % 2;
    const row = Math.floor(i / 2);
    const cx2 = 10 + col2 * (cellW + cellGap);
    const cy2 = gridY + row * (cellH + cellGap);

    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.04)';
    ctx.shadowBlur = 8;
    roundRect(ctx, cx2, cy2, cellW, cellH, 14);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#6b7280';
    ctx.font = `500 11px -apple-system,BlinkMacSystemFont,sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(m.label.toUpperCase(), cx2 + 10, cy2 + 18);

    const barY2 = cy2 + 26;
    const barH2 = 4;
    const barW2 = cellW - 20 - 32;
    ctx.fillStyle = '#f3f4f6';
    roundRect(ctx, cx2 + 10, barY2, barW2, barH2, 2);
    ctx.fill();

    const fill2 = Math.max(Math.min(p * 1.4 - i * 0.04, 1), 0);
    const animVal = m.val * fill2;
    const cellCol = gradientColor(animVal);
    roundRect(ctx, cx2 + 10, barY2, barW2 * (m.val / 10) * fill2, barH2, 2);
    ctx.fillStyle = cellCol;
    ctx.fill();

    ctx.fillStyle = cellCol;
    ctx.font = `700 13px -apple-system,BlinkMacSystemFont,sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(animVal.toFixed(1), cx2 + cellW - 10, cy2 + 40);
  });

}

export default function PreviewPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const loopTimer = useRef<ReturnType<typeof setTimeout>>();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [hasImage, setHasImage] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);
  const blobRef = useRef<Blob | null>(null);

  // randomised offsets — index 0 = overall, 1-8 = metrics
  const offsetsRef = useRef<number[]>(generateOffsets());

  const applyOffsets = useCallback(() => {
    const offs = offsetsRef.current;
    const overall = parseFloat(Math.min(10, Math.max(0, OVERALL_BASE + offs[0])).toFixed(1));
    const metrics = METRICS_BASE.map((m, i) => ({
      ...m,
      val: parseFloat(Math.min(10, Math.max(0, m.val + offs[i + 1])).toFixed(1)),
    }));
    return { overall, metrics };
  }, []);

  const startPreviewLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    cancelAnimationFrame(animRef.current);
    clearTimeout(loopTimer.current);
    const { overall, metrics } = applyOffsets();
    let start: number | null = null;
    const loop = (now: number) => {
      if (!start) start = now;
      const t = (now - start) / DURATION;
      drawFrame(ctx, imgRef.current, t, overall, metrics);
      if (t < 1.2) {
        animRef.current = requestAnimationFrame(loop);
      } else {
        drawFrame(ctx, imgRef.current, 1, overall, metrics);
        loopTimer.current = setTimeout(startPreviewLoop, 1000);
      }
    };
    animRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    startPreviewLoop();
    return () => { cancelAnimationFrame(animRef.current); clearTimeout(loopTimer.current); };
  }, [startPreviewLoop]);

  const loadImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => { imgRef.current = img; setHasImage(true); setDone(false); startPreviewLoop(); };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  };

  const exportVideo = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || exporting) return;

    // Regenerate random offsets for this export
    offsetsRef.current = generateOffsets();
    const { overall, metrics } = applyOffsets();

    setExporting(true);
    setDone(false);
    cancelAnimationFrame(animRef.current);
    clearTimeout(loopTimer.current);

    const ctx = canvas.getContext('2d')!;
    const frames: ImageData[] = [];
    for (let i = 0; i <= TOTAL_FRAMES; i++) {
      drawFrame(ctx, imgRef.current, i / TOTAL_FRAMES, overall, metrics);
      frames.push(ctx.getImageData(0, 0, W, H));
    }

    const mimeType = MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

    const stream = canvas.captureStream(FPS);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 10_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      blobRef.current = new Blob(chunks, { type: mimeType });
      setExporting(false);
      setDone(true);
      startPreviewLoop();
    };

    recorder.start();
    let fi = 0;
    const tick = setInterval(() => {
      if (fi < frames.length) { ctx.putImageData(frames[fi++], 0, 0); }
      else { clearInterval(tick); setTimeout(() => recorder.stop(), 200); }
    }, 1000 / FPS);
  }, [exporting, startPreviewLoop]);

  const download = () => {
    if (!blobRef.current) return;
    const ext = blobRef.current.type.includes('mp4') ? 'mp4' : 'webm';
    const url = URL.createObjectURL(blobRef.current);
    const a = document.createElement('a');
    a.href = url; a.download = `mogify-score.${ext}`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>
      <div style={{ borderBottom: '1px solid #f0f0f0', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#111' }}>Mogify</span>
        <span style={{ fontSize: 13, color: '#9ca3af' }}>Preview Export</span>
      </div>

      <div style={{ display: 'flex', gap: 48, padding: '40px 48px', maxWidth: 860, margin: '0 auto', alignItems: 'flex-start' }}>
        {/* Controls */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#111' }}>Photo</p>
            <div
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) loadImage(f); }}
              onDragOver={e => e.preventDefault()}
              onClick={() => document.getElementById('fi')?.click()}
              style={{ border: '1.5px dashed #e5e7eb', borderRadius: 14, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', backgroundColor: '#fafafa' }}
            >
              <p style={{ margin: 0, fontSize: 14, color: hasImage ? '#111' : '#9ca3af', fontWeight: hasImage ? 600 : 400 }}>
                {hasImage ? '✓ Image loaded — drop to replace' : 'Drop face photo here'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#d1d5db' }}>or click to browse</p>
            </div>
            <input id="fi" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) loadImage(f); }} />
          </div>

          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 24 }}>
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#111' }}>Export</p>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9ca3af' }}>Pre-renders all frames then packages as MP4/WebM (~3s, 30fps). Scores randomise ±0.2 each export.</p>
            <button onClick={exportVideo} disabled={exporting} style={{ width: '100%', backgroundColor: exporting ? '#f3f4f6' : '#111', color: exporting ? '#9ca3af' : '#fff', border: 'none', borderRadius: 14, padding: '15px 0', fontWeight: 700, fontSize: 15, cursor: exporting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {exporting ? 'Exporting…' : 'Export video'}
            </button>
            {done && (
              <button onClick={download} style={{ width: '100%', marginTop: 10, backgroundColor: '#fff', color: '#111', border: '1.5px solid #111', borderRadius: 14, padding: '15px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
                ↓ Download
              </button>
            )}
          </div>
        </div>

        {/* Canvas preview */}
        <div style={{ flexShrink: 0 }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#111' }}>Preview</p>
          <canvas ref={canvasRef} width={W} height={H} style={{ width: W / 2, height: H / 2, borderRadius: 24, border: '1px solid #f0f0f0', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', display: 'block' }} />
        </div>
      </div>
    </div>
  );
}
