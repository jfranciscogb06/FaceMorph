#!/usr/bin/env node
// Standalone face detection script — called as a child process from the API route.
// Reads base64 image from stdin, writes JSON landmarks to stdout.

const path = require('path');
require('@tensorflow/tfjs-node');
const faceapi = require('@vladmandic/face-api');
const canvasPkg = require('canvas');
const { createCanvas, loadImage } = canvasPkg;

faceapi.env.monkeyPatch({
  Canvas: canvasPkg.Canvas,
  Image: canvasPkg.Image,
  ImageData: canvasPkg.ImageData,
});

// face-api 68-point landmark index reference (viewer's perspective):
// 0-16:  jaw contour (0=person's right ear, 4=right jaw angle/gonion, 8=chin tip, 12=left jaw angle/gonion, 16=person's left ear)
//        pts[1]/pts[15] ≈ upper jaw / cheekbone level
//        pts[4]/pts[12] = gonion (jaw angle)
// 17-21: person's right eyebrow (lower x in image)
// 22-26: person's left eyebrow  (higher x in image)
// 27-30: nose bridge (27=top, 30=bottom)
// 31-35: nose base  (31=person's right nostril, 33=tip, 35=person's left nostril)
// 36-41: person's right eye (lower x)
// 42-47: person's left eye  (higher x)
// 48-67: mouth (48=person's right corner, 51=upper lip center, 54=person's left corner, 57=lower lip center)

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const base64 = Buffer.concat(chunks).toString().trim();

  const MODEL_PATH = path.join(__dirname, '../node_modules/@vladmandic/face-api/model');
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
    process.stdout.write(JSON.stringify({ error: 'No face detected' }));
    process.exit(0);
  }

  const pts = detection.landmarks.positions;
  const W = img.width, H = img.height;

  const pt  = (i)       => ({ x: pts[i].x / W, y: pts[i].y / H });
  const avg = (indices) => ({
    x: indices.reduce((s, i) => s + pts[i].x, 0) / indices.length / W,
    y: indices.reduce((s, i) => s + pts[i].y, 0) / indices.length / H,
  });

  // Hairline: bounding box top is unreliable for curly/voluminous hair — it can land
  // deep inside the hair mass. Instead, estimate from stable facial landmarks:
  // place the hairline one "brow-to-nose" distance above the average brow level.
  // This is hairstyle-independent and approximates equal facial thirds as a prior.
  // The user can always drag the dot to their exact hairline.
  const box = detection.detection.box;
  const leftEyeCenter  = avg([42, 43, 44, 45, 46, 47]);
  const rightEyeCenter = avg([36, 37, 38, 39, 40, 41]);
  const avgBrowY = (
    avg([22, 23, 24, 25, 26]).y +
    avg([17, 18, 19, 20, 21]).y
  ) / 2;
  const browToNose = pts[33].y - avgBrowY; // middle-third height in px
  const hairlineY_px = avgBrowY - browToNose * 0.95;
  // Don't place above the bounding box top (can't be outside the detected face region)
  const hairline = {
    x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
    y: Math.max(hairlineY_px, box.top) / H,
  };

  // Chin tip: scan pts 5-11 (full bottom jaw arc) for the absolute lowest point.
  // Average x of the bottom 3 for stability, take the max y found.
  const chinCandidates = [5, 6, 7, 8, 9, 10, 11];
  const chinSorted = [...chinCandidates].sort((a, b) => pts[b].y - pts[a].y);
  const chinBottomThree = chinSorted.slice(0, 3);
  const chin_tip = {
    x: chinBottomThree.reduce((s, i) => s + pts[i].x, 0) / 3 / W,
    y: pts[chinSorted[0]].y / H,
  };

  const landmarks = [
    { id: 'hairline',           ...hairline },
    { id: 'left_brow',          ...avg([22, 23, 24, 25, 26]) }, // person's left brow
    { id: 'right_brow',         ...avg([17, 18, 19, 20, 21]) }, // person's right brow
    { id: 'left_pupil',         ...leftEyeCenter },
    { id: 'right_pupil',        ...rightEyeCenter },
    { id: 'nose_bridge',        ...pt(27) },
    { id: 'nose_tip',           ...pt(33) },
    { id: 'left_nostril',       ...pt(35) },   // person's left nostril (higher x)
    { id: 'right_nostril',      ...pt(31) },   // person's right nostril (lower x)
    { id: 'left_mouth_corner',  ...pt(54) },   // person's left corner (higher x)
    { id: 'right_mouth_corner', ...pt(48) },   // person's right corner (lower x)
    { id: 'upper_lip',          ...pt(51) },
    { id: 'lower_lip',          ...pt(57) },
    { id: 'chin_tip',           ...chin_tip }, // lowest point among pts 7-9
    { id: 'left_jaw',           ...pt(12) },   // person's left gonion/jaw angle (higher x)
    { id: 'right_jaw',          ...pt(4)  },   // person's right gonion/jaw angle (lower x)
    { id: 'left_cheek',         ...pt(15) },   // person's left upper jaw / cheekbone level (higher x)
    { id: 'right_cheek',        ...pt(1)  },   // person's right upper jaw / cheekbone level (lower x)
  ];

  process.stdout.write(JSON.stringify({ landmarks }));
}

main().catch(e => {
  process.stdout.write(JSON.stringify({ error: e.message }));
  process.exit(1);
});
