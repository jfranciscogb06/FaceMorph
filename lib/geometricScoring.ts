// Geometric scoring engine — converts Face++ 106-point landmarks to PSL scores
// All Gemini-recommended metrics: canthal tilt, facial thirds, FWHR, gonial angle,
// nose width ratio, lip ratio, symmetry, golden ratio, midface ratio

import type { FPLandmarks, FPSkinStatus } from './facepp';

const R2D = 180 / Math.PI;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lm(landmarks: FPLandmarks, key: string) {
  return landmarks[key];
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function lerp(x: number, x0: number, x1: number, y0: number, y1: number) {
  if (x <= x0) return y0;
  if (x >= x1) return y1;
  return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function r1(n: number) {
  return Math.round(clamp(n, 1, 10) * 10) / 10;
}

// ─── Individual metric calculators ────────────────────────────────────────────

/**
 * Canthal tilt — angle of eye axis from horizontal.
 * Positive = outer corner higher than inner = hunter eyes (attractive).
 * Face++ landmark convention (from image/viewer perspective):
 *   left eye  (left side of image): outer = left_eye_left_corner, inner = left_eye_right_corner
 *   right eye (right side of image): inner = right_eye_left_corner, outer = right_eye_right_corner
 */
function calcCanthalTilt(lms: FPLandmarks): { leftDeg: number; rightDeg: number; avgDeg: number } | null {
  const lOuter = lm(lms, 'left_eye_left_corner');
  const lInner = lm(lms, 'left_eye_right_corner');
  const rInner = lm(lms, 'right_eye_left_corner');
  const rOuter = lm(lms, 'right_eye_right_corner');

  if (!lOuter || !lInner || !rInner || !rOuter) return null;

  // Left eye: vector from outer→inner. If inner.y > outer.y → positive tilt.
  const leftDeg = Math.atan2(lInner.y - lOuter.y, lInner.x - lOuter.x) * R2D;
  // Right eye: vector from outer→inner. Outer is to the right (larger x).
  const rightDeg = Math.atan2(rInner.y - rOuter.y, rOuter.x - rInner.x) * R2D;

  return { leftDeg, rightDeg, avgDeg: (leftDeg + rightDeg) / 2 };
}

/**
 * Eye aspect ratio (openness) — height / width per eye.
 * Larger = more open = attractive.
 */
function calcEyeAspectRatio(lms: FPLandmarks): number | null {
  const lTop = lm(lms, 'left_eye_top');
  const lBot = lm(lms, 'left_eye_bottom');
  const lL = lm(lms, 'left_eye_left_corner');
  const lR = lm(lms, 'left_eye_right_corner');
  const rTop = lm(lms, 'right_eye_top');
  const rBot = lm(lms, 'right_eye_bottom');
  const rL = lm(lms, 'right_eye_left_corner');
  const rR = lm(lms, 'right_eye_right_corner');

  if (!lTop || !lBot || !lL || !lR || !rTop || !rBot || !rL || !rR) return null;

  const leftRatio = dist(lTop, lBot) / dist(lL, lR);
  const rightRatio = dist(rTop, rBot) / dist(rL, rR);
  return (leftRatio + rightRatio) / 2;
}

/**
 * Facial symmetry — average relative asymmetry of paired landmarks from midline.
 * Returns a 0–1 deviation (lower = more symmetric).
 */
function calcSymmetry(lms: FPLandmarks): number | null {
  const lEyeC = lm(lms, 'left_eye_center');
  const rEyeC = lm(lms, 'right_eye_center');
  if (!lEyeC || !rEyeC) return null;

  const midX = (lEyeC.x + rEyeC.x) / 2;

  const pairs: [string, string][] = [
    ['left_eye_center', 'right_eye_center'],
    ['left_eye_left_corner', 'right_eye_right_corner'],
    ['left_eyebrow_left_corner', 'right_eyebrow_right_corner'],
    ['left_eyebrow_upper_middle', 'right_eyebrow_upper_middle'],
    ['nose_left_corner', 'nose_right_corner'],
    ['mouth_left_corner', 'mouth_right_corner'],
    ['contour_left1', 'contour_right1'],
    ['contour_left5', 'contour_right5'],
    ['contour_left9', 'contour_right9'],
  ];

  const deviations: number[] = [];
  for (const [lKey, rKey] of pairs) {
    const lp = lm(lms, lKey);
    const rp = lm(lms, rKey);
    if (!lp || !rp) continue;

    const lDist = Math.abs(lp.x - midX);
    const rDist = Math.abs(rp.x - midX);
    const maxD = Math.max(lDist, rDist);
    if (maxD > 0) deviations.push(Math.abs(lDist - rDist) / maxD);
  }

  if (deviations.length === 0) return null;
  return deviations.reduce((a, b) => a + b, 0) / deviations.length;
}

/**
 * Facial thirds — hairline:brow:nose:chin should each be ~33% of total height.
 * Returns max deviation from 33% (lower = better balanced).
 * Note: Face++ has no hairline point — we estimate from eyebrow position.
 */
function calcFacialThirds(lms: FPLandmarks): number | null {
  const lBrow = lm(lms, 'left_eyebrow_upper_middle');
  const rBrow = lm(lms, 'right_eyebrow_upper_middle');
  const noseTip = lm(lms, 'nose_tip');
  const chin = lm(lms, 'contour_chin');

  if (!lBrow || !rBrow || !noseTip || !chin) return null;

  const browY = (lBrow.y + rBrow.y) / 2;

  // Estimate hairline as (brow_to_nose distance) above brow
  const browToNose = Math.abs(noseTip.y - browY);
  const hairlineY = browY - browToNose;

  const total = Math.abs(chin.y - hairlineY);
  if (total <= 0) return null;

  const upper = Math.abs(browY - hairlineY) / total;      // hairline→brow
  const mid = Math.abs(noseTip.y - browY) / total;        // brow→nose tip
  const lower = Math.abs(chin.y - noseTip.y) / total;     // nose→chin

  return Math.max(Math.abs(upper - 1 / 3), Math.abs(mid - 1 / 3), Math.abs(lower - 1 / 3));
}

/**
 * Facial Width-Height Ratio (FWHR) — bizygomatic width / upper-face height.
 * Higher FWHR = more dominant/masculine facial structure.
 * Ideal range: ~1.8–2.0 (men), ~1.6–1.9 (women).
 */
function calcFWHR(lms: FPLandmarks): number | null {
  const c1L = lm(lms, 'contour_left1');
  const c1R = lm(lms, 'contour_right1');
  const lBrow = lm(lms, 'left_eyebrow_upper_middle');
  const rBrow = lm(lms, 'right_eyebrow_upper_middle');
  const mouth = lm(lms, 'mouth_upper_lip_top');

  if (!c1L || !c1R || !lBrow || !rBrow || !mouth) return null;

  // Bizygomatic width = widest face contour (typically contour 1 on each side)
  // Try contour 2 as well and take max
  const c2L = lm(lms, 'contour_left2');
  const c2R = lm(lms, 'contour_right2');
  let faceWidth = Math.abs(c1R.x - c1L.x);
  if (c2L && c2R) faceWidth = Math.max(faceWidth, Math.abs(c2R.x - c2L.x));

  const browY = (lBrow.y + rBrow.y) / 2;
  const upperFaceH = Math.abs(mouth.y - browY); // brow to mouth

  if (upperFaceH <= 0) return null;
  return faceWidth / upperFaceH;
}

/**
 * Gonial angle — sharpness of jaw angle.
 * Estimated from the angle at contour_left5/right5 (jaw angle region).
 * Sharper angle (~115°) = defined jaw = higher score.
 */
function calcGonialAngle(lms: FPLandmarks): number | null {
  // Use three points: near-ear (contour 2), jaw angle (contour 5), near-chin (contour 8)
  const earL = lm(lms, 'contour_left2');
  const jawAngleL = lm(lms, 'contour_left5');
  const chinAreaL = lm(lms, 'contour_left8');

  const earR = lm(lms, 'contour_right2');
  const jawAngleR = lm(lms, 'contour_right5');
  const chinAreaR = lm(lms, 'contour_right8');

  const calcAngle = (ear: { x: number; y: number }, jaw: { x: number; y: number }, chinArea: { x: number; y: number }) => {
    const v1 = { x: ear.x - jaw.x, y: ear.y - jaw.y };
    const v2 = { x: chinArea.x - jaw.x, y: chinArea.y - jaw.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag = Math.sqrt(v1.x ** 2 + v1.y ** 2) * Math.sqrt(v2.x ** 2 + v2.y ** 2);
    if (mag === 0) return null;
    return Math.acos(clamp(dot / mag, -1, 1)) * R2D;
  };

  const angles: number[] = [];
  if (earL && jawAngleL && chinAreaL) {
    const a = calcAngle(earL, jawAngleL, chinAreaL);
    if (a !== null) angles.push(a);
  }
  if (earR && jawAngleR && chinAreaR) {
    const a = calcAngle(earR, jawAngleR, chinAreaR);
    if (a !== null) angles.push(a);
  }

  if (angles.length === 0) return null;
  return angles.reduce((a, b) => a + b, 0) / angles.length;
}

/**
 * Nose width ratio — nose ala width / bizygomatic face width.
 * Ideal: ~0.25 (nose is 1/4 of face width). Wide nose > 0.30 is penalized.
 */
function calcNoseWidthRatio(lms: FPLandmarks): number | null {
  const noseL = lm(lms, 'nose_left_corner');
  const noseR = lm(lms, 'nose_right_corner');
  const c1L = lm(lms, 'contour_left1');
  const c1R = lm(lms, 'contour_right1');
  const c2L = lm(lms, 'contour_left2');
  const c2R = lm(lms, 'contour_right2');

  if (!noseL || !noseR || !c1L || !c1R) return null;

  const noseWidth = Math.abs(noseR.x - noseL.x);
  let faceWidth = Math.abs(c1R.x - c1L.x);
  if (c2L && c2R) faceWidth = Math.max(faceWidth, Math.abs(c2R.x - c2L.x));

  if (faceWidth <= 0) return null;
  return noseWidth / faceWidth;
}

/**
 * Lip fullness ratio — total lip height / mouth width.
 * Higher = fuller lips.
 * Also computes upper:lower lip ratio (ideal 1:1.6 = upper is 38% of total).
 */
function calcLipMetrics(lms: FPLandmarks): { fullnessRatio: number; upperLowerRatio: number } | null {
  const upper = lm(lms, 'mouth_upper_lip_top');
  const lower = lm(lms, 'mouth_lower_lip_bottom');
  const midLine = lm(lms, 'mouth_lower_lip_top'); // junction between lips
  const mL = lm(lms, 'mouth_left_corner');
  const mR = lm(lms, 'mouth_right_corner');

  if (!upper || !lower || !mL || !mR) return null;

  const totalHeight = Math.abs(lower.y - upper.y);
  const mouthWidth = Math.abs(mR.x - mL.x);
  if (mouthWidth <= 0) return null;

  const fullnessRatio = totalHeight / mouthWidth;

  let upperLowerRatio = 0.38; // default: ideal
  if (midLine) {
    const upperH = Math.abs(midLine.y - upper.y);
    const lowerH = Math.abs(lower.y - midLine.y);
    if (upperH + lowerH > 0) upperLowerRatio = upperH / (upperH + lowerH);
  }

  return { fullnessRatio, upperLowerRatio };
}

/**
 * Golden ratio — inter-pupillary distance / face width.
 * Ideal: ~0.46 (IPD is 46% of face width).
 */
function calcGoldenRatio(lms: FPLandmarks): number | null {
  const lPupil = lm(lms, 'left_eye_center');
  const rPupil = lm(lms, 'right_eye_center');
  const c1L = lm(lms, 'contour_left1');
  const c1R = lm(lms, 'contour_right1');
  const c2L = lm(lms, 'contour_left2');
  const c2R = lm(lms, 'contour_right2');

  if (!lPupil || !rPupil || !c1L || !c1R) return null;

  const ipd = Math.abs(rPupil.x - lPupil.x);
  let faceWidth = Math.abs(c1R.x - c1L.x);
  if (c2L && c2R) faceWidth = Math.max(faceWidth, Math.abs(c2R.x - c2L.x));

  if (faceWidth <= 0) return null;
  return ipd / faceWidth;
}

// ─── Score converters (raw metric → PSL 1-10) ──────────────────────────────

function canthalTiltToScore(deg: number): number {
  // < -3°: bad, 0°: average (4), +2-4°: good (6-7), +5°+: excellent (8-9)
  if (deg >= 6)   return lerp(deg, 6, 10, 8.5, 10);
  if (deg >= 3)   return lerp(deg, 3, 6, 6.5, 8.5);
  if (deg >= 1)   return lerp(deg, 1, 3, 5.5, 6.5);
  if (deg >= -1)  return lerp(deg, -1, 1, 4, 5.5);
  if (deg >= -3)  return lerp(deg, -3, -1, 3, 4);
  return lerp(deg, -6, -3, 1.5, 3);
}

function eyeAspectToScore(ratio: number): number {
  // 0.20 = very closed, 0.30 = average, 0.40 = very open
  if (ratio >= 0.40) return lerp(ratio, 0.40, 0.55, 7, 9);
  if (ratio >= 0.32) return lerp(ratio, 0.32, 0.40, 5.5, 7);
  if (ratio >= 0.25) return lerp(ratio, 0.25, 0.32, 4, 5.5);
  return lerp(ratio, 0.15, 0.25, 2, 4);
}

function symmetryToScore(deviation: number): number {
  // deviation 0 = perfect, 0.10 = average, 0.20+ = asymmetric
  const pct = deviation * 100;
  if (pct <= 3)   return lerp(pct, 0, 3, 10, 8);
  if (pct <= 7)   return lerp(pct, 3, 7, 8, 5.5);
  if (pct <= 12)  return lerp(pct, 7, 12, 5.5, 4);
  if (pct <= 20)  return lerp(pct, 12, 20, 4, 2.5);
  return lerp(pct, 20, 35, 2.5, 1.5);
}

function facialThirdsToScore(maxDeviation: number): number {
  // deviation is max abs(third - 0.333)
  const pct = maxDeviation * 100;
  if (pct <= 2)   return lerp(pct, 0, 2, 10, 8);
  if (pct <= 5)   return lerp(pct, 2, 5, 8, 6);
  if (pct <= 9)   return lerp(pct, 5, 9, 6, 4.5);
  if (pct <= 15)  return lerp(pct, 9, 15, 4.5, 3);
  return lerp(pct, 15, 25, 3, 1.5);
}

function fwhrToScore(fwhr: number, gender: 'male' | 'female'): number {
  // Men: ideal 1.8-2.0. Women: ideal 1.6-1.9
  const [lo, ideal, hi] = gender === 'male' ? [1.5, 1.9, 2.3] : [1.4, 1.75, 2.1];
  const delta = Math.abs(fwhr - ideal);
  if (delta <= 0.05) return lerp(delta, 0, 0.05, 8, 7);
  if (delta <= 0.15) return lerp(delta, 0.05, 0.15, 7, 5.5);
  if (delta <= 0.30) return lerp(delta, 0.15, 0.30, 5.5, 4);
  if (fwhr < lo || fwhr > hi) return lerp(Math.abs(fwhr - ideal), 0.30, 0.60, 4, 2);
  return 4;
}

function gonialAngleToScore(deg: number): number {
  // Ideal: 115-125° (sharp, defined). Average: 128-135°. Weak: >140°
  if (deg <= 115) return lerp(deg, 105, 115, 8.5, 9);
  if (deg <= 125) return lerp(deg, 115, 125, 7, 8.5);
  if (deg <= 130) return lerp(deg, 125, 130, 5.5, 7);
  if (deg <= 135) return lerp(deg, 130, 135, 4, 5.5);
  if (deg <= 142) return lerp(deg, 135, 142, 3, 4);
  return lerp(deg, 142, 155, 1.5, 3);
}

function noseWidthToScore(ratio: number): number {
  // Ideal: 0.24-0.28. Wide >0.32 is penalized.
  const delta = Math.abs(ratio - 0.26);
  if (delta <= 0.02) return lerp(delta, 0, 0.02, 8, 7);
  if (delta <= 0.04) return lerp(delta, 0.02, 0.04, 7, 5.5);
  if (delta <= 0.07) return lerp(delta, 0.04, 0.07, 5.5, 4);
  if (delta <= 0.10) return lerp(delta, 0.07, 0.10, 4, 3);
  return lerp(delta, 0.10, 0.15, 3, 1.5);
}

function lipMetricsToScore(fullness: number, upperLowerRatio: number): number {
  // fullness ideal ~0.30-0.40, upper:lower ideal ~0.38
  const fullnessScore = (() => {
    if (fullness >= 0.35) return lerp(fullness, 0.35, 0.55, 6.5, 9);
    if (fullness >= 0.25) return lerp(fullness, 0.25, 0.35, 5, 6.5);
    if (fullness >= 0.18) return lerp(fullness, 0.18, 0.25, 3.5, 5);
    return lerp(fullness, 0.10, 0.18, 2, 3.5);
  })();

  const ratioDeviation = Math.abs(upperLowerRatio - 0.38);
  const ratioScore = (() => {
    if (ratioDeviation <= 0.04) return lerp(ratioDeviation, 0, 0.04, 9, 7);
    if (ratioDeviation <= 0.10) return lerp(ratioDeviation, 0.04, 0.10, 7, 5);
    return lerp(ratioDeviation, 0.10, 0.20, 5, 3);
  })();

  return fullnessScore * 0.7 + ratioScore * 0.3;
}

function goldenRatioToScore(ratio: number): number {
  // IPD/face_width ideal ~0.46
  const delta = Math.abs(ratio - 0.46);
  if (delta <= 0.01) return lerp(delta, 0, 0.01, 9, 8);
  if (delta <= 0.03) return lerp(delta, 0.01, 0.03, 8, 6.5);
  if (delta <= 0.06) return lerp(delta, 0.03, 0.06, 6.5, 5);
  if (delta <= 0.10) return lerp(delta, 0.06, 0.10, 5, 3.5);
  return lerp(delta, 0.10, 0.18, 3.5, 2);
}

function skinStatusToScore(skin: FPSkinStatus): number {
  // health: 0-100 (higher=better), others: 0-100 (lower=better)
  const healthScore = lerp(skin.health, 0, 100, 1, 10);
  const acnePenalty = lerp(skin.acne, 0, 100, 0, 5);
  const stainPenalty = lerp(skin.stain, 0, 100, 0, 2.5);
  const darkPenalty = lerp(skin.dark_circle, 0, 100, 0, 1.5);
  return clamp(healthScore - acnePenalty - stainPenalty - darkPenalty, 1, 10);
}

// ─── Main export ───────────────────────────────────────────────────────────────

export interface GeometricScores {
  symmetry: number;
  goldenRatio: number;
  facialThirds: number;
  jawline: number;
  eyes: number;
  nose: number;
  lips: number;
  skinClarity: number;
  [key: string]: number;
}

export interface RawMeasurements {
  canthalTiltDeg: number | null;      // positive = hunter eyes
  eyeAspectRatio: number | null;      // height/width
  symmetryDeviation: number | null;   // 0-1, lower=better
  facialThirdsMaxDev: number | null;  // 0-1, lower=better
  fwhr: number | null;                // facial width-height ratio
  gonialAngleDeg: number | null;      // jaw sharpness, lower=sharper
  noseWidthRatio: number | null;      // nose width / face width
  lipFullnessRatio: number | null;    // lip height / mouth width
  lipUpperLowerRatio: number | null;  // upper lip % of total lip
  goldenRatioIPD: number | null;      // IPD / face width
  beautyScore: number;                // Face++ beauty score 0-100
  [key: string]: number | null;
}

export function computeAllScores(
  landmarks: FPLandmarks,
  skinStatus: FPSkinStatus,
  beautyScore: number,
  gender: 'male' | 'female',
): { scores: GeometricScores; measurements: RawMeasurements } {
  // ── Compute raw measurements ────────────────────────────────────────────
  const canthalTilt = calcCanthalTilt(landmarks);
  const eyeAR = calcEyeAspectRatio(landmarks);
  const symmetryDev = calcSymmetry(landmarks);
  const thirds = calcFacialThirds(landmarks);
  const fwhr = calcFWHR(landmarks);
  const gonial = calcGonialAngle(landmarks);
  const noseRatio = calcNoseWidthRatio(landmarks);
  const lipMetrics = calcLipMetrics(landmarks);
  const gr = calcGoldenRatio(landmarks);

  const measurements: RawMeasurements = {
    canthalTiltDeg: canthalTilt?.avgDeg ?? null,
    eyeAspectRatio: eyeAR,
    symmetryDeviation: symmetryDev,
    facialThirdsMaxDev: thirds,
    fwhr,
    gonialAngleDeg: gonial,
    noseWidthRatio: noseRatio,
    lipFullnessRatio: lipMetrics?.fullnessRatio ?? null,
    lipUpperLowerRatio: lipMetrics?.upperLowerRatio ?? null,
    goldenRatioIPD: gr,
    beautyScore,
  };

  // ── Convert to PSL scores ───────────────────────────────────────────────

  // Eyes: 50% canthal tilt, 30% eye aspect ratio, 20% golden ratio proximity
  const eyesFromCanthal = canthalTilt ? canthalTiltToScore(canthalTilt.avgDeg) : 4.0;
  const eyesFromAR = eyeAR ? eyeAspectToScore(eyeAR) : 4.0;
  const eyeScore = r1(eyesFromCanthal * 0.55 + eyesFromAR * 0.45);

  // Symmetry
  const symScore = r1(symmetryDev !== null ? symmetryToScore(symmetryDev) : 4.5);

  // Facial thirds
  const thirdsScore = r1(thirds !== null ? facialThirdsToScore(thirds) : 4.5);

  // Golden ratio
  const grScore = r1(gr !== null ? goldenRatioToScore(gr) : 4.5);

  // Jawline: 60% gonial angle, 40% FWHR (structure)
  const jawFromGonial = gonial ? gonialAngleToScore(gonial) : 4.0;
  const jawFromFWHR = fwhr ? fwhrToScore(fwhr, gender) : 4.0;
  const jawScore = r1(jawFromGonial * 0.6 + jawFromFWHR * 0.4);

  // Nose
  const noseScore = r1(noseRatio ? noseWidthToScore(noseRatio) : 4.0);

  // Lips
  const lipsScore = r1(lipMetrics ? lipMetricsToScore(lipMetrics.fullnessRatio, lipMetrics.upperLowerRatio) : 4.0);

  // Skin (from Face++ skin status)
  const skinScore = r1(skinStatusToScore(skinStatus));

  // ── Deflation — PSL 4 is average, compress above that ──────────────────
  const deflate = (s: number) => s <= 4 ? s : 4 + (s - 4) * 0.72;

  const scores: GeometricScores = {
    symmetry:     r1(deflate(symScore)),
    goldenRatio:  r1(deflate(grScore)),
    facialThirds: r1(deflate(thirdsScore)),
    jawline:      r1(deflate(jawScore)),
    eyes:         r1(deflate(eyeScore)),
    nose:         r1(deflate(noseScore)),
    lips:         r1(deflate(lipsScore)),
    skinClarity:  r1(deflate(skinScore)),
  };

  return { scores, measurements };
}

/**
 * Derive face shape from landmark geometry.
 * Uses face H/W ratio and jaw/cheekbone ratio.
 */
export function deriveFaceShape(landmarks: FPLandmarks): string {
  const chin = lm(landmarks, 'contour_chin');
  const c1L  = lm(landmarks, 'contour_left1');
  const c1R  = lm(landmarks, 'contour_right1');
  const c2L  = lm(landmarks, 'contour_left2');
  const c2R  = lm(landmarks, 'contour_right2');
  const c8L  = lm(landmarks, 'contour_left8');
  const c8R  = lm(landmarks, 'contour_right8');
  const lBrow = lm(landmarks, 'left_eyebrow_upper_middle');
  const rBrow = lm(landmarks, 'right_eyebrow_upper_middle');

  if (!chin || !c1L || !c1R || !lBrow || !rBrow) return 'Oval';

  let faceWidth = Math.abs(c1R.x - c1L.x);
  if (c2L && c2R) faceWidth = Math.max(faceWidth, Math.abs(c2R.x - c2L.x));

  const browY = (lBrow.y + rBrow.y) / 2;
  const hairlineY = browY - Math.abs(chin.y - browY) * 0.5;
  const faceHeight = Math.abs(chin.y - hairlineY);

  const hw = faceHeight / faceWidth; // height/width ratio

  let jawWidth = faceWidth * 0.7; // fallback
  if (c8L && c8R) jawWidth = Math.abs(c8R.x - c8L.x);

  const jawRatio = jawWidth / faceWidth; // jaw width relative to cheekbones

  if (hw < 1.1)  return 'Round';
  if (hw > 1.55) return 'Oblong';
  if (jawRatio > 0.90) return 'Square';
  if (jawRatio < 0.68) return 'Heart';
  if (hw > 1.35) return 'Oval';
  return 'Diamond';
}

export function computeOverallScore(scores: GeometricScores): number {
  const w = {
    symmetry: 0.12, goldenRatio: 0.08, facialThirds: 0.08,
    jawline: 0.18, eyes: 0.20, nose: 0.12, lips: 0.10, skinClarity: 0.12,
  };
  const raw =
    scores.symmetry     * w.symmetry     +
    scores.goldenRatio  * w.goldenRatio  +
    scores.facialThirds * w.facialThirds +
    scores.jawline      * w.jawline      +
    scores.eyes         * w.eyes         +
    scores.nose         * w.nose         +
    scores.lips         * w.lips         +
    scores.skinClarity  * w.skinClarity;
  // Final deflation pass on overall
  const deflated = raw <= 4 ? raw : 4 + (raw - 4) * 0.72;
  return Math.round(deflated * 10) / 10;
}
