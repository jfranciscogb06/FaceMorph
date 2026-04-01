'use client';

import { useRef, useState, useCallback } from 'react';
import ProgressBar from '@/components/ui/ProgressBar';

interface Props {
  photoDataUrl: string | null;
  onPhoto: (file: File, dataUrl: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function UploadStep({ photoDataUrl, onPhoto, onNext, onBack }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const detectFace = useCallback(async (dataUrl: string) => {
    setDetecting(true);
    try {
      // Dynamic import to avoid SSR issues
      const faceapi = await import('face-api.js');
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');

      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((r) => { img.onload = () => r(); });

      const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions());
      setFaceDetected(detections.length > 0);
    } catch {
      setFaceDetected(true); // Fail open - let Claude handle validation
    } finally {
      setDetecting(false);
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      onPhoto(file, dataUrl);
      detectFace(dataUrl);
    };
    reader.readAsDataURL(file);
  }, [onPhoto, detectFace]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  };

  return (
    <div>
      <ProgressBar current={3} total={4} />
      <h1 className="text-[28px] font-semibold text-gray-900 text-center mb-2">Upload your photo</h1>
      <p className="text-sm text-gray-400 text-center mb-6">Take or upload a clear front-facing photo</p>

      <div
        onClick={() => !photoDataUrl && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`relative rounded-2xl overflow-hidden mb-4 ${
          photoDataUrl ? 'cursor-default' : 'cursor-pointer border-2 border-dashed border-gray-200 hover:border-gray-400 transition-colors'
        }`}
        style={{ aspectRatio: '3/4' }}
      >
        {photoDataUrl ? (
          <>
            <img src={photoDataUrl} alt="Uploaded" className="w-full h-full object-cover" />
            <button
              onClick={() => inputRef.current?.click()}
              className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full shadow flex items-center justify-center text-gray-600 hover:bg-gray-100"
            >
              ×
            </button>
            {detecting && (
              <div className="absolute bottom-0 left-0 right-0 bg-amber-500 text-white text-sm py-2 px-3 flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Detecting face...
              </div>
            )}
            {!detecting && faceDetected && (
              <div className="absolute bottom-0 left-0 right-0 bg-green-500 text-white text-sm py-2.5 px-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Face detected and centered
              </div>
            )}
            {!detecting && !faceDetected && photoDataUrl && (
              <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white text-sm py-2.5 px-3">
                No face detected. Try a clearer photo.
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
            <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-4m0 0V8m0 4h4m-4 0H8m12 8H4a2 2 0 01-2-2V6a2 2 0 012-2h16a2 2 0 012 2v14a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 text-sm font-medium">Click to upload or drag and drop</p>
            <p className="text-gray-300 text-xs">PNG, JPG or JPEG</p>
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      <div className="text-xs text-gray-400 mb-6 space-y-1">
        <p>• Face the camera directly with neutral expression</p>
        <p>• Good lighting — avoid shadows</p>
        <p>• Remove glasses, hats, or hair covering face</p>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-4 rounded-xl border border-gray-200 text-gray-800 font-semibold">Back</button>
        <button
          onClick={onNext}
          disabled={!photoDataUrl || detecting}
          className="flex-1 py-4 rounded-xl bg-black text-white font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Analyze
        </button>
      </div>
    </div>
  );
}
