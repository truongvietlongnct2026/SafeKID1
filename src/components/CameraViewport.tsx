import type { RefObject } from 'react';
import { AlertTriangle, Camera, Eye, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { GuardStatus } from '../types/guard';

interface CameraViewportProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isMonitoring: boolean;
  status: GuardStatus;
  distanceCm: number | null;
  thresholdCm: number;
  debugMode: boolean;
  errorMessage: string | null;
  onStart: () => void;
}

export function CameraViewport({
  videoRef,
  canvasRef,
  isMonitoring,
  status,
  distanceCm,
  thresholdCm,
  debugMode,
  errorMessage,
  onStart,
}: CameraViewportProps) {
  const isTooClose =
    status === 'too_close' || status === 'locked' || status === 'recovering';

  const statusMeta = (() => {
    switch (status) {
      case 'initializing':
        return {
          label: 'Đang khởi động camera & AI...',
          colorClass: 'text-blue-600',
          icon: <Loader2 className="w-4 h-4 animate-spin text-blue-600" aria-hidden="true" />,
        };
      case 'safe':
        return {
          label: 'Khoảng cách an toàn',
          colorClass: 'text-emerald-700',
          icon: <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />,
        };
      case 'too_close':
      case 'locked':
      case 'recovering':
        return {
          label: 'Quá gần màn hình',
          colorClass: 'text-red-700',
          icon: <ShieldAlert className="w-4 h-4 text-red-600" aria-hidden="true" />,
        };
      case 'no_face':
        return {
          label: 'Chưa thấy khuôn mặt',
          colorClass: 'text-amber-700',
          icon: <Eye className="w-4 h-4 text-amber-600" aria-hidden="true" />,
        };
      case 'error':
        return {
          label: 'Lỗi camera',
          colorClass: 'text-red-700',
          icon: <AlertTriangle className="w-4 h-4 text-red-600" aria-hidden="true" />,
        };
      default:
        return {
          label: 'Chưa bật bảo vệ',
          colorClass: 'text-slate-600',
          icon: <Camera className="w-4 h-4 text-slate-500" aria-hidden="true" />,
        };
    }
  })();

  const distanceDisplay =
    distanceCm !== null && isMonitoring ? `${Math.round(distanceCm)}` : '--';

  const ratio =
    distanceCm !== null && isMonitoring
      ? Math.min(100, Math.max(0, ((distanceCm - 15) / (60 - 15)) * 100))
      : 0;
  const thresholdMarkerPct = Math.min(
    100,
    Math.max(0, ((thresholdCm - 15) / (60 - 15)) * 100)
  );

  return (
    <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Live Camera Frame */}
      <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full bg-slate-950 overflow-hidden">
        {/* Mirrored selfie video & debug canvas */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover -scale-x-100 transition-opacity duration-200 ${
            isMonitoring ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 w-full h-full object-cover -scale-x-100"
        />

        {/* Measured bottom scrim when monitoring */}
        {isMonitoring && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
        )}

        {/* Idle / Initializing / Error States */}
        {!isMonitoring && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900 text-white">
            {status === 'initializing' ? (
              <>
                <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-3" />
                <p className="text-base font-semibold">Đang mở camera trước...</p>
                <p className="text-xs text-slate-300 mt-1.5 max-w-xs">
                  Đang nạp mô hình MediaPipe FaceLandmarker cho Safari. Vui lòng cho phép quyền Camera nếu được hỏi.
                </p>
              </>
            ) : status === 'error' ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mb-3">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <p className="text-base font-semibold text-white">Không thể bật camera trước</p>
                <p className="text-xs text-slate-300 mt-2 max-w-sm leading-relaxed">
                  {errorMessage}
                </p>
                <button
                  type="button"
                  onClick={onStart}
                  className="mt-4 min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                >
                  Thử kết nối lại
                </button>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 text-blue-400 flex items-center justify-center mb-3">
                  <Camera className="w-7 h-7" />
                </div>
                <p className="text-base font-semibold text-white">Camera trước sẵn sàng</p>
                <p className="text-xs text-slate-300 mt-1.5 max-w-xs leading-relaxed">
                  Nhấn nút “Bắt đầu bảo vệ” bên dưới để đo khoảng cách mắt theo thời gian thực trên iPhone.
                </p>
              </>
            )}
          </div>
        )}

        {/* Bottom overlay inside camera when active */}
        {isMonitoring && (
          <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between text-white">
            <div>
              <div className="text-[11px] text-slate-300">Khoảng cách ước lượng</div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-bold tabular-nums tracking-tight">
                  {distanceDisplay}
                </span>
                <span className="text-sm font-medium text-slate-300">cm</span>
              </div>
            </div>
            <div className="text-right text-xs text-slate-200">
              <span>Ngưỡng: </span>
              <span className="font-mono font-semibold tabular-nums">{thresholdCm} cm</span>
              {debugMode && (
                <div className="text-[11px] text-blue-300 mt-0.5">Đang vẽ điểm mốc mắt</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status & Distance Gauge Strip */}
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {statusMeta.icon}
            <span className={`text-sm font-semibold ${statusMeta.colorClass}`}>
              {statusMeta.label}
            </span>
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            Mức tối thiểu: {thresholdCm} cm
          </div>
        </div>

        {/* Visual distance progress bar with threshold marker */}
        <div className="relative h-2.5 bg-slate-100 rounded-full overflow-visible">
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
          {/* Threshold pin */}
          <div
            aria-hidden="true"
            className="absolute -top-1 bottom-[-4px] w-0.5 bg-slate-900 rounded-full"
            style={{ left: `${thresholdMarkerPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>Quá gần (15 cm)</span>
          <span>An toàn (60+ cm)</span>
        </div>
      </div>
    </section>
  );
}
