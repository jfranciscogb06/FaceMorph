'use client';

interface ProgressBarProps {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = (current / total) * 100;
  return (
    <div className="w-full h-1 bg-gray-100 rounded-full mb-8">
      <div
        className="h-1 bg-black rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
