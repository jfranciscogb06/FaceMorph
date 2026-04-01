'use client';

interface Props {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

function scoreColor(score: number): string {
  if (score >= 8) return '#22c55e';
  if (score >= 6.5) return '#f0b040';
  if (score >= 5) return '#f59e0b';
  return '#ef4444';
}

export default function ScoreRing({ score, size = 120, strokeWidth = 8, label }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 10) * circumference;
  const color = scoreColor(score);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#1e1e1e" strokeWidth={strokeWidth} />
        <circle
          cx={size/2} cy={size/2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="relative" style={{ marginTop: -(size / 2 + 10) }}>
        <span className="text-3xl font-bold text-white">{score.toFixed(1)}</span>
      </div>
      {label && <p className="text-gray-500 text-xs mt-6">{label}</p>}
    </div>
  );
}
