'use client';

import { Ethnicity } from '@/lib/types';
import ProgressBar from '@/components/ui/ProgressBar';

const OPTIONS: { value: Ethnicity; label: string }[] = [
  { value: 'east_asian', label: 'East Asian' },
  { value: 'south_asian', label: 'South Asian' },
  { value: 'black_african', label: 'Black / African' },
  { value: 'hispanic', label: 'Hispanic' },
  { value: 'middle_eastern', label: 'Middle Eastern' },
  { value: 'native_american', label: 'Native American' },
  { value: 'pacific_islander', label: 'Pacific Islander' },
  { value: 'white_caucasian', label: 'White / Caucasian' },
];

interface Props {
  selected: Ethnicity[];
  onToggle: (e: Ethnicity) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function EthnicityStep({ selected, onToggle, onNext, onBack }: Props) {
  return (
    <div>
      <ProgressBar current={2} total={4} />
      <h1 className="text-[28px] font-semibold text-gray-900 text-center mb-2">Select your ethnicity</h1>
      <p className="text-sm text-gray-400 text-center mb-8">You can select multiple options</p>

      <div className="space-y-2 mb-6">
        {OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onToggle(value)}
            className={`w-full py-3.5 rounded-xl border text-[15px] font-medium transition-all text-left px-4 ${
              selected.includes(value)
                ? 'border-black bg-black text-white'
                : 'border-gray-200 text-gray-800 hover:border-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-4 rounded-xl border border-gray-200 text-gray-800 font-semibold text-[15px]">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={selected.length === 0}
          className="flex-1 py-4 rounded-xl bg-black text-white font-semibold text-[15px] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
