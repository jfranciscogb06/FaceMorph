'use client';

import { useState } from 'react';
import { AppState, Gender, Ethnicity, AnalysisResult } from '@/lib/types';
import StepLayout from '@/components/ui/StepLayout';
import GenderStep from '@/components/steps/GenderStep';
import EthnicityStep from '@/components/steps/EthnicityStep';
import UploadStep from '@/components/steps/UploadStep';
import AnalyzingStep from '@/components/steps/AnalyzingStep';
import ResultsStep from '@/components/steps/ResultsStep';

const initial: AppState = {
  step: 'gender',
  gender: null,
  ethnicity: [],
  photoFile: null,
  photoDataUrl: null,
  result: null,
};

export default function AnalyzePage() {
  const [state, setState] = useState<AppState>(initial);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch }));

  const startAnalysis = async () => {
    if (!state.photoDataUrl || !state.gender) return;
    update({ step: 'analyzing' });
    setError(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: state.photoDataUrl,
          gender: state.gender,
          ethnicity: state.ethnicity,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Analysis failed');
      }

      const result: AnalysisResult = await res.json();
      update({ result, step: 'results' });
    } catch (e) {
      setError((e as Error).message);
      update({ step: 'upload' });
    }
  };

  const reset = () => { setState(initial); setError(null); };

  if (state.step === 'analyzing') return <AnalyzingStep />;

  if (state.step === 'results' && state.result && state.photoDataUrl) {
    return <ResultsStep result={state.result} photoDataUrl={state.photoDataUrl} onRetry={reset} />;
  }

  return (
    <StepLayout>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      {state.step === 'gender' && (
        <GenderStep
          selected={state.gender}
          onSelect={(g) => update({ gender: g })}
          onNext={() => update({ step: 'ethnicity' })}
        />
      )}

      {state.step === 'ethnicity' && (
        <EthnicityStep
          selected={state.ethnicity}
          onToggle={(e) => {
            const arr = state.ethnicity.includes(e)
              ? state.ethnicity.filter((x) => x !== e)
              : [...state.ethnicity, e];
            update({ ethnicity: arr });
          }}
          onNext={() => update({ step: 'upload' })}
          onBack={() => update({ step: 'gender' })}
        />
      )}

      {state.step === 'upload' && (
        <UploadStep
          photoDataUrl={state.photoDataUrl}
          onPhoto={(file, dataUrl) => update({ photoFile: file, photoDataUrl: dataUrl })}
          onNext={startAnalysis}
          onBack={() => update({ step: 'ethnicity' })}
        />
      )}
    </StepLayout>
  );
}
