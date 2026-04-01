'use client';

import { useEffect, useState } from 'react';

const STAGES = [
  'Detecting facial landmarks...',
  'Measuring symmetry ratios...',
  'Analyzing golden ratio proportions...',
  'Evaluating jawline and bone structure...',
  'Assessing skin clarity...',
  'Calculating facial thirds...',
  'Generating personalized insights...',
];

export default function AnalyzingStep() {
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIdx((i) => (i < STAGES.length - 1 ? i + 1 : i));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const progress = ((stageIdx + 1) / STAGES.length) * 100;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm text-center">
        {/* Animated face icon */}
        <div className="relative w-24 h-24 mx-auto mb-10">
          <div className="absolute inset-0 rounded-full border-2 border-[#f0b040]/30 animate-ping" />
          <div className="absolute inset-2 rounded-full border-2 border-[#f0b040]/50 animate-pulse" />
          <div className="w-24 h-24 rounded-full border-2 border-[#f0b040] flex items-center justify-center">
            <svg className="w-10 h-10 text-[#f0b040]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Analyzing your face</h2>
        <p className="text-gray-500 text-sm mb-10">Our AI is running 52-point facial analysis</p>

        {/* Progress bar */}
        <div className="w-full h-1 bg-[#1a1a1a] rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#f0b040] to-[#f59e0b] rounded-full transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-[#f0b040] text-sm font-medium min-h-[20px] transition-all">
          {STAGES[stageIdx]}
        </p>

        <div className="mt-10 grid grid-cols-3 gap-3 text-center">
          {['Symmetry', 'Proportions', 'Structure', 'Jawline', 'Skin', 'Ratios'].map((label) => (
            <div key={label} className="bg-[#141414] rounded-lg py-2 px-1">
              <div className="w-4 h-4 mx-auto mb-1 rounded-full bg-[#f0b040]/20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[#f0b040] animate-pulse" />
              </div>
              <p className="text-gray-500 text-[10px]">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
