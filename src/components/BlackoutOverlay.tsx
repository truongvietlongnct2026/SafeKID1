import { EyeOff, KeyRound, ShieldCheck, Volume2, VolumeX } from 'lucide-react';
import { type GuardStatus, RECOVERY_DURATION_MS } from '../types/guard';

interface BlackoutOverlayProps {
  visible: boolean;
  status: GuardStatus;
  distanceCm: number | null;
  thresholdCm: number;
  recoveryElapsedMs: number;
  soundEnabled: boolean;
  onRequestParentUnlock: () => void;
}

export function BlackoutOverlay({
  visible,
  status,
  distanceCm,
  thresholdCm,
  recoveryElapsedMs,
  soundEnabled,
  onRequestParentUnlock,
}: BlackoutOverlayProps) {
  if (!visible) return null;

  const isRecovering = status === 'recovering';
  const progress = Math.min(1, Math.max(0, recoveryElapsedMs / RECOVERY_DURATION_MS));
  const remainingSec = Math.max(0, (RECOVERY_DURATION_MS - recoveryElapsedMs) / 1000);

  const ringRadius = 54;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference * (1 - progress);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="blackout-title"
      className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col items-center justify-between px-6 pt-safe pb-safe select-none"
    >
      {/* Top quiet header */}
      <div className="w-full max-w-md pt-6 flex items-center justify-between text-xs text-neutral-400">
        <span className="font-semibold tracking-tight text-neutral-300">KidEye Guard</span>
        <span className="inline-flex items-center gap-1.5">
          {soundEnabled ? (
            <>
              <Volume2 className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span>Âm báo đang bật</span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4 text-neutral-500" aria-hidden="true" />
              <span>Âm báo đang tắt</span>
            </>
          )}
        </span>
      </div>

      {/* Center focal warning / 3-second recovery countdown */}
      <div className="w-full max-w-md flex flex-col items-center text-center my-auto py-8">
        {isRecovering ? (
          <div className="relative w-36 h-36 flex items-center justify-center mb-6">
            <svg className="w-36 h-36 -rotate-90" viewBox="0 0 128 128" aria-hidden="true">
              <circle
                cx="64"
                cy="64"
                r={ringRadius}
                fill="none"
                stroke="#262626"
                strokeWidth="8"
              />
              <circle
                cx="64"
                cy="64"
                r={ringRadius}
                fill="none"
                stroke="#10B981"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-[stroke-dashoffset] duration-75 ease-linear"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-3xl font-semibold tabular-nums text-emerald-400">
                {remainingSec.toFixed(1)}s
              </span>
              <span className="text-[11px] text-neutral-400 mt-0.5">Đang mở lại</span>
            </div>
          </div>
        ) : (
          <div className="w-24 h-24 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-6">
            <EyeOff className="w-11 h-11 text-red-500" aria-hidden="true" />
          </div>
        )}

        <h1
          id="blackout-title"
          className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance"
        >
          {isRecovering
            ? 'Giữ nguyên khoảng cách an toàn!'
            : 'Đưa điện thoại ra xa mắt hơn!'}
        </h1>

        <p className="mt-3 text-base text-neutral-300 leading-relaxed max-w-xs">
          {isRecovering
            ? `Rất tốt! Giữ khoảng cách từ ${thresholdCm} cm trở lên liên tục trong ${remainingSec.toFixed(1)} giây để mở lại màn hình.`
            : status === 'no_face'
              ? `Không nhận diện được khuôn mặt. Hãy hướng mặt vào camera và giữ khoảng cách tối thiểu ${thresholdCm} cm.`
              : `Màn hình đang quá gần mắt. Hãy lùi ra xa tối thiểu ${thresholdCm} cm và giữ ổn định 3 giây.`}
        </p>

        {/* Live distance comparison */}
        <div className="mt-8 w-full max-w-xs border-t border-neutral-800 pt-5 grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-xs text-neutral-400">Khoảng cách hiện tại</div>
            <div
              className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
                isRecovering ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {distanceCm !== null ? `${Math.round(distanceCm)} cm` : '-- cm'}
            </div>
          </div>
          <div className="text-center border-l border-neutral-800">
            <div className="text-xs text-neutral-400">Ngưỡng an toàn</div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span>≥ {thresholdCm} cm</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom parent emergency PIN unlock */}
      <div className="w-full max-w-md pb-6 flex justify-center">
        <button
          type="button"
          onClick={onRequestParentUnlock}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-[0.98] border border-neutral-800 text-neutral-300 text-sm font-medium inline-flex items-center gap-2 transition-all whitespace-nowrap shrink-0"
        >
          <KeyRound className="w-4 h-4 text-neutral-400" aria-hidden="true" />
          <span>Phụ huynh mở khóa (PIN)</span>
        </button>
      </div>
    </div>
  );
}
