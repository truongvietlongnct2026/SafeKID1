import type { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { EyeOverlayPoints } from '../types/guard';

// Average pediatric/young-user inter-pupillary distance in cm (~5.9 cm).
// Paired with iPhone 14 Plus front TrueDepth lens geometry and optional calibration.
const BASE_IPD_CM = 5.9;
const BASE_IRIS_DIAMETER_CM = 1.17;

// iPhone 14 Plus front camera has ~64 deg FOV along the longer sensor axis -> f_px ≈ 0.85 * max(W, H)
const FOCAL_LENGTH_RATIO = 0.85;

export interface DistanceEstimationOutput {
  rawDistanceCm: number | null;
  ipdPx: number | null;
  irisLeftPx: number | null;
  irisRightPx: number | null;
  faceWidthPx: number | null;
  yawCompensation: number | null;
  matrixZCm: number | null;
  overlay: EyeOverlayPoints;
}

function dist2D(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  width: number,
  height: number
): number {
  return Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
}

export function estimateFaceDistance(
  result: FaceLandmarkerResult,
  videoWidth: number,
  videoHeight: number,
  calibrationFactor: number
): DistanceEstimationOutput {
  if (
    !result.faceLandmarks ||
    result.faceLandmarks.length === 0 ||
    videoWidth <= 0 ||
    videoHeight <= 0
  ) {
    return {
      rawDistanceCm: null,
      ipdPx: null,
      irisLeftPx: null,
      irisRightPx: null,
      faceWidthPx: null,
      yawCompensation: null,
      matrixZCm: null,
      overlay: {
        leftIris: null,
        rightIris: null,
        leftOuterCorner: null,
        rightOuterCorner: null,
        faceBox: null,
        ipdPx: null,
      },
    };
  }

  const lm = result.faceLandmarks[0];
  const hasIris = lm.length >= 477;

  // Iris centers (468, 473) or fallback to midpoints of eye corners
  const leftEyeCenter = hasIris
    ? lm[468]
    : {
        x: (lm[33].x + lm[133].x) / 2,
        y: (lm[33].y + lm[133].y) / 2,
        z: (lm[33].z + lm[133].z) / 2,
        visibility: 1,
      };
  const rightEyeCenter = hasIris
    ? lm[473]
    : {
        x: (lm[362].x + lm[263].x) / 2,
        y: (lm[362].y + lm[263].y) / 2,
        z: (lm[362].z + lm[263].z) / 2,
        visibility: 1,
      };

  const ipd2dPx = dist2D(leftEyeCenter, rightEyeCenter, videoWidth, videoHeight);

  // Use MediaPipe normalized z (scaled to image width) to compensate for slight head yaw
  const dzPx = (leftEyeCenter.z - rightEyeCenter.z) * videoWidth;
  const ipd3dPx = Math.hypot(ipd2dPx, dzPx);
  const yawCompensation = ipd3dPx > 1 ? Math.min(1, Math.max(0.7, ipd2dPx / ipd3dPx)) : 1;

  // Iris horizontal diameters (left: 469-471, right: 474-476)
  const irisLeftPx = hasIris ? dist2D(lm[469], lm[471], videoWidth, videoHeight) : null;
  const irisRightPx = hasIris ? dist2D(lm[474], lm[476], videoWidth, videoHeight) : null;

  // Cheekbone-to-cheekbone face width (234 - 454)
  const faceWidthPx =
    lm[234] && lm[454] ? dist2D(lm[234], lm[454], videoWidth, videoHeight) : null;

  // Face bounding box from key perimeter landmarks
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i < Math.min(lm.length, 468); i += 4) {
    const p = lm[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  // Focal length in pixels along primary sensor axis
  const focalLengthPx = Math.max(videoWidth, videoHeight) * FOCAL_LENGTH_RATIO;

  // Primary IPD distance estimate
  let ipdDistanceCm: number | null = null;
  if (ipd3dPx > 10) {
    ipdDistanceCm = (BASE_IPD_CM * focalLengthPx) / ipd3dPx;
  }

  // Secondary iris diameter estimate (blended lightly if iris clearly resolved)
  let irisDistanceCm: number | null = null;
  if (irisLeftPx !== null && irisRightPx !== null) {
    const avgIrisPx = (irisLeftPx + irisRightPx) / 2;
    if (avgIrisPx > 6) {
      irisDistanceCm = (BASE_IRIS_DIAMETER_CM * focalLengthPx) / avgIrisPx;
    }
  }

  let rawDistanceCm: number | null = null;
  if (ipdDistanceCm !== null && irisDistanceCm !== null) {
    // 80% IPD (high pixel SNR) + 20% iris diameter
    rawDistanceCm = ipdDistanceCm * 0.8 + irisDistanceCm * 0.2;
  } else {
    rawDistanceCm = ipdDistanceCm;
  }

  if (rawDistanceCm !== null) {
    rawDistanceCm = Math.min(150, Math.max(8, rawDistanceCm * calibrationFactor));
  }

  // Extract MediaPipe Facial Transformation Matrix Z translation if available
  let matrixZCm: number | null = null;
  if (result.facialTransformationMatrixes && result.facialTransformationMatrixes.length > 0) {
    const data = result.facialTransformationMatrixes[0].data;
    if (data && data.length >= 16) {
      // Index 14 is z translation in cm (negative in front of camera)
      matrixZCm = Math.abs(data[14]);
    }
  }

  return {
    rawDistanceCm,
    ipdPx: ipd2dPx,
    irisLeftPx,
    irisRightPx,
    faceWidthPx,
    yawCompensation,
    matrixZCm,
    overlay: {
      leftIris: { x: leftEyeCenter.x, y: leftEyeCenter.y },
      rightIris: { x: rightEyeCenter.x, y: rightEyeCenter.y },
      leftOuterCorner: lm[33] ? { x: lm[33].x, y: lm[33].y } : null,
      rightOuterCorner: lm[263] ? { x: lm[263].x, y: lm[263].y } : null,
      faceBox: { minX, minY, maxX, maxY },
      ipdPx: ipd2dPx,
    },
  };
}
