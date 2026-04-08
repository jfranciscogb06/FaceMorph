import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'mogify_calibration_examples_v1';

export interface CalibrationExample {
  id: string;
  label: string;           // e.g. "Average white male"
  gender: string;
  ethnicity: string;
  overallScore: number;    // 1-10 ground truth
  scores: {
    jawline: number;
    eyes: number;
    nose: number;
    lips: number;
    skinClarity: number;
  };
  imageBase64: string;     // compressed jpeg base64 (no data: prefix)
  addedAt: string;
}

export async function getCalibrationExamples(): Promise<CalibrationExample[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addCalibrationExample(example: Omit<CalibrationExample, 'id' | 'addedAt'>): Promise<void> {
  const examples = await getCalibrationExamples();
  const newExample: CalibrationExample = {
    ...example,
    id: Date.now().toString(),
    addedAt: new Date().toISOString(),
  };
  const updated = [...examples, newExample];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export async function deleteCalibrationExample(id: string): Promise<void> {
  const examples = await getCalibrationExamples();
  const updated = examples.filter(e => e.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

// Returns up to 4 examples spread across the score range for few-shot prompting
export function pickRepresentativeExamples(examples: CalibrationExample[]): CalibrationExample[] {
  if (examples.length === 0) return [];

  const sorted = [...examples].sort((a, b) => a.overallScore - b.overallScore);

  if (sorted.length <= 4) return sorted;

  // Pick one from each tier: low (1-4), mid-low (4-6), mid-high (6-7.5), high (7.5+)
  const tiers = [
    sorted.filter(e => e.overallScore <= 4),
    sorted.filter(e => e.overallScore > 4 && e.overallScore <= 6),
    sorted.filter(e => e.overallScore > 6 && e.overallScore <= 7.5),
    sorted.filter(e => e.overallScore > 7.5),
  ];

  return tiers
    .map(tier => tier[Math.floor(tier.length / 2)])  // pick middle of each tier
    .filter(Boolean);
}
