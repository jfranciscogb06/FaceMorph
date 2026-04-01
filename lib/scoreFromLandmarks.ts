interface LandmarkPoint { id: string; x: number; y: number; }

function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x <= x0) return y0;
  if (x >= x1) return y1;
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
}

function round1(n: number) { return Math.round(n * 10) / 10; }

export function computeObjectiveScores(landmarks: LandmarkPoint[]): {
  symmetry: number;
  goldenRatio: number;
  facialThirds: number;
} {
  const lm: Record<string, LandmarkPoint> = {};
  for (const l of landmarks) lm[l.id] = l;

  // ── Symmetry ──────────────────────────────────────────────────────────
  // Average relative asymmetry across paired landmarks, as a percentage.
  // Lower % = more symmetric = higher score.
  let symmetry = 6.0;
  const midlineX = lm.left_pupil && lm.right_pupil
    ? (lm.left_pupil.x + lm.right_pupil.x) / 2
    : null;
  if (midlineX !== null) {
    const pairs: [string, string][] = [
      ['left_brow', 'right_brow'],
      ['left_pupil', 'right_pupil'],
      ['left_nostril', 'right_nostril'],
      ['left_mouth_corner', 'right_mouth_corner'],
      ['left_jaw', 'right_jaw'],
      ['left_cheek', 'right_cheek'],
    ];
    const diffs: number[] = [];
    for (const [l, r] of pairs) {
      if (lm[l] && lm[r]) {
        const lDist = Math.abs(lm[l].x - midlineX);
        const rDist = Math.abs(lm[r].x - midlineX);
        const max = Math.max(lDist, rDist);
        if (max > 0) diffs.push(Math.abs(lDist - rDist) / max);
      }
    }
    if (diffs.length > 0) {
      const pct = (diffs.reduce((a, b) => a + b, 0) / diffs.length) * 100;
      if (pct <= 6)        symmetry = lerp(pct, 0,  6,  10,  8);
      else if (pct <= 12)  symmetry = lerp(pct, 6,  12,  8,  6);
      else if (pct <= 20)  symmetry = lerp(pct, 12, 20,  6,  4.5);
      else                 symmetry = lerp(pct, 20, 35,  4.5, 2.5);
    }
  }

  // ── Golden Ratio ──────────────────────────────────────────────────────
  // Inter-pupillary distance / cheekbone width vs ideal 0.46.
  let goldenRatio = 6.0;
  if (lm.left_pupil && lm.right_pupil && lm.left_cheek && lm.right_cheek) {
    const ipd = Math.abs(lm.right_pupil.x - lm.left_pupil.x);
    const cbw = Math.abs(lm.right_cheek.x - lm.left_cheek.x);
    if (cbw > 0) {
      const delta = Math.abs(ipd / cbw - 0.46);
      if (delta <= 0.01)       goldenRatio = lerp(delta, 0,    0.01, 10,  8);
      else if (delta <= 0.03)  goldenRatio = lerp(delta, 0.01, 0.03,  8,  6.5);
      else if (delta <= 0.06)  goldenRatio = lerp(delta, 0.03, 0.06,  6.5, 5);
      else                     goldenRatio = lerp(delta, 0.06, 0.15,  5,   2.5);
    }
  }

  // ── Facial Thirds ─────────────────────────────────────────────────────
  // Max deviation of any third from the ideal 33.3%.
  let facialThirds = 6.0;
  if (lm.hairline && lm.left_brow && lm.nose_tip && lm.chin_tip) {
    const total = Math.abs(lm.chin_tip.y - lm.hairline.y);
    if (total > 0) {
      const upper = Math.abs(lm.left_brow.y - lm.hairline.y) / total;
      const mid   = Math.abs(lm.nose_tip.y  - lm.left_brow.y) / total;
      const lower = Math.abs(lm.chin_tip.y  - lm.nose_tip.y)  / total;
      const maxDev = Math.max(
        Math.abs(upper - 1/3),
        Math.abs(mid   - 1/3),
        Math.abs(lower - 1/3),
      ) * 100;
      if (maxDev <= 3)       facialThirds = lerp(maxDev, 0,  3, 10,  8);
      else if (maxDev <= 6)  facialThirds = lerp(maxDev, 3,  6,  8,  6.5);
      else if (maxDev <= 10) facialThirds = lerp(maxDev, 6, 10,  6.5, 4.5);
      else                   facialThirds = lerp(maxDev, 10, 18,  4.5, 3);
    }
  }

  return {
    symmetry:     round1(symmetry),
    goldenRatio:  round1(goldenRatio),
    facialThirds: round1(facialThirds),
  };
}

export function computeOverallScore(scores: {
  symmetry: number; goldenRatio: number; facialThirds: number;
  jawline: number; eyes: number; nose: number; lips: number; skinClarity: number;
}): number {
  const w = {
    symmetry: 0.15, goldenRatio: 0.15, facialThirds: 0.10,
    jawline: 0.15, eyes: 0.15, nose: 0.10, lips: 0.10, skinClarity: 0.10,
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
  return Math.round(raw * 10) / 10;
}
