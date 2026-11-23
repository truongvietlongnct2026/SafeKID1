import { useEffect, useState } from 'react';
import { Delete, Lock, ShieldCheck, X } from 'lucide-react';
import { DEFAULT_PIN } from '../types/guard';

export type PinModalMode = 'unlock' | 'change';

interface PinModalProps {
  isOpen: boolean;
  mode: PinModalMode;
  currentPin: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onUnlockSuccess: () => void;
  onPinChanged: (newPin: string) => void;
}

const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinModal({
  isOpen,
  mode,
  currentPin,
  title,
  subtitle,
  onClose,
  onUnlockSuccess,
  onPinChanged,
}: PinModalProps) {
  const [entered, setEntered] = useState('');
  const [changeStep, setChangeStep] = useState<'verify' | 'new' | 'confirm'>('verify');
  const [pendingNewPin, setPendingNewPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEntered('');
      setChangeStep('verify');
      setPendingNewPin('');
      setErrorMsg(null);
      setShake(false);
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const triggerError = (message: string) => {
    setErrorMsg(message);
    setShake(true);
    setEntered('');
    window.setTimeout(() => setShake(false), 380);
  };

  const handleDigit = (digit: string) => {
    if (entered.length >= 4) return;
    const next = entered + digit;
    setEntered(next);
    setErrorMsg(null);

    if (next.length === 4) {
      window.setTimeout(() => {
        if (mode === 'unlock') {
          if (next === currentPin) {
            onUnlockSuccess();
          } else {
            triggerError('Mã PIN chưa đúng. Vui lòng thử lại.');
          }
          return;
        }

        // Change PIN flow
        if (changeStep === 'verify') {
          if (next === currentPin) {
            setChangeStep('new');
            setEntered('');
          } else {
            triggerError('Mã PIN hiện tại không đúng.');
          }
        } else if (changeStep === 'new') {
          setPendingNewPin(next);
          setChangeStep('confirm');
          setEntered('');
        } else {
          if (next === pendingNewPin) {
            onPinChanged(next);
          } else {
            setChangeStep('new');
            setPendingNewPin('');
            triggerError('Mã PIN xác nhận không khớp. Nhập lại PIN mới.');
          }
        }
      }, 120);
    }
  };

  const handleBackspace = () => {
    setEntered((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const heading =
    title ??
    (mode === 'unlock'
      ? 'Mở khóa cài đặt'
      : changeStep === 'verify'
        ? 'Xác nhận PIN hiện tại'
        : changeStep === 'new'
          ? 'Nhập mã PIN mới (4 số)'
          : 'Nhập lại mã PIN mới');

  const description =
    subtitle ??
    (mode === 'unlock'
      ? 'Nhập mã PIN 4 số của phụ huynh để thay đổi cài đặt bảo vệ.'
      : changeStep === 'verify'
        ? 'Nhập mã PIN hiện tại để tiếp tục đổi mã khóa.'
        : changeStep === 'new'
          ? 'Chọn 4 chữ số dễ nhớ với phụ huynh.'
          : 'Nhập lại chính xác 4 chữ số vừa chọn.');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-modal-title"
      className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 px-6 pt-5 pb-8 pb-safe">
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              {mode === 'change' && changeStep !== 'verify' ? (
                <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              ) : (
                <Lock className="w-5 h-5" aria-hidden="true" />
              )}
            </div>
            <div>
              <h2 id="pin-modal-title" className="text-lg font-semibold text-slate-900">
                {heading}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại PIN"
            className="min-w-[44px] min-h-[44px] -mr-2 -mt-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 PIN dots */}
        <div
          className={`mt-6 flex items-center justify-center gap-4 ${
            shake ? 'animate-[shake_0.35s_ease-in-out]' : ''
          }`}
          style={
            shake
              ? {
                  transform: 'translateX(0)',
                }
              : undefined
          }
        >
          {[0, 1, 2, 3].map((idx) => {
            const filled = idx < entered.length;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-150 ${
                  filled
                    ? 'bg-blue-600 scale-110'
                    : 'bg-slate-200 border border-slate-300'
                }`}
              />
            );
          })}
        </div>

        {/* Error or default PIN hint */}
        <div className="mt-3 min-h-[20px] text-center">
          {errorMsg ? (
            <p className="text-xs font-medium text-red-600">{errorMsg}</p>
          ) : currentPin === DEFAULT_PIN &&
            (mode === 'unlock' || changeStep === 'verify') ? (
            <p className="text-xs text-slate-500">
              Mã PIN mặc định ban đầu: <span className="font-mono font-semibold">1234</span>
            </p>
          ) : null}
        </div>

        {/* Tactile Numeric Keypad (64x56px buttons for iPhone 14 Plus thumb comfort) */}
        <div className="mt-5 grid grid-cols-3 gap-3 max-w-[276px] mx-auto">
          {KEYPAD_DIGITS.map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-blue-50 active:scale-95 text-slate-900 font-semibold text-xl tabular-nums transition-all flex items-center justify-center select-none"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            className="h-14 rounded-2xl text-slate-500 hover:bg-slate-100 active:scale-95 text-sm font-medium transition-all flex items-center justify-center"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-blue-50 active:scale-95 text-slate-900 font-semibold text-xl tabular-nums transition-all flex items-center justify-center select-none"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Xóa một số"
            className="h-14 rounded-2xl text-slate-600 hover:bg-slate-100 active:scale-95 transition-all flex items-center justify-center"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
