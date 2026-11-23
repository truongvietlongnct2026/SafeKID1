import { useEffect, useRef, type RefObject } from 'react';
import {
  AlertTriangle,
  Bug,
  Camera,
  Eye,
  KeyRound,
  Loader2,
  Lock,
  Play,
  ShieldAlert,
  ShieldCheck,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { DebugTelemetry, GuardSettings, GuardStatus } from '../types/guard';
import { DebugPanel } from './DebugPanel';

interface SettingsCameraModalProps {
  isOpen: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
  isMonitoring: boolean;
  status: GuardStatus;
  errorMessage: string | null;
  telemetry: DebugTelemetry;
  settings: GuardSettings;
  onCloseAndLock: () => void;
  onStartMonitoring: () => void;
  onStopMonitoring: () => void;
  onThresholdChange: (value: number) => void;
  onToggleSound: () => void;
  onTestSound: () => void;
  onToggleDebug: () => void;
  onCalibrateAt40Cm: () => void;
  onResetCalibration: () => void;
  onOpenChangePin: () => void;
}

const THRESHOLD_PRESETS = [
  { label: 'Gần · 28 cm', value: 28 },
  { label: 'Chuẩn · 35 cm', value: 35 },
  { label: 'Xa · 45 cm', value: 45 },
];

export function SettingsCameraModal({
  isOpen,
  videoRef,
  overlayCanvasRef,
  isMonitoring,
  status,
  errorMessage,
  telemetry,
  settings,
  onCloseAndLock,
  onStartMonitoring,
  onStopMonitoring,
  onThresholdChange,
  onToggleSound,
  onTestSound,
  onToggleDebug,
  onCalibrateAt40Cm,
  onResetCalibration,
  onOpenChangePin,
}: SettingsCameraModalProps) {
  const mirrorCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mirror the continuously running <video> & landmark <canvas> into this modal preview
  // without ever unmounting the primary video element (keeps iOS Safari stream alive).
  useEffect(() => {
    if (!isOpen || !isMonitoring) return;

    let rafId = 0;
    const renderPreview = () => {
      const video = videoRef.current;
      const overlay = overlayCanvasRef.current;
      const target = mirrorCanvasRef.current;

      if (video && target && video.readyState >= 2 && video.videoWidth > 0) {
        if (target.width !== video.videoWidth || target.height !== video.videoHeight) {
          target.width = video.videoWidth;
          target.height = video.videoHeight;
        }
        const ctx = target.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, target.width, target.height);
          ctx.drawImage(video, 0, 0, target.width, target.height);
          if (overlay && overlay.width > 0 && overlay.height > 0) {
            ctx.drawImage(overlay, 0, 0, target.width, target.height);
          }
        }
      }
      rafId = requestAnimationFrame(renderPreview);
    };

    rafId = requestAnimationFrame(renderPreview);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, isMonitoring, videoRef, overlayCanvasRef]);

  if (!isOpen) return null;

  const distanceCm = telemetry.smoothedDistanceCm;
  const isTooClose =
    status === 'too_close' || status === 'locked' || status === 'recovering';
  const distanceDisplay =
    distanceCm !== null && isMonitoring ? `${Math.round(distanceCm)}` : '--';

  const ratio =
    distanceCm !== null && isMonitoring
      ? Math.min(100, Math.max(0, ((distanceCm - 15) / (60 - 15)) * 100))
      : 0;
  const thresholdMarkerPct = Math.min(
    100,
    Math.max(0, ((settings.thresholdCm - 15) / (60 - 15)) * 100)
  );
  const sliderProgressPct = ((settings.thresholdCm - 20) / (55 - 20)) * 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-camera-title"
      className="fixed inset-0 z-40 bg-slate-950/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="w-full sm:max-w-xl max-h-[92dvh] bg-slate-50 rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        {/* Sticky Sheet Header */}
        <div className="bg-white border-b border-slate-200 px-5 py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <Camera className="w-5 h-5 text-blue-600" aria-hidden="true" />
            <div>
              <h2
                id="settings-camera-title"
                className="text-base font-bold text-slate-900"
              >
                Cài đặt & Camera
              </h2>
              <p className="text-[11px] text-emerald-700 font-medium">
                Đã xác thực PIN phụ huynh
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseAndLock}
            aria-label="Đóng và khóa cài đặt"
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Đóng & Khóa</span>
            <X className="w-4 h-4 ml-0.5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-4 pb-safe">
          {/* Camera Preview & Start/Stop Monitoring */}
          <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="relative aspect-[16/10] w-full bg-slate-950 overflow-hidden">
              {isMonitoring ? (
                <>
                  <canvas
                    ref={mirrorCanvasRef}
                    className="w-full h-full object-cover -scale-x-100"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3.5 flex items-end justify-between text-white">
                    <div>
                      <div className="text-[11px] text-slate-300">Khoảng cách đo được</div>
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-2xl font-bold tabular-nums">
                          {distanceDisplay}
                        </span>
                        <span className="text-xs text-slate-300">cm</span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-200 font-mono tabular-nums">
                      Ngưỡng: {settings.thresholdCm} cm
                    </div>
                  </div>
                </>
              ) : status === 'initializing' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center text-white bg-slate-900">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-2" />
                  <p className="text-sm font-semibold">Đang khởi động camera trước...</p>
                </div>
              ) : status === 'error' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center text-white bg-slate-900">
                  <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
                  <p className="text-sm font-semibold">Không thể mở camera</p>
                  <p className="text-xs text-slate-300 mt-1 max-w-xs">{errorMessage}</p>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center text-white bg-slate-900">
                  <Camera className="w-8 h-8 text-blue-400 mb-2" />
                  <p className="text-sm font-semibold">Giám sát khoảng cách đang tắt</p>
                  <p className="text-xs text-slate-300 mt-1 max-w-xs">
                    Nhấn “Bật giám sát” bên dưới để kích hoạt camera trước & MediaPipe.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                  {status === 'safe' && (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                      <span className="text-emerald-700">Khoảng cách an toàn</span>
                    </>
                  )}
                  {isTooClose && (
                    <>
                      <ShieldAlert className="w-4 h-4 text-red-600" aria-hidden="true" />
                      <span className="text-red-700">Quá gần màn hình</span>
                    </>
                  )}
                  {status === 'no_face' && (
                    <>
                      <Eye className="w-4 h-4 text-amber-600" aria-hidden="true" />
                      <span className="text-amber-700">Chưa thấy khuôn mặt</span>
                    </>
                  )}
                  {(status === 'idle' || status === 'error' || status === 'initializing') && (
                    <span className="text-slate-600">
                      {status === 'initializing'
                        ? 'Đang nạp MediaPipe...'
                        : 'Chưa bật giám sát'}
                    </span>
                  )}
                </span>
                <span className="font-mono tabular-nums text-slate-500">
                  Tối thiểu: {settings.thresholdCm} cm
                </span>
              </div>

              <div className="relative h-2.5 bg-slate-100 rounded-full">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${
                    !isMonitoring || distanceCm === null
                      ? 'bg-slate-300'
                      : isTooClose
                        ? 'bg-red-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${isMonitoring ? ratio : 0}%` }}
                />
                <div
                  aria-hidden="true"
                  className="absolute -top-1 bottom-[-4px] w-0.5 bg-slate-900 rounded-full"
                  style={{ left: `${thresholdMarkerPct}%` }}
                />
              </div>

              <button
                type="button"
                onClick={isMonitoring ? onStopMonitoring : onStartMonitoring}
                disabled={status === 'initializing'}
                className={`w-full min-h-[48px] px-4 py-3 rounded-2xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                  isMonitoring
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                } disabled:opacity-60`}
              >
                {isMonitoring ? (
                  <>
                    <Square className="w-4 h-4 fill-current" aria-hidden="true" />
                    <span>Tắt giám sát khoảng cách</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                    <span>Bật giám sát khoảng cách</span>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Threshold & Sound & Debug & PIN Controls */}
          <section className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
            {/* Threshold Slider */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="modal-threshold-slider"
                  className="text-sm font-semibold text-slate-900"
                >
                  Ngưỡng khoảng cách an toàn
                </label>
                <span className="font-mono text-base font-bold tabular-nums text-blue-600">
                  {settings.thresholdCm} cm
                </span>
              </div>

              <input
                id="modal-threshold-slider"
                type="range"
                min={20}
                max={55}
                step={1}
                value={settings.thresholdCm}
                onChange={(e) => onThresholdChange(Number(e.target.value))}
                className="kid-slider w-full"
                style={{
                  background: `linear-gradient(to right, #2563EB 0%, #2563EB ${sliderProgressPct}%, #E2E8F0 ${sliderProgressPct}%, #E2E8F0 100%)`,
                  backgroundSize: '100% 8px',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                }}
              />

              <div className="grid grid-cols-3 gap-2">
                {THRESHOLD_PRESETS.map((preset) => {
                  const active = settings.thresholdCm === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => onThresholdChange(preset.value)}
                      className={`min-h-[44px] px-2 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Sound Toggle */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onToggleSound}
                className="flex-1 min-h-[44px] flex items-center gap-3 text-left"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    settings.soundEnabled
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {settings.soundEnabled ? (
                    <Volume2 className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <VolumeX className="w-5 h-5" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900">Âm thanh cảnh báo</div>
                  <div className="text-xs text-slate-500">
                    {settings.soundEnabled ? 'Đang bật tiếng bíp nhắc' : 'Đang tắt âm báo'}
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onTestSound}
                  className="min-h-[44px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium whitespace-nowrap"
                >
                  Thử âm
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.soundEnabled}
                  aria-label="Bật tắt âm thanh cảnh báo"
                  onClick={onToggleSound}
                  className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
                    settings.soundEnabled ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                      settings.soundEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Debug Mode Toggle */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onToggleDebug}
                className="flex-1 min-h-[44px] flex items-center gap-3 text-left"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    settings.debugMode
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Bug className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    Chế độ thông số (Debug)
                  </div>
                  <div className="text-xs text-slate-500">
                    Hiện điểm mốc mắt, IPD px, FPS & hiệu chuẩn
                  </div>
                </div>
              </button>

              <button
                type="button"
                role="switch"
                aria-checked={settings.debugMode}
                aria-label="Bật tắt chế độ thông số Debug"
                onClick={onToggleDebug}
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
                  settings.debugMode ? 'bg-slate-900' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                    settings.debugMode ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <hr className="border-slate-100" />

            {/* Change 4-digit PIN */}
            <button
              type="button"
              onClick={onOpenChangePin}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <KeyRound className="w-4 h-4 text-slate-600" aria-hidden="true" />
              <span>Đổi mã PIN 4 số</span>
            </button>
          </section>

          {/* Debug Telemetry Panel inside Settings Modal when Debug is enabled */}
          {settings.debugMode && (
            <DebugPanel
              telemetry={telemetry}
              status={status}
              thresholdCm={settings.thresholdCm}
              calibrationFactor={settings.calibrationFactor}
              isMonitoring={isMonitoring}
              isLocked={false}
              onCalibrateAt40Cm={onCalibrateAt40Cm}
              onResetCalibration={onResetCalibration}
            />
          )}
        </div>
      </div>
    </div>
  );
}
