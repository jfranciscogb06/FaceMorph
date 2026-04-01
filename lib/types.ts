export type Gender = 'male' | 'female';

export type Ethnicity =
  | 'east_asian' | 'south_asian' | 'black_african'
  | 'hispanic' | 'middle_eastern' | 'native_american'
  | 'pacific_islander' | 'white_caucasian';

export interface AnalysisScores {
  symmetry: number;
  goldenRatio: number;
  jawline: number;
  eyes: number;
  nose: number;
  lips: number;
  skinClarity: number;
  facialThirds: number;
}

export interface AnalysisResult {
  overallScore: number;
  scores: AnalysisScores;
  faceShape: string;
  attractivenessCategory: string;
  strengths: string[];
  improvements: string[];
  recommendations: {
    category: 'skincare' | 'grooming' | 'hairstyle' | 'exercise' | 'lifestyle';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  detailedAnalysis: {
    feature: string;
    score: number;
    observation: string;
    tip: string;
  }[];
}

export interface AppState {
  step: 'gender' | 'ethnicity' | 'upload' | 'analyzing' | 'results';
  gender: Gender | null;
  ethnicity: Ethnicity[];
  photoFile: File | null;
  photoDataUrl: string | null;
  result: AnalysisResult | null;
}
