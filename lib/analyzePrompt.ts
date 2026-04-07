interface LandmarkPoint { id: string; x: number; y: number; }

function computeMeasurements(landmarks: LandmarkPoint[]): string {
  const lm: Record<string, LandmarkPoint> = {};
  for (const l of landmarks) lm[l.id] = l;

  const lines: string[] = [];

  // Face width and height
  const faceW = lm.left_jaw && lm.right_jaw ? Math.abs(lm.right_jaw.x - lm.left_jaw.x) : null;
  const faceH = lm.hairline && lm.chin_tip ? Math.abs(lm.chin_tip.y - lm.hairline.y) : null;

  if (faceW && faceH && faceW > 0) {
    const ratio = faceH / faceW;
    lines.push(`Face H/W ratio: ${ratio.toFixed(2)} (Oval ~1.35, Round <1.1, Oblong >1.5)`);
  }

  // Interpupillary distance vs cheekbone width
  if (lm.left_pupil && lm.right_pupil && lm.left_cheek && lm.right_cheek) {
    const ipd = Math.abs(lm.right_pupil.x - lm.left_pupil.x);
    const cbw = Math.abs(lm.right_cheek.x - lm.left_cheek.x);
    if (cbw > 0) {
      lines.push(`Eye spacing / cheekbone width: ${(ipd / cbw).toFixed(3)} (ideal ~0.46)`);
    }
  }

  // Facial thirds (hairline→brow, brow→nose tip, nose tip→chin)
  if (lm.hairline && lm.left_brow && lm.nose_tip && lm.chin_tip) {
    const total = Math.abs(lm.chin_tip.y - lm.hairline.y);
    if (total > 0) {
      const upper = Math.abs(lm.left_brow.y - lm.hairline.y) / total;
      const mid   = Math.abs(lm.nose_tip.y  - lm.left_brow.y) / total;
      const lower = Math.abs(lm.chin_tip.y  - lm.nose_tip.y)  / total;
      lines.push(`Facial thirds — upper:${(upper*100).toFixed(0)}% mid:${(mid*100).toFixed(0)}% lower:${(lower*100).toFixed(0)}% (ideal: 33/33/33)`);
    }
  }

  // Jaw width vs cheekbone width
  if (faceW && lm.left_cheek && lm.right_cheek) {
    const cbw = Math.abs(lm.right_cheek.x - lm.left_cheek.x);
    if (cbw > 0) {
      lines.push(`Jaw/cheekbone ratio: ${(faceW / cbw).toFixed(3)} (Heart <0.75, Square ~1.0)`);
    }
  }

  // Horizontal symmetry: average absolute deviation of paired landmarks from midline
  const pairs: [string, string][] = [
    ['left_brow', 'right_brow'],
    ['left_pupil', 'right_pupil'],
    ['left_nostril', 'right_nostril'],
    ['left_mouth_corner', 'right_mouth_corner'],
    ['left_jaw', 'right_jaw'],
    ['left_cheek', 'right_cheek'],
  ];
  const midlineX = lm.left_pupil && lm.right_pupil
    ? (lm.left_pupil.x + lm.right_pupil.x) / 2
    : null;
  if (midlineX !== null) {
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
      const avgAsymmetry = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      lines.push(`Horizontal symmetry deviation: ${(avgAsymmetry * 100).toFixed(1)}% (lower = more symmetric)`);
    }
  }

  // Mouth width vs eye width
  if (lm.left_mouth_corner && lm.right_mouth_corner && lm.left_pupil && lm.right_pupil) {
    const mw = Math.abs(lm.right_mouth_corner.x - lm.left_mouth_corner.x);
    const ew = Math.abs(lm.right_pupil.x - lm.left_pupil.x);
    if (ew > 0) {
      lines.push(`Mouth/eye width ratio: ${(mw / ew).toFixed(3)} (ideal ~1.6)`);
    }
  }

  return lines.length > 0
    ? '\n\nPre-computed facial measurements:\n' + lines.map(l => `• ${l}`).join('\n')
    : '';
}

