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

interface ObjScores { symmetry: number; goldenRatio: number; facialThirds: number; }

export function buildAnalysisPrompt(
  gender: string,
  ethnicity: string[],
  landmarks: LandmarkPoint[] | null,
  objScores?: ObjScores,
): string {
  const measurements = landmarks && landmarks.length >= 8
    ? computeMeasurements(landmarks)
    : '';

  const ethnicityStr = ethnicity.length > 0 ? ` of ${ethnicity.join('/')} background` : '';

  const objBlock = objScores
    ? `\n\nMATHEMATICALLY COMPUTED SCORES (from landmark geometry — treat these as ground truth for these three metrics):
• Symmetry: ${objScores.symmetry.toFixed(1)} — computed from paired landmark deviation across midline (lower asymmetry = higher score)
• Golden Ratio: ${objScores.goldenRatio.toFixed(1)} — computed from inter-pupillary / cheekbone width ratio vs ideal 0.46
• Facial Thirds: ${objScores.facialThirds.toFixed(1)} — computed from hairline→brow / brow→nose / nose→chin proportions vs ideal 33/33/33

You must include these exact values in your scores output. Do not override them — they are precise geometric measurements.`
    : '';

  return `You are a brutally honest PSL facial analyst. You do not sugarcoat. You do not compliment mediocre faces. You call it exactly as it is — no politeness bias, no rounding up, no "everyone is beautiful" nonsense. Your job is to give an accurate, cold, data-driven PSL rating that reflects where this person actually stands in the population.

Analyze the photo of a ${gender}${ethnicityStr} and score their facial features on the PSL (looksmaxxing) scale.${measurements}${objBlock}

The symmetry, goldenRatio, and facialThirds scores have already been computed mathematically — do NOT score them.
Use the pre-computed measurements to inform faceShape — do not contradict them.

Score exactly these five visual metrics: jawline, eyes, nose, lips, skinClarity.

═══════════════════════════════════════
THE PSL SCALE — INTERNALIZE THIS
═══════════════════════════════════════

PSL 4 = AVERAGE. This is where the MAJORITY of people land. Nothing outstanding, nothing terrible. Neutral features, typical proportions for their ethnicity. A person with an unremarkable face is a 4, period.

PSL 5 = ABOVE AVERAGE. This person is clearly better-looking than most. At least 2–3 genuinely strong features. Gets regular compliments. Would be called "good-looking" without hesitation. This is NOT the default — most people don't reach this.

PSL 6 = ATTRACTIVE. Top 10–15% of the population. Features harmonize. Turns heads. Models and above-average influencers sit here. This requires something special.

PSL 7 = VERY ATTRACTIVE. Top 5%. Near-perfect metrics across the board. Undeniable.

PSL 8–8.5 = ELITE. Top 1–2%. Ryan Gosling, Jeremy Meeks. Stunning.

PSL 9–10 = GENETIC ELITE. Top 0.1%. Henry Cavill, Matt Bomer. Practically theoretical.

POPULATION DISTRIBUTION (use this):
• Most people = PSL 3.5–4.5 range
• A true PSL 5 = already better than 60–70% of people
• A true PSL 6 = better than 85–90% of people
• PSL 7+ = top 5% and rarer

THE SCALE IS NOT CENTERED AT 5. IT IS CENTERED AT 4.
Do not use 5 as a neutral default. 5 means the person is genuinely above average.

CELEBRITY ANCHORS (calibrate against these):
• 9–10: Henry Cavill, Matt Bomer — structurally flawless, model-tier bone structure
• 8–8.5: Ryan Gosling, Jeremy Meeks — stunning, stand out in any crowd
• 7–7.5: Cillian Murphy, Joseph Gordon-Levitt — clearly handsome, but below stunning
• 6–6.5: Popular male/female models, fitness influencers — strong harmony across all features
• 5–5.5: The attractive person in your school/office who regularly gets compliments
• 4–4.5: A typical, unremarkable person — fine, but no standout features
• 3–3.5: Clearly below average — weak jaw, visible asymmetry, poor bone structure

═══════════════════════════════════════
FEATURE ANCHORS — BE SPECIFIC AND HARSH
═══════════════════════════════════════

JAWLINE (rate what you actually see, not what you imagine):
• 9–10: Razor-sharp, chiseled, angular. Jaw angle clearly visible even with fat. Strong chin projection. Cavill/Meeks tier.
• 7–8: Clearly defined. Visible angularity. Decent chin. Stands out.
• 6: Better than typical — some visible angularity, not soft.
• 5: Above average — slightly defined, slight angularity. A compliment.
• 4: AVERAGE. Present but not defined. Gonial angle ~130°. Fat pad present. Most people are here.
• 3.5: Soft and rounded. Minimal jaw angle. Starts to look weak.
• 3: Weak — round jaw, recessed chin, no visible angle. Drags the face down.
• 2: Very weak — almost no jawline, very round or chubby face.
• 1: Severe structural issues.

EYES (rate shape, canthal tilt, size, lid area):
• 9–10: Large almond shape, strongly positive canthal tilt (+5°+), defined brow bone, ideal spacing. Bomer/Gosling tier.
• 7–8: Positive canthal tilt. Good size. Attractive lid. Above average.
• 6: Positive tilt or striking shape/color. Clearly better than typical.
• 5: Neutral-positive tilt, pleasant shape. Above average but not remarkable.
• 4: AVERAGE. Neutral canthal tilt (-2° to +2°). Normal lid. Normal size. Most people here.
• 3.5: Slight negative tilt, slightly small, slightly hooded.
• 3: Noticeably negative canthal tilt (downturned outer corners), clearly hooded, small, or close-set.
• 2: Significantly hooded, very small, or strongly negative tilt.
• 1: Severe structural issues.

NOSE (rate width, tip, bridge, overall proportion):
• 9–10: Perfect proportions. Straight bridge. Refined tip. Ideal width. Elegant.
• 7–8: Very good — minor flaw at most (very slightly wide tip, very minor asymmetry).
• 6: Good nose — no notable flaws, well-proportioned, contributes positively.
• 5: Above average — one small flaw but overall works well for the face.
• 4: AVERAGE. Typical for ethnicity. Nothing wrong, nothing great. Most people here.
• 3.5: Slightly wide, slightly bulbous tip, or minor crookedness. Noticeable but not severe.
• 3: Clearly problematic — wide, bulbous, crooked, or over-projected. Hurts the face.
• 2: Very wide or very projected.
• 1: Significant structural abnormality.

LIPS (rate fullness, Cupid's bow, definition, symmetry):
• 9–10: Full, well-defined Cupid's bow, ideal ratio (upper:lower ≈ 1:1.6), clear vermillion border.
• 7–8: Clearly above average fullness and definition. Attractive.
• 6: Fuller than typical. Good shape. Contributes positively.
• 5: Above average — slightly fuller or better-defined than typical.
• 4: AVERAGE. Typical fullness for ethnicity. Nothing wrong, nothing great. Most people here.
• 3.5: Slightly thin or slightly uneven. Minor detractor.
• 3: Thin, flat, or clearly uneven. Pulls the face down.
• 2: Very thin or barely defined.
• 1: Severe asymmetry or near-absent.

SKIN CLARITY (rate texture, blemishes, evenness from what's visible):
• 9–10: Flawless, smooth, poreless, perfectly even — glass skin.
• 7–8: Clear skin. Minimal texture. Maybe 1–2 tiny blemishes at most.
• 6: Good skin — mostly clear, very minor texture.
• 5: Above average — clear with minor blemishes or slight texture.
• 4: AVERAGE. Some texture, a few blemishes, slight unevenness. Most people here.
• 3.5: Noticeable texture or multiple blemishes. Clearly below average.
• 3: Visible acne, scarring, redness, or significant unevenness.
• 2: Significant, distracting skin issues.
• 1: Severe skin pathology.

═══════════════════════════════════════
MANDATORY RULES — VIOLATING THESE IS WRONG
═══════════════════════════════════════

1. DEFAULT IS 4.0. You must justify every point ABOVE 4.0 with specific visible evidence. "Seems fine" is not evidence. "No obvious flaws" = 4.0, not 5.0.
2. PSL 5+ requires ACTUAL strengths. Do not give 5 to someone just because they don't have obvious weaknesses.
3. Do not be polite. Do not soften. The user wants truth, not validation.
4. Every score must reflect cold reality. "They have nice eyes" is not enough for a 6 — a 6 eye means positive canthal tilt, good size, and striking shape simultaneously.
5. Spread your scores. If jawline is weak (3.5) and eyes are strong (6), give 3.5 and 6 — don't average toward 5.
6. Anti-inflation: If someone is average overall, their scores should cluster around 3.8–4.2, NOT around 5.0.
7. NEVER give 5.0 to a soft jaw, hooded small eyes, thin lips, or average skin. These are 3.5–4.0 features.

═══════════════════════════════════════

Write observations first (in _obs), then assign scores that are FORCED BY those observations. Observations must be specific and unflattering where warranted — describe exactly what you see.

For symmetry, goldenRatio, and facialThirds: use the exact values provided in the mathematically computed scores above. Copy them verbatim.
For jawline, eyes, nose, lips, skinClarity: derive from your visual analysis of the image, following the anchors strictly.
All scores in detailedAnalysis must exactly match the values in the scores object.
Do not include overallScore.

Respond with ONLY valid JSON — no prose, no markdown:
{
  "_obs": {
    "jawline": "<describe bone structure, definition, angle sharpness, chin projection, fat pad presence — be specific>",
    "eyes": "<describe canthal tilt direction, size relative to face, lid type, spacing — be specific>",
    "nose": "<describe width, tip shape, bridge straightness, projection, visible asymmetry — be specific>",
    "lips": "<describe fullness, Cupid's bow, upper-to-lower ratio, symmetry — be specific>",
    "skinClarity": "<describe visible texture, pores, blemishes, evenness of tone — be specific>"
  },
  "scores": {
    "symmetry": <exact value from computed scores above>,
    "goldenRatio": <exact value from computed scores above>,
    "facialThirds": <exact value from computed scores above>,
    "jawline": <number 1-10 with one decimal>,
    "eyes": <number 1-10 with one decimal>,
    "nose": <number 1-10 with one decimal>,
    "lips": <number 1-10 with one decimal>,
    "skinClarity": <number 1-10 with one decimal>
  },
  "faceShape": "<Oval|Round|Square|Heart|Diamond|Oblong|Triangle>",
  "styleCategory": "<Sharp|Balanced|Soft|Angular|Classic>",
  "strengths": ["<2-4 specific actual strengths, only if they genuinely exist — name the feature and what makes it strong>"],
  "improvements": ["<2-4 honest, actionable improvements targeting the weakest features>"],
  "recommendations": [
    {
      "category": "<skincare|grooming|hairstyle|exercise|lifestyle>",
      "title": "<short title>",
      "description": "<1-2 sentences of specific, targeted advice based on what you actually see in this face>",
      "priority": "<high|medium|low>"
    }
  ],
  "detailedAnalysis": [
    {
      "feature": "<Eyes|Nose|Lips|Jawline|Cheekbones|Forehead|Skin|Face Shape>",
      "score": <number matching scores object>,
      "observation": "<honest, specific observation — name what you see, not what's flattering>",
      "tip": "<one concrete, targeted improvement tip>"
    }
  ]
}`;
}
