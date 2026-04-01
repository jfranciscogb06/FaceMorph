import { AnalysisResult, LandmarkPoint } from './types';
import * as ImageManipulator from 'expo-image-manipulator';

const BASE_URL = 'https://facemorph.onrender.com';

export async function compressImage(uri: string): Promise<{ uri: string; base64: string; width: number; height: number }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  console.log(`[compressImage] output: ${result.width}x${result.height}`);
  return { uri: result.uri, base64: result.base64 || '', width: result.width, height: result.height };
}

const LANDMARK_META: Record<string, { label: string; instruction: string }> = {
  hairline:           { label: 'Hairline',           instruction: 'Place at the center of your hairline, where your hair begins.' },
  left_brow:          { label: 'Left Eyebrow',        instruction: 'Place at the highest arch of your left eyebrow.' },
  right_brow:         { label: 'Right Eyebrow',       instruction: 'Place at the highest arch of your right eyebrow.' },
  left_pupil:         { label: 'Left Eye',            instruction: 'Place at the center of your left eye, directly on the pupil.' },
  right_pupil:        { label: 'Right Eye',           instruction: 'Place at the center of your right eye, directly on the pupil.' },
  nose_bridge:        { label: 'Nose Bridge',         instruction: 'Place at the top of your nose bridge, between your eyes.' },
  nose_tip:           { label: 'Nose Tip',            instruction: 'Place at the very tip of your nose.' },
  left_nostril:       { label: 'Left Nostril',        instruction: 'Place at the outer base of your left nostril.' },
  right_nostril:      { label: 'Right Nostril',       instruction: 'Place at the outer base of your right nostril.' },
  left_mouth_corner:  { label: 'Left Mouth Corner',   instruction: 'Place at the left corner where your lips meet.' },
  right_mouth_corner: { label: 'Right Mouth Corner',  instruction: 'Place at the right corner where your lips meet.' },
  upper_lip:          { label: 'Upper Lip',           instruction: 'Place at the center peak of your upper lip, at the Cupid\'s bow.' },
  lower_lip:          { label: 'Lower Lip',           instruction: 'Place at the center of your lower lip\'s fullest point.' },
  chin_tip:           { label: 'Chin',                instruction: 'Place at the very bottom of your chin.' },
  left_jaw:           { label: 'Left Jaw Angle',      instruction: 'Place where your jaw angles upward toward your left ear.' },
  right_jaw:          { label: 'Right Jaw Angle',     instruction: 'Place where your jaw angles upward toward your right ear.' },
  left_cheek:         { label: 'Left Cheekbone',      instruction: 'Place at the widest, most prominent point of your left cheekbone.' },
  right_cheek:        { label: 'Right Cheekbone',     instruction: 'Place at the widest, most prominent point of your right cheekbone.' },
};

export async function detectLandmarks(imageDataUrl: string): Promise<LandmarkPoint[]> {
  const response = await fetch(`${BASE_URL}/api/landmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageDataUrl }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Landmarks request failed: ${response.status}`);
  }

  const data = await response.json();
  return (data.landmarks || []).map((l: { id: string; x: number; y: number }) => ({
    id: l.id,
    x: l.x,
    y: l.y,
    label: LANDMARK_META[l.id]?.label || l.id,
    instruction: LANDMARK_META[l.id]?.instruction || 'Tap to reposition',
  }));
}

export async function analyzePhoto(
  imageDataUrl: string,
  gender: string,
  ethnicity: string[],
  landmarks: LandmarkPoint[]
): Promise<AnalysisResult> {
  const response = await fetch(`${BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageDataUrl, gender, ethnicity, landmarks }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${response.status}`);
  }

  return response.json();
}
