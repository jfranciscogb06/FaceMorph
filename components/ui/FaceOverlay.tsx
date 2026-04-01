'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  photoDataUrl: string;
}

export default function FaceOverlay({ photoDataUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!photoDataUrl || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = photoDataUrl;
    img.onload = async () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      try {
        const faceapi = await import('face-api.js');
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');

        const detections = await faceapi
          .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks();

        if (detections.length === 0) { setLoaded(true); return; }

        const det = detections[0];
        const lm = det.landmarks;
        const pts = lm.positions;

        // Helper to get landmark position
        const p = (i: number) => pts[i];

        ctx.save();

        // --- Symmetry axis (vertical center line) ---
        const noseTop = p(27);
        const noseTip = p(30);
        const chinTip = p(8);
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = 'rgba(240, 176, 64, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // Extended line from forehead to chin
        const centerX = (noseTop.x + noseTip.x + chinTip.x) / 3;
        ctx.moveTo(centerX, p(19).y - 30);
        ctx.lineTo(centerX, chinTip.y + 10);
        ctx.stroke();

        // --- Facial thirds horizontal lines ---
        ctx.strokeStyle = 'rgba(240, 176, 64, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        const faceLeft = Math.min(...pts.map(pt => pt.x)) - 5;
        const faceRight = Math.max(...pts.map(pt => pt.x)) + 5;
        // Top third (hairline approx = above brows)
        const browY = (p(19).y + p(24).y) / 2;
        ctx.beginPath(); ctx.moveTo(faceLeft, browY); ctx.lineTo(faceRight, browY); ctx.stroke();
        // Middle third (base of nose)
        const noseBaseY = p(33).y;
        ctx.beginPath(); ctx.moveTo(faceLeft, noseBaseY); ctx.lineTo(faceRight, noseBaseY); ctx.stroke();

        // --- Eye line ---
        ctx.strokeStyle = 'rgba(99, 179, 237, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        const leftEyeCenter = { x: (p(36).x + p(39).x) / 2, y: (p(36).y + p(39).y) / 2 };
        const rightEyeCenter = { x: (p(42).x + p(45).x) / 2, y: (p(42).y + p(45).y) / 2 };
        ctx.beginPath();
        ctx.moveTo(faceLeft, (leftEyeCenter.y + rightEyeCenter.y) / 2);
        ctx.lineTo(faceRight, (leftEyeCenter.y + rightEyeCenter.y) / 2);
        ctx.stroke();

        // --- Jawline trace ---
        ctx.strokeStyle = 'rgba(240, 176, 64, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        for (let i = 0; i <= 16; i++) {
          if (i === 0) ctx.moveTo(p(i).x, p(i).y);
          else ctx.lineTo(p(i).x, p(i).y);
        }
        ctx.stroke();

        // --- Eye outlines ---
        ctx.strokeStyle = 'rgba(99, 179, 237, 0.7)';
        ctx.lineWidth = 1.5;
        [[36,37,38,39,40,41],[42,43,44,45,46,47]].forEach(eye => {
          ctx.beginPath();
          ctx.moveTo(p(eye[0]).x, p(eye[0]).y);
          eye.forEach((i) => ctx.lineTo(p(i).x, p(i).y));
          ctx.closePath();
          ctx.stroke();
        });

        // --- Lip outline ---
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p(48).x, p(48).y);
        for (let i = 48; i <= 59; i++) ctx.lineTo(p(i).x, p(i).y);
        ctx.closePath();
        ctx.stroke();

        // --- Nose outline ---
        ctx.strokeStyle = 'rgba(167, 243, 208, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 27; i <= 35; i++) {
          if (i === 27) ctx.moveTo(p(i).x, p(i).y);
          else ctx.lineTo(p(i).x, p(i).y);
        }
        ctx.stroke();

        // --- Landmark dots (key points only) ---
        ctx.fillStyle = 'rgba(240, 176, 64, 0.9)';
        [0, 8, 16, 27, 30, 33, 36, 39, 42, 45, 48, 54].forEach(i => {
          ctx.beginPath();
          ctx.arc(p(i).x, p(i).y, 3, 0, 2 * Math.PI);
          ctx.fill();
        });

        ctx.restore();
      } catch (e) {
        console.warn('Overlay failed:', e);
      }
      setLoaded(true);
    };
  }, [photoDataUrl]);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-[#141414]">
      <canvas ref={canvasRef} className="w-full h-auto" style={{ maxHeight: '400px', objectFit: 'cover' }} />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#141414]">
          <div className="w-8 h-8 border-2 border-[#f0b040] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
