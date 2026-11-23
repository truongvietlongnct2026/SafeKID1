import { Crosshair, RotateCcw } from 'lucide-react';
import type { DebugTelemetry, GuardStatus } from '../types/guard';

interface DebugPanelProps {
  telemetry: DebugTelemetry;
  status: GuardStatus;
  thresholdCm: number;
  calibrationFactor: number;
  isMonitoring: boolean;
  isLocked: boolean;
  onCalibrateAt40Cm: () => void;
  onResetCalibration: () => void;
}

function formatNum(val: number | null, digits = 1, unit = ''): string {
  if (val === null || Number.isNaN(val)) return '--';
  return `${val.toFixed(digits)}${unit ? ` ${unit}` : ''}`;
}

export function DebugPanel({
  telemetry,
  status,
  thresholdCm,
  calibrationFactor,
  isMonitoring,
  isLocked,
  onCalibrateAt40Cm,
  onResetCalibration,
}: DebugPanelProps) {
  const rows: { label: string; value: string }[] = [
    {
      label: 'Trạng thái bộ lọc',
      value: status.toUpperCase(),
    },
    {
      label: 'Khoảng cách (lọc EMA)',
      value: formatNum(telemetry.smoothedDistanceCm, 1, 'cm'),
    },
    {
      label: 'Khoảng cách thô (Raw)',
      value: formatNum(telemetry.rawDistanceCm, 1, 'cm'),
    },
    {
      label: 'Ngưỡng cài đặt',
      value: `${thresholdCm} cm`,
    },
    {
      label: 'IPD (Khoảng cách đồng tử)',
      value: formatNum(telemetry.ipdPx, 1, 'px'),
    },
    {
      label: 'Đường kính mống mắt L / R',
      value: `${formatNum(telemetry.irisLeftPx, 1)} / ${formatNum(telemetry.irisRightPx, 1)} px`,
    },
    {
      label: 'Chiều rộng khuôn mặt',
      value: formatNum(telemetry.faceWidthPx, 0, 'px'),
    },
    {
      label: 'Bù góc nghiêng (Yaw)',
      value: formatNum(telemetry.yawCompensation, 3),
    },
    {
      label: 'Matrix Z tham chiếu',
      value: formatNum(telemetry.matrixZCm, 1, 'cm'),
    },
    {
      label: 'Độ trễ MediaPipe / FPS',
      value: `${telemetry.inferenceMs.toFixed(1)} ms · ${telemetry.fps} FPS`,
    },
    {
      label: 'Khung hình / Bộ xử lý',
      value:
        telemetry.videoWidth > 0
          ? `${telemetry.videoWidth}×${telemetry.videoHeight} · ${telemetry.delegate}`
          : `-- · ${telemetry.delegate}`,
    },
    {
      label: 'Bộ đếm phục hồi 3 giây',
      value: `${(telemetry.recoveryElapsedMs / 1000).toFixed(2)}s / 3.00s`,
    },
  ];

  return (
    <section className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Thông số thử nghiệm (Debug)</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Hệ số hiệu chuẩn hiện tại:{' '}
            <span className="font-mono tabular-nums text-slate-200">
              ×{calibrationFactor.toFixed(2)}
            </span>
          </p>
        </div>
      </div>

      {/* Tabular telemetry list */}
      <div className="divide-y divide-slate-800 border-t border-b border-slate-800">
        {rows.map((row) => (
          <div
            key={row.label}
            className="py-2 flex items-center justify-between gap-4 text-xs"
          >
            <span className="text-slate-400">{row.label}</span>
            <span className="font-mono tabular-nums text-slate-100 font-medium text-right">
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Calibration controls for iPhone 14 Plus / individual child IPD */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <button
          type="button"
          onClick={onCalibrateAt40Cm}
          disabled={!isMonitoring || !telemetry.faceDetected || isLocked}
          className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
        >
          <Crosshair className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Hiệu chuẩn chuẩn 40 cm</span>
        </button>

        <button
          type="button"
          onClick={onResetCalibration}
          disabled={isLocked || Math.abs(calibrationFactor - 1) < 0.01}
          aria-label="Đặt lại hiệu chuẩn mặc định"
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Mặc định</span>
        </button>
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        Mẹo kiểm thử trên iPhone 14 Plus: Giữ máy cách mắt đúng 40 cm rồi nhấn “Hiệu chuẩn chuẩn 40 cm” để khớp tỷ lệ đồng tử của bé.
      </p>
    </section>
  );
}