export function buildAnalysisPrompt(gender: string, ethnicity: string[], landmarks: LandmarkPoint[] | null): string {
  const measurements = landmarks && landmarks.length >= 8
    ? computeMeasurements(landmarks)
    : '';

  const ethnicityStr = ethnicity.length > 0 ? ` of ${ethnicity.join('/')} background` : '';

  return `You are a professional facial analyst. Analyze the photo of a ${gender}${ethnicityStr} and score their facial features compared to the general population of the same gender and ethnicity.${measurements}

The symmetry, goldenRatio, and facialThirds scores have already been computed mathematically from landmarks — do NOT score them.

Use the pre-computed measurements above to inform faceShape — do not contradict them.

Score these five visual metrics on a 1–10 scale with one decimal place. Always compare to the general population of the same gender/ethnicity — not to models or celebrities. Be consistent: the same face should always receive the same score.

Population calibration — follow this strictly:
• A score of 5.0 = exactly average for the population. Most people score 4–6 on most metrics.
• Scores of 7+ require genuinely above-average features (top 25%). Do not give 7 to average features.
• Scores of 8+ are rare — top 10%. Clearly exceptional features only.
• Scores of 9–10 are very rare — top 3%. Near-perfect only.
• Scores below 4 should be used when features are genuinely below average — don't round up to avoid low scores.
• Be honest: an ugly jawline should score 3–4, not 5–6. A weak chin is a 3, not a 5.
• Do not give everyone similar scores. Spread scores across the full range based on what you actually see.

Scoring anchors:
• jawline — 9-10: razor-sharp, chiseled, textbook definition | 7-8: clearly defined, visible angularity | 5-6: average definition, slightly soft | 3-4: notably soft/round, poor definition | 1-2: virtually undefined
• eyes — 9-10: large, almond-shaped, ideal spacing, positive canthal tilt | 7-8: above average shape/size | 5-6: average shape and size | 3-4: small, hooded, close-set, or drooping | 1-2: significantly below average
• nose — 9-10: perfectly proportioned, straight, refined tip | 7-8: minor deviation, overall good | 5-6: average, no major issues | 3-4: notable width, bulbous tip, or asymmetry | 1-2: significant structural issue
• lips — 9-10: full, well-defined Cupid's bow, ideal ratio | 7-8: above average fullness and shape | 5-6: average | 3-4: thin, flat, or notably uneven | 1-2: very thin/barely defined
• skinClarity — 9-10: flawless, smooth, even tone | 7-8: clear with minimal texture | 5-6: average texture or mild blemishes | 3-4: visible acne, scarring, or uneven texture | 1-2: significant skin concerns

The scores inside detailedAnalysis must exactly match the values in the scores object.
Do not include overallScore — it will be computed from the scores above.

Respond with ONLY a valid JSON object — no prose, no markdown, no explanation. The "_obs" field must be filled first and drives the scores — commit to your observations before assigning numbers:
{
  "_obs": {
    "jawline": "<describe exactly what you see: bone structure, definition level, angle sharpness>",
    "eyes": "<describe shape, size, spacing, lid type>",
    "nose": "<describe width, tip shape, bridge straightness, projection>",
    "lips": "<describe fullness, Cupid's bow, upper-to-lower ratio>",
    "skinClarity": "<describe texture, blemishes, evenness of tone>"
  },
  "scores": {
    "jawline": <number 1-10>,
    "eyes": <number 1-10>,
    "nose": <number 1-10>,
    "lips": <number 1-10>,
    "skinClarity": <number 1-10>
  },
  "faceShape": "<Oval|Round|Square|Heart|Diamond|Oblong|Triangle>",
  "styleCategory": "<Sharp|Balanced|Soft|Angular|Classic>",
  "strengths": ["<2-4 specific observations about visible facial features>"],
  "improvements": ["<2-4 actionable grooming or skincare suggestions>"],
  "recommendations": [
    {
      "category": "<skincare|grooming|hairstyle|exercise|lifestyle>",
      "title": "<short title>",
      "description": "<1-2 sentences of specific advice tailored to this person's features>",
      "priority": "<high|medium|low>"
    }
  ],
  "detailedAnalysis": [
    {
      "feature": "<Eyes|Nose|Lips|Jawline|Cheekbones|Forehead|Skin|Face Shape>",
      "score": <number 1-10>,
      "observation": "<specific observation about what is visible in the photo>",
      "tip": "<one concrete grooming or styling tip>"
    }
  ]
}`;
}
