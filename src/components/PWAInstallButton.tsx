import { useState } from 'react';
import { Download, PlusSquare, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Suppress install prompt when already running in standalone mode
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop native install prompt
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="min-h-[44px] px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        <span>Cài App</span>
      </button>
    );
  }

  // iOS Safari guided "Add to Home Screen" flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[44px] px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 active:scale-[0.98] border border-blue-200 text-blue-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0"
        >
          <Smartphone className="w-4 h-4" aria-hidden="true" />
          <span>Cài App</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-pwa-guide-title"
            className="fixed inset-0 z-[9998] bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl px-6 pt-5 pb-8 pb-safe">
              <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src="/apple-touch-icon.png"
                    alt="Biểu tượng ứng dụng KidEye Guard"
                    className="w-12 h-12 rounded-2xl border border-slate-200 shrink-0"
                  />
                  <div>
                    <h2
                      id="ios-pwa-guide-title"
                      className="text-base font-bold text-slate-900"
                    >
                      Thêm KidEye Guard vào iPhone
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Mở toàn màn hình không cần thanh địa chỉ Safari
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Đóng hướng dẫn cài đặt"
                  className="min-w-[44px] min-h-[44px] -mr-2 -mt-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <ol className="mt-5 space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Nhấn nút <strong className="text-slate-900">Chia sẻ</strong>{' '}
                    <Share
                      className="w-4 h-4 inline-block text-blue-600 -mt-0.5"
                      aria-hidden="true"
                    />{' '}
                    ở thanh dưới trình duyệt Safari.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Cuộn xuống và chọn{' '}
                    <strong className="text-slate-900">Thêm vào Màn hình chính</strong>{' '}
                    <PlusSquare
                      className="w-4 h-4 inline-block text-slate-700 -mt-0.5"
                      aria-hidden="true"
                    />
                    .
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Nhấn <strong className="text-slate-900">Thêm</strong> ở góc trên bên phải để hoàn tất.
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full min-h-[48px] rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2"
    >
      <WifiOff className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
      <span>
        Đang ngoại tuyến — Bảo vệ khoảng cách mắt vẫn hoạt động; YouTube cần có kết nối mạng.
      </span>
    </div>
  );
}
