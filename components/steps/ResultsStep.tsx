'use client';

import { AnalysisResult } from '@/lib/types';
import ScoreRing from '@/components/ui/ScoreRing';
import FeatureCard from '@/components/ui/FeatureCard';
import FaceOverlay from '@/components/ui/FaceOverlay';

interface Props {
  result: AnalysisResult;
  photoDataUrl: string;
  onRetry: () => void;
}

const SCORE_LABELS: Record<string, string> = {
  symmetry: 'Symmetry',
  goldenRatio: 'Golden Ratio',
  jawline: 'Jawline',
  eyes: 'Eyes',
  nose: 'Nose',
  lips: 'Lips',
  skinClarity: 'Skin',
  facialThirds: 'Face Thirds',
};

const CATEGORY_ICONS: Record<string, string> = {
  skincare: '✨',
  grooming: '💈',
  hairstyle: '💇',
  exercise: '💪',
  lifestyle: '🌿',
};

function scoreLabel(score: number): string {
  if (score >= 8.5) return 'Exceptional';
  if (score >= 7.5) return 'Above Average';
  if (score >= 6) return 'Average';
  if (score >= 4.5) return 'Below Average';
  return 'Needs Work';
}

function scoreColor(score: number): string {
  if (score >= 8) return '#22c55e';
  if (score >= 6.5) return '#f0b040';
  if (score >= 5) return '#f59e0b';
  return '#ef4444';
}

export default function ResultsStep({ result, photoDataUrl, onRetry }: Props) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-16">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0a]/90 backdrop-blur border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
        <h1 className="text-white font-bold text-lg">Your Analysis</h1>
        <button onClick={onRetry} className="text-gray-400 text-sm border border-[#333] px-3 py-1.5 rounded-lg hover:border-gray-500">
          New Scan
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">

        {/* Hero score + photo */}
        <div className="bg-[#141414] border border-[#222] rounded-3xl overflow-hidden">
          <FaceOverlay photoDataUrl={photoDataUrl} />
          <div className="p-6 flex items-center gap-6">
            <ScoreRing score={result.overallScore} size={100} />
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Overall Score</p>
              <p className="text-white text-2xl font-bold">{result.overallScore.toFixed(1)} / 10</p>
              <p className="font-semibold text-sm mt-1" style={{ color: scoreColor(result.overallScore) }}>
                {scoreLabel(result.overallScore)}
              </p>
              <p className="text-gray-500 text-xs mt-1">{result.faceShape} face shape</p>
            </div>
          </div>
        </div>

        {/* Score breakdown grid */}
        <div>
          <h2 className="text-white font-semibold mb-3">Score Breakdown</h2>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(result.scores).map(([key, val]) => {
              const color = scoreColor(val);
              const pct = (val / 10) * 100;
              return (
                <div key={key} className="bg-[#141414] border border-[#222] rounded-xl p-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-gray-400 text-xs">{SCORE_LABELS[key] || key}</span>
                    <span className="text-xs font-bold" style={{ color }}>{val.toFixed(1)}</span>
                  </div>
                  <div className="h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Strengths */}
        {result.strengths.length > 0 && (
          <div className="bg-[#0d1f14] border border-[#1a3d25] rounded-2xl p-4">
            <h3 className="text-green-400 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Strengths
            </h3>
            <ul className="space-y-2">
              {result.strengths.map((s, i) => (
                <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>{s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Improvements */}
        {result.improvements.length > 0 && (
          <div className="bg-[#1a1108] border border-[#3d2a1a] rounded-2xl p-4">
            <h3 className="text-amber-400 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Areas to Improve
            </h3>
            <ul className="space-y-2">
              {result.improvements.map((s, i) => (
                <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>{s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Feature-by-feature breakdown */}
        <div>
          <h2 className="text-white font-semibold mb-3">Feature Analysis</h2>
          <div className="space-y-3">
            {result.detailedAnalysis.map((item, i) => (
              <FeatureCard key={i} feature={item.feature} score={item.score} observation={item.observation} tip={item.tip} />
            ))}
          </div>
        </div>

        {/* Recommendations */}
        {result.recommendations.length > 0 && (
          <div>
            <h2 className="text-white font-semibold mb-3">Personalized Recommendations</h2>
            <div className="space-y-3">
              {result.recommendations.map((rec, i) => (
                <div key={i} className="bg-[#141414] border border-[#222] rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{CATEGORY_ICONS[rec.category] || '📌'}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold text-sm">{rec.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          rec.priority === 'high' ? 'bg-red-900/50 text-red-400' :
                          rec.priority === 'medium' ? 'bg-amber-900/50 text-amber-400' :
                          'bg-gray-800 text-gray-400'
                        }`}>
                          {rec.priority}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs leading-relaxed">{rec.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
