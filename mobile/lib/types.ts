export type Gender = 'male' | 'female';

export type Ethnicity =
  | 'east_asian' | 'south_asian' | 'black_african'
  | 'hispanic' | 'middle_eastern' | 'native_american'
  | 'pacific_islander' | 'white_caucasian';

export interface LandmarkPoint {
  id: string;
  label: string;
  instruction: string;
  x: number; // 0-1 fraction of image width
  y: number; // 0-1 fraction of image height
}

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
  styleCategory: string;
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

export interface ScanHistoryItem {
  id: string;
  date: string; // ISO 8601
  overallScore: number;
  scores: AnalysisScores;
  faceShape: string;
  styleCategory: string;
  result: AnalysisResult;
  photoUri?: string;
}

export interface AppState {
  step: 'gender' | 'ethnicity' | 'tips' | 'upload' | 'landmarks' | 'analyzing' | 'results' | 'home';
  gender: Gender | null;
  ethnicity: Ethnicity[];
  photoUri: string | null;
  photoBase64: string | null;
  photoWidth: number | null;
  photoHeight: number | null;
  landmarks: LandmarkPoint[];
  result: AnalysisResult | null;
  error: string | null;
}
