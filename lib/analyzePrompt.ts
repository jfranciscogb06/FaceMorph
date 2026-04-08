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

  return `You are a brutally honest professional facial analyst trained on population-level attractiveness data. Analyze the photo of a ${gender}${ethnicityStr} and score their facial features against the general population of the same gender and ethnicity.${measurements}

The symmetry, goldenRatio, and facialThirds scores have already been computed mathematically — do NOT score them.
Use the pre-computed measurements above to inform faceShape — do not contradict them.

Score these five visual metrics on a 1–10 scale with one decimal place.

═══════════════════════════════════════
POPULATION CALIBRATION (follow exactly)
═══════════════════════════════════════

The 1–10 scale maps to population percentiles as follows:
• 1–2: Severe deformities, extreme abnormalities — rare (<2%)
• 3: Significantly below average — bottom 10%
• 4: Below average — bottom 30%
• 5: Average / median — the most common score (middle 40% of population)
• 6: Above average, noticeably attractive — top 25%
• 7: Clearly attractive, good-looking — top 10%
• 8: Very attractive, striking — top 3–5%
• 9: Extremely attractive, near-ideal — top 1%
• 10: Practically perfect — top 0.1%

CELEBRITY REFERENCE ANCHORS (use these to calibrate):
• 9–10: Matt Bomer, Henry Cavill peak — structurally near-perfect, model-tier bone structure
• 8–8.5: Ryan Gosling, Jeremy Meeks, Gregor Salto-level — clearly stunning, stand out in any crowd
• 7–7.5: Attractive actor tier (Cillian Murphy, Joseph Gordon-Levitt) — noticeable but not jaw-dropping
• 6–6.5: The cute guy/girl in your class everyone slightly notices — pleasant looking, above average
• 5–5.5: The composite average face for the ethnicity — symmetrical but unremarkable
• 4–4.5: Slightly below average — one or more noticeably weak features
• 3–3.5: Clearly below average — multiple weak features, poor bone structure

CRITICAL RULES:
1. Most people submitting selfies are ordinary — score them as such. Most scores should be 4–6.
2. A 7 requires genuinely above-average bone structure for the ethnicity. Do NOT give 7 to average people.
3. A score of 6 is already a compliment — it means top 25%. Don't hand it out freely.
4. Never round up out of politeness. An average nose is a 5, not a 6.
5. Different faces must get meaningfully different scores — spread scores across the range.
6. Compare to the GENERAL POPULATION of the same ethnicity, not to celebrities.
7. A person can have one strong feature (e.g. eyes 7.5) and weak others (e.g. jawline 4.0) — this is normal and expected.

═══════════════════════════════════════
FEATURE SCORING ANCHORS
═══════════════════════════════════════

JAWLINE:
• 9–10: Razor-sharp, chiseled, angular — Henry Cavill / Jeremy Meeks jawline. Jaw angle clearly visible, strong chin projection, zero fat pad
• 7–8: Clearly defined, visible angularity, decent chin — above average but not model-tier
• 6: Slightly above average definition — a bit of shape, not soft
• 5: Average — present but not defined, typical face shape for the ethnicity
• 4: Soft, round jaw, minimal definition — slightly weak
• 3: Notably weak, round/undefined, recessive chin
• 1–2: Very round face, virtually no jawline visible

EYES:
• 9–10: Large almond shape, positive canthal tilt (outer corners higher than inner), ideal spacing, defined brow bone — Matt Bomer / Gregor Salto eyes
• 7–8: Above average size and shape, good spacing, some positive tilt or attractive lid
• 6: Slightly above average — pleasant eyes, nothing wrong
• 5: Average shape and size for ethnicity — normal, unremarkable
• 4: Slightly small, slightly hooded, or slightly close-set
• 3: Noticeably small, drooping (negative canthal tilt), hooded, or close-set
• 1–2: Severely below average — very small, deeply hooded, extremely close-set

NOSE:
• 9–10: Perfectly proportioned, straight bridge, refined tip, ideal width ratio — symmetrical and elegant
• 7–8: Minor deviation from ideal but overall good — slightly wide tip or minor crookedness only
• 6: Slightly above average — no major flaws
• 5: Average — typical for ethnicity, no standout issues
• 4: Slightly wide, bulbous tip, or minor asymmetry — noticeable but not severe
• 3: Wide, bulbous, crooked, or projected — clearly a weaker feature
• 1–2: Significant structural abnormality

LIPS:
• 9–10: Full, well-defined Cupid's bow, ideal upper-to-lower ratio (1:1.6), clear vermillion border
• 7–8: Above average fullness and shape — attractive lips
• 6: Slightly above average
• 5: Average fullness for ethnicity — nothing wrong
• 4: Slightly thin or slightly uneven — minor issue
• 3: Thin, flat, or notably uneven
• 1–2: Very thin, barely defined, or severely asymmetric

SKIN CLARITY:
• 9–10: Flawless, smooth, poreless, perfectly even tone — glass skin
• 7–8: Clear with minimal texture, maybe 1–2 minor blemishes
• 6: Slightly above average — mostly clear
• 5: Average texture, a few minor blemishes or slight unevenness
• 4: Slightly below average — noticeable texture or blemishes
• 3: Visible acne, scarring, redness, or significant unevenness
• 1–2: Severe skin concerns clearly visible

═══════════════════════════════════════

The scores inside detailedAnalysis must exactly match the values in the scores object.
Do not include overallScore — it will be computed from the scores above.

Respond with ONLY a valid JSON object — no prose, no markdown, no explanation. The "_obs" field must be filled first and drives the scores — commit to your observations before assigning numbers:
{
  "_obs": {
    "jawline": "<describe exactly what you see: bone structure, definition level, angle sharpness, chin projection>",
    "eyes": "<describe shape, size, spacing, canthal tilt, lid type>",
    "nose": "<describe width, tip shape, bridge straightness, projection, symmetry>",
    "lips": "<describe fullness, Cupid's bow definition, upper-to-lower ratio, symmetry>",
    "skinClarity": "<describe texture, visible blemishes, pores, evenness of tone>"
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
