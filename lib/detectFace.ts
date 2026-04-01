import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function detectFace(base64: string): Promise<any> {
  // Native modules — loaded at runtime, excluded from bundle via serverExternalPackages
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@tensorflow/tfjs-node');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const faceapi = require('@vladmandic/face-api');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const canvasPkg = require('canvas');
  const { createCanvas, loadImage } = canvasPkg;

  faceapi.env.monkeyPatch({
    Canvas: canvasPkg.Canvas,
    Image: canvasPkg.Image,
    ImageData: canvasPkg.ImageData,
  });

  const MODEL_PATH = path.join(process.cwd(), 'node_modules/@vladmandic/face-api/model');
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);

  const buf = Buffer.from(base64, 'base64');
  const img = await loadImage(buf);
  const canvas = createCanvas(img.width, img.height);
  canvas.getContext('2d').drawImage(img, 0, 0);

  const detection = await faceapi
    .detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
    .withFaceLandmarks();

  if (!detection) {
    return { error: 'No face detected' };
  }

  const pts = detection.landmarks.positions;
  const W = img.width, H = img.height;

  const pt  = (i: number) => ({ x: pts[i].x / W, y: pts[i].y / H });
  const avg = (indices: number[]) => ({
    x: indices.reduce((s: number, i: number) => s + pts[i].x, 0) / indices.length / W,
    y: indices.reduce((s: number, i: number) => s + pts[i].y, 0) / indices.length / H,
  });

  const box = detection.detection.box;
  const leftEyeCenter  = avg([42, 43, 44, 45, 46, 47]);
  const rightEyeCenter = avg([36, 37, 38, 39, 40, 41]);
  const avgBrowY = (
    avg([22, 23, 24, 25, 26]).y +
    avg([17, 18, 19, 20, 21]).y
  ) / 2;
  const browToNose = pts[33].y - avgBrowY;
  const hairlineY_px = avgBrowY - browToNose * 0.95;
  const hairline = {
    x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
    y: Math.max(hairlineY_px, box.top) / H,
  };

  const chinCandidates = [5, 6, 7, 8, 9, 10, 11];
  const chinSorted = [...chinCandidates].sort((a, b) => pts[b].y - pts[a].y);
  const chinBottomThree = chinSorted.slice(0, 3);
  const chin_tip = {
    x: chinBottomThree.reduce((s: number, i: number) => s + pts[i].x, 0) / 3 / W,
    y: pts[chinSorted[0]].y / H,
  };

  const landmarks = [
    { id: 'hairline',           ...hairline },
    { id: 'left_brow',          ...avg([22, 23, 24, 25, 26]) },
    { id: 'right_brow',         ...avg([17, 18, 19, 20, 21]) },
    { id: 'left_pupil',         ...leftEyeCenter },
    { id: 'right_pupil',        ...rightEyeCenter },
    { id: 'nose_bridge',        ...pt(27) },
    { id: 'nose_tip',           ...pt(33) },
    { id: 'left_nostril',       ...pt(35) },
    { id: 'right_nostril',      ...pt(31) },
    { id: 'left_mouth_corner',  ...pt(54) },
    { id: 'right_mouth_corner', ...pt(48) },
    { id: 'upper_lip',          ...pt(51) },
    { id: 'lower_lip',          ...pt(57) },
    { id: 'chin_tip',           ...chin_tip },
    { id: 'left_jaw',           ...pt(12) },
    { id: 'right_jaw',          ...pt(4)  },
    { id: 'left_cheek',         ...pt(15) },
    { id: 'right_cheek',        ...pt(1)  },
  ];

  return { landmarks };
}
