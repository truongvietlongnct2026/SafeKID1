import { useCallback, useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import {
  type DebugTelemetry,
  type EyeOverlayPoints,
  type GuardSettings,
  type GuardStatus,
  RECOVERY_DURATION_MS,
} from '../types/guard';
import { audioAlert } from '../utils/audioAlert';
import { estimateFaceDistance } from '../utils/distanceEstimator';

const EMA_ALPHA = 0.28;
const TRIGGER_CONFIRM_MS = 180;

const INITIAL_TELEMETRY: DebugTelemetry = {
  rawDistanceCm: null,
  smoothedDistanceCm: null,
  ipdPx: null,
  irisLeftPx: null,
  irisRightPx: null,
  faceWidthPx: null,
  yawCompensation: null,
  matrixZCm: null,
  inferenceMs: 0,
  fps: 0,
  videoWidth: 0,
  videoHeight: 0,
  delegate: 'GPU',
  faceDetected: false,
  recoveryElapsedMs: 0,
  recoveryTargetMs: RECOVERY_DURATION_MS,
};

export function useFaceDistanceGuard(settings: GuardSettings) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [status, setStatus] = useState<GuardStatus>('idle');
  const [isBlackoutActive, setIsBlackoutActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<DebugTelemetry>(INITIAL_TELEMETRY);

  // Mutable tracking refs for zero-lag RAF loop
  const smoothedCmRef = useRef<number | null>(null);
  const tooCloseStartRef = useRef<number | null>(null);
  const recoveryStartRef = useRef<number | null>(null);
  const isBlackoutRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  const lastFpsStampRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const currentFpsRef = useRef(0);
  const delegateRef = useRef<'GPU' | 'CPU'>('GPU');
  const lastRawUnscaledCmRef = useRef<number | null>(null);

  const drawOverlay = useCallback(
    (
      overlay: EyeOverlayPoints,
      videoWidth: number,
      videoHeight: number,
      smoothedCm: number | null,
      thresholdCm: number,
      showDebug: boolean
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
        canvas.width = videoWidth;
        canvas.height = videoHeight;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!showDebug || !overlay.leftIris || !overlay.rightIris) {
        return;
      }

      const isTooClose = smoothedCm !== null && smoothedCm < thresholdCm;
      const accent = isTooClose ? '#EF4444' : '#10B981';

      // Draw subtle face bounding frame
      if (overlay.faceBox) {
        const { minX, minY, maxX, maxY } = overlay.faceBox;
        const bx = minX * videoWidth;
        const by = minY * videoHeight;
        const bw = (maxX - minX) * videoWidth;
        const bh = (maxY - minY) * videoHeight;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);
      }

      // Line between iris centers
      const lx = overlay.leftIris.x * videoWidth;
      const ly = overlay.leftIris.y * videoHeight;
      const rx = overlay.rightIris.x * videoWidth;
      const ry = overlay.rightIris.y * videoHeight;

      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(rx, ry);
      ctx.stroke();

      // Iris center dots
      [
        { x: lx, y: ly },
        { x: rx, y: ry },
      ].forEach((pt) => {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 7.5, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Outer eye corners
      [overlay.leftOuterCorner, overlay.rightOuterCorner].forEach((corner) => {
        if (!corner) return;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
        ctx.beginPath();
        ctx.arc(corner.x * videoWidth, corner.y * videoHeight, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    },
    []
  );

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // Ignore release errors
      }
      wakeLockRef.current = null;
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch {
        // WakeLock optional on older iOS Safari
      }
    }
  }, []);

  const stopCameraAndLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    audioAlert.stopAlertLoop();
    void releaseWakeLock();

    smoothedCmRef.current = null;
    tooCloseStartRef.current = null;
    recoveryStartRef.current = null;
    isBlackoutRef.current = false;
    lastVideoTimeRef.current = -1;
    lastRawUnscaledCmRef.current = null;
  }, [releaseWakeLock]);

  const stopMonitoring = useCallback(() => {
    stopCameraAndLoop();
    setIsMonitoring(false);
    setIsBlackoutActive(false);
    setStatus('idle');
    setErrorMessage(null);
    setTelemetry(INITIAL_TELEMETRY);
  }, [stopCameraAndLoop]);

  const loadFaceLandmarker = useCallback(async (): Promise<FaceLandmarker> => {
    if (landmarkerRef.current) {
      return landmarkerRef.current;
    }

    const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');

    try {
      const gpuLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/mediapipe/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true,
      });
      delegateRef.current = 'GPU';
      landmarkerRef.current = gpuLandmarker;
      return gpuLandmarker;
    } catch {
      // Fallback to CPU delegate if WebGL context is unavailable in Safari
      const cpuLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/mediapipe/face_landmarker.task',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true,
      });
      delegateRef.current = 'CPU';
      landmarkerRef.current = cpuLandmarker;
      return cpuLandmarker;
    }
  }, []);

  const runDetectionLoop = useCallback(() => {
    const step = () => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (!video || !landmarker || !streamRef.current) {
        return;
      }

      const now = performance.now();

      if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;

        const t0 = performance.now();
        const result = landmarker.detectForVideo(video, now);
        const inferenceMs = performance.now() - t0;

        frameCountRef.current += 1;
        if (now - lastFpsStampRef.current >= 500) {
          currentFpsRef.current = Math.round(
            (frameCountRef.current * 1000) / (now - lastFpsStampRef.current)
          );
          frameCountRef.current = 0;
          lastFpsStampRef.current = now;
        }

        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const activeSettings = settingsRef.current;

        const est = estimateFaceDistance(
          result,
          vw,
          vh,
          activeSettings.calibrationFactor
        );

        if (est.rawDistanceCm !== null) {
          lastRawUnscaledCmRef.current =
            est.rawDistanceCm / activeSettings.calibrationFactor;

          smoothedCmRef.current =
            smoothedCmRef.current === null
              ? est.rawDistanceCm
              : smoothedCmRef.current * (1 - EMA_ALPHA) + est.rawDistanceCm * EMA_ALPHA;
        } else {
          // Decay smoothed reading only if face disappears cleanly
          smoothedCmRef.current = null;
        }

        const smoothedCm = smoothedCmRef.current;
        const faceDetected = est.rawDistanceCm !== null && smoothedCm !== null;
        const thresholdCm = activeSettings.thresholdCm;

        drawOverlay(
          est.overlay,
          vw,
          vh,
          smoothedCm,
          thresholdCm,
          activeSettings.debugMode
        );

        let nextStatus: GuardStatus = 'safe';
        let recoveryElapsedMs = 0;

        if (!isBlackoutRef.current) {
          // Normal monitoring state
          if (!faceDetected) {
            tooCloseStartRef.current = null;
            nextStatus = 'no_face';
          } else if (smoothedCm < thresholdCm) {
            if (tooCloseStartRef.current === null) {
              tooCloseStartRef.current = now;
            }
            if (now - tooCloseStartRef.current >= TRIGGER_CONFIRM_MS) {
              // Trigger immediate blackout shield
              isBlackoutRef.current = true;
              recoveryStartRef.current = null;
              setIsBlackoutActive(true);
              nextStatus = 'locked';
            } else {
              nextStatus = 'too_close';
            }
          } else {
            tooCloseStartRef.current = null;
            nextStatus = 'safe';
          }
        } else {
          // Blackout screen is active: MUST hold safe distance continuously for 3 seconds
          if (faceDetected && smoothedCm >= thresholdCm) {
            if (recoveryStartRef.current === null) {
              recoveryStartRef.current = now;
            }
            recoveryElapsedMs = now - recoveryStartRef.current;

            if (recoveryElapsedMs >= RECOVERY_DURATION_MS) {
              // 3 seconds continuous safe distance achieved -> unlock!
              isBlackoutRef.current = false;
              recoveryStartRef.current = null;
              tooCloseStartRef.current = null;
              recoveryElapsedMs = RECOVERY_DURATION_MS;
              setIsBlackoutActive(false);
              nextStatus = 'safe';
              if (activeSettings.soundEnabled) {
                audioAlert.playRecoverySuccessTone();
              }
            } else {
              nextStatus = 'recovering';
            }
          } else {
            // Reset 3-second recovery timer immediately if too close or face lost
            recoveryStartRef.current = null;
            recoveryElapsedMs = 0;
            nextStatus = faceDetected ? 'locked' : 'no_face';
          }
        }

        setStatus(nextStatus);
        setTelemetry({
          rawDistanceCm: est.rawDistanceCm,
          smoothedDistanceCm: smoothedCm,
          ipdPx: est.ipdPx,
          irisLeftPx: est.irisLeftPx,
          irisRightPx: est.irisRightPx,
          faceWidthPx: est.faceWidthPx,
          yawCompensation: est.yawCompensation,
          matrixZCm: est.matrixZCm,
          inferenceMs,
          fps: currentFpsRef.current,
          videoWidth: vw,
          videoHeight: vh,
          delegate: delegateRef.current,
          faceDetected,
          recoveryElapsedMs,
          recoveryTargetMs: RECOVERY_DURATION_MS,
        });
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
  }, [drawOverlay]);

  const startMonitoring = useCallback(async () => {
    // Must unlock Safari Web Audio inside direct user gesture!
    await audioAlert.unlockAudioContext();

    if (!window.isSecureContext) {
      setStatus('error');
      setErrorMessage(
        'Trình duyệt yêu cầu kết nối HTTPS an toàn để mở camera trước trên iPhone Safari.'
      );
      return false;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('error');
      setErrorMessage(
        'Trình duyệt không hỗ trợ navigator.mediaDevices.getUserMedia. Hãy mở bằng Safari trên iPhone.'
      );
      return false;
    }

    setErrorMessage(null);
    setStatus('initializing');

    try {
      // Request front camera optimized for iPhone 14 Plus portrait/landscape
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.setAttribute('playsinline', 'true');
        video.setAttribute('muted', 'true');
        video.muted = true;
        video.srcObject = stream;
        await video.play();
      }

      await loadFaceLandmarker();
      await requestWakeLock();

      setIsMonitoring(true);
      setIsBlackoutActive(false);
      isBlackoutRef.current = false;
      setStatus('safe');

      runDetectionLoop();
      return true;
    } catch (err) {
      stopCameraAndLoop();
      setIsMonitoring(false);
      setStatus('error');

      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMessage(
            'Bạn chưa cấp quyền Camera. Trên iPhone: vào Cài đặt > Safari > Camera > Cho phép, sau đó tải lại trang.'
          );
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setErrorMessage('Không tìm thấy camera trước trên thiết bị này.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setErrorMessage(
            'Camera đang được ứng dụng khác sử dụng. Vui lòng đóng ứng dụng đó và thử lại.'
          );
        } else {
          setErrorMessage(`Không thể khởi động camera (${err.name}).`);
        }
      } else {
        setErrorMessage('Không thể tải mô hình MediaPipe FaceLandmarker hoặc khởi động camera.');
      }
      return false;
    }
  }, [loadFaceLandmarker, requestWakeLock, runDetectionLoop, stopCameraAndLoop]);

  // Sync Web Audio warning loop with blackout state & sound toggle
  useEffect(() => {
    if (isMonitoring && isBlackoutActive && settings.soundEnabled) {
      audioAlert.startAlertLoop();
    } else {
      audioAlert.stopAlertLoop();
    }
  }, [isMonitoring, isBlackoutActive, settings.soundEnabled]);

  // Re-acquire wake lock when returning to Safari tab
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isMonitoring) {
        void requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isMonitoring, requestWakeLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCameraAndLoop();
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, [stopCameraAndLoop]);

  const getCurrentUnscaledCm = useCallback(() => {
    return lastRawUnscaledCmRef.current;
  }, []);

  const emergencyUnlockBlackout = useCallback(() => {
    isBlackoutRef.current = false;
    recoveryStartRef.current = null;
    tooCloseStartRef.current = null;
    setIsBlackoutActive(false);
    audioAlert.stopAlertLoop();
    stopMonitoring();
  }, [stopMonitoring]);

  return {
    videoRef,
    canvasRef,
    isMonitoring,
    status,
    isBlackoutActive,
    errorMessage,
    telemetry,
    startMonitoring,
    stopMonitoring,
    getCurrentUnscaledCm,
    emergencyUnlockBlackout,
  };
}
