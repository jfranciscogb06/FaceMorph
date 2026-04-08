// Face++ API client — 106-point landmark detection + attributes

const FACEPP_ENDPOINT = 'https://api-us.faceplusplus.com/facepp/v3/detect';

export interface FPLandmarks {
  [key: string]: { x: number; y: number };
}

export interface FPSkinStatus {
  health: number;       // 0-100, higher = healthier
  stain: number;        // 0-100, higher = more pigmentation (bad)
  dark_circle: number;  // 0-100, higher = darker circles (bad)
  acne: number;         // 0-100, higher = more acne (bad)
}

export interface FPQuality {
  blur: number;       // 0-100, higher = more blur (bad)
  exposure: number;   // 0-100, ideal ~50
  noise: number;      // 0-100, higher = more noise (bad)
  score: number;      // 0-100, overall quality (higher = better)
}

export interface FPHeadPose {
  pitch_angle: number; // looking up/down, ideal ~0
  roll_angle: number;  // head tilt left/right, ideal ~0
  yaw_angle: number;   // left/right turn, ideal ~0
}

export interface FPResult {
  landmarks: FPLandmarks;
  skinStatus: FPSkinStatus;
  quality: FPQuality;
  headPose: FPHeadPose;
  beautyScore: number;       // 0-100 composite beauty score
  faceShape: string;         // oval, circle, rectangle, rhombus, triangle, square, heart
  faceRect: { top: number; left: number; width: number; height: number };
}

export interface FPQualityError {
  code: 'QUALITY' | 'NO_FACE';
  message: string;
}

export async function detectWithFacePP(
  base64Image: string,
  gender: 'male' | 'female',
): Promise<FPResult | FPQualityError> {
  const apiKey = process.env.FACEPP_API_KEY;
  const apiSecret = process.env.FACEPP_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('FACEPP_API_KEY / FACEPP_API_SECRET not configured');
  }

  const form = new URLSearchParams();
  form.append('api_key', apiKey);
  form.append('api_secret', apiSecret);
  form.append('image_base64', base64Image);
  form.append('return_landmark', '2'); // 106 points
  form.append('return_attributes', 'beauty,skinstatus,facequality,headpose,blur,faceshape');

  const res = await fetch(FACEPP_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  const data = await res.json();

  if (data.error_message) {
    throw new Error(`Face++ API error: ${data.error_message}`);
  }

  if (!data.faces || data.faces.length === 0) {
    return { code: 'NO_FACE', message: 'No face detected in photo. Make sure your face is clearly visible.' };
  }

  const face = data.faces[0];
  const attrs = face.attributes || {};

  // Quality gate: reject extremely blurry or heavily angled photos
  const quality: FPQuality = {
    blur: attrs.blur?.blurness?.value ?? 0,
    exposure: attrs.facequality?.exposure ?? 50,
    noise: attrs.facequality?.noise ?? 0,
    score: attrs.facequality?.score ?? 70,
  };

  const headPose: FPHeadPose = {
    pitch_angle: attrs.headpose?.pitch_angle ?? 0,
    roll_angle: attrs.headpose?.roll_angle ?? 0,
    yaw_angle: attrs.headpose?.yaw_angle ?? 0,
  };

  if (Math.abs(headPose.yaw_angle) > 30 || Math.abs(headPose.pitch_angle) > 25) {
    return {
      code: 'QUALITY',
      message: `Head angle too extreme (yaw: ${headPose.yaw_angle.toFixed(0)}°, pitch: ${headPose.pitch_angle.toFixed(0)}°). Look straight at the camera.`,
    };
  }

  if (quality.score < 25) {
    return {
      code: 'QUALITY',
      message: 'Photo quality too low (too blurry or poor lighting). Please retake the photo.',
    };
  }

  const skinStatus: FPSkinStatus = {
    health: attrs.skinstatus?.health ?? 60,
    stain: attrs.skinstatus?.stain ?? 20,
    dark_circle: attrs.skinstatus?.dark_circle ?? 20,
    acne: attrs.skinstatus?.acne ?? 10,
  };

  // Beauty score — use gender-appropriate score, normalize 0-100 → 0-10
  const rawBeauty = gender === 'male'
    ? (attrs.beauty?.male_score ?? 50)
    : (attrs.beauty?.female_score ?? 50);

  // Face shape from attributes
  const faceShapeRaw = attrs.faceshape?.details?.[0]?.value
    ?? attrs.faceshape?.value
    ?? 'oval';

  return {
    landmarks: face.landmark || {},
    skinStatus,
    quality,
    headPose,
    beautyScore: rawBeauty,
    faceShape: mapFaceShape(faceShapeRaw),
    faceRect: face.face_rectangle,
  };
}

function mapFaceShape(raw: string): string {
  const map: Record<string, string> = {
    circle: 'Round', oval: 'Oval', rectangle: 'Oblong',
    rhombus: 'Diamond', triangle: 'Heart', square: 'Square', heart: 'Heart',
  };
  return map[raw?.toLowerCase()] ?? 'Oval';
}
