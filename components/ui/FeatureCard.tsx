'use client';

interface Props {
  feature: string;
  score: number;
  observation: string;
  tip: string;
}

function scoreColor(score: number): string {
  if (score >= 8) return '#22c55e';
  if (score >= 6.5) return '#f0b040';
  if (score >= 5) return '#f59e0b';
  return '#ef4444';
}

export default function FeatureCard({ feature, score, observation, tip }: Props) {
  const color = scoreColor(score);
  const pct = (score / 10) * 100;

  return (
    <div className="bg-[#141414] border border-[#222] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white font-semibold text-sm">{feature}</span>
        <span className="font-bold text-sm" style={{ color }}>{score.toFixed(1)}</span>
      </div>
      <div className="h-1 bg-[#2a2a2a] rounded-full mb-3 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <p className="text-gray-400 text-xs mb-1">{observation}</p>
      <p className="text-gray-600 text-xs">💡 {tip}</p>
    </div>
  );
}
