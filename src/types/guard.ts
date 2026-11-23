export type GuardStatus =
  | 'idle'
  | 'initializing'
  | 'safe'
  | 'too_close'
  | 'locked'
  | 'recovering'
  | 'no_face'
  | 'error';

export interface GuardSettings {
  thresholdCm: number;
  soundEnabled: boolean;
  debugMode: boolean;
  autoLockOnStart: boolean;
  pinLockEnabled: boolean;
  pinCode: string;
  calibrationFactor: number;
}

export interface DebugTelemetry {
  rawDistanceCm: number | null;
  smoothedDistanceCm: number | null;
  ipdPx: number | null;
  irisLeftPx: number | null;
  irisRightPx: number | null;
  faceWidthPx: number | null;
  yawCompensation: number | null;
  matrixZCm: number | null;
  inferenceMs: number;
  fps: number;
  videoWidth: number;
  videoHeight: number;
  delegate: 'GPU' | 'CPU';
  faceDetected: boolean;
  recoveryElapsedMs: number;
  recoveryTargetMs: number;
}

export interface EyeOverlayPoints {
  leftIris: { x: number; y: number } | null;
  rightIris: { x: number; y: number } | null;
  leftOuterCorner: { x: number; y: number } | null;
  rightOuterCorner: { x: number; y: number } | null;
  faceBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null;
  ipdPx: number | null;
}

export const DEFAULT_PIN = '1234';
export const RECOVERY_DURATION_MS = 3000;

export const DEFAULT_SETTINGS: GuardSettings = {
  thresholdCm: 35,
  soundEnabled: true,
  debugMode: false,
  autoLockOnStart: true,
  pinLockEnabled: true,
  pinCode: DEFAULT_PIN,
  calibrationFactor: 1.0,
};
