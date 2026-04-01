'use client';

import { Gender } from '@/lib/types';
import ProgressBar from '@/components/ui/ProgressBar';

interface Props {
  selected: Gender | null;
  onSelect: (g: Gender) => void;
  onNext: () => void;
}

export default function GenderStep({ selected, onSelect, onNext }: Props) {
  return (
    <div>
      <ProgressBar current={1} total={4} />
      <h1 className="text-[28px] font-semibold text-gray-900 text-center mb-2">Select your gender</h1>
      <p className="text-sm text-gray-400 text-center mb-8">This helps us provide more accurate analysis</p>

      <div className="space-y-3 mb-6">
        {(['male', 'female'] as Gender[]).map((g) => (
          <button
            key={g}
            onClick={() => onSelect(g)}
            className={`w-full py-4 rounded-xl border text-[15px] font-medium transition-all ${
              selected === g
                ? 'border-black bg-black text-white'
                : 'border-gray-200 text-gray-800 hover:border-gray-400'
            }`}
          >
            {g.charAt(0).toUpperCase() + g.slice(1)}
          </button>
        ))}
      </div>

      <button
        onClick={onNext}
        disabled={!selected}
        className="w-full py-4 rounded-xl bg-black text-white font-semibold text-[15px] disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
      >
        Continue
      </button>
    </div>
  );
}
