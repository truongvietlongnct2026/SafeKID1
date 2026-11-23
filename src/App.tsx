import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Eye,
  Loader2,
  Lock,
  Play,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { BlackoutOverlay } from './components/BlackoutOverlay';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { PinModal, type PinModalMode } from './components/PinModal';
import { SafeYouTubeSection } from './components/SafeYouTubeSection';
import { SettingsCameraModal } from './components/SettingsCameraModal';
import { useFaceDistanceGuard } from './hooks/useFaceDistanceGuard';
import { DEFAULT_SETTINGS, type GuardSettings } from './types/guard';
import { audioAlert } from './utils/audioAlert';

const STORAGE_KEY = 'kideye_guard_settings_v1';

function loadSavedSettings(): GuardSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GuardSettings>;
    return {
      thresholdCm:
        typeof parsed.thresholdCm === 'number'
          ? Math.min(55, Math.max(20, parsed.thresholdCm))
          : DEFAULT_SETTINGS.thresholdCm,
      soundEnabled:
        typeof parsed.soundEnabled === 'boolean'
          ? parsed.soundEnabled
          : DEFAULT_SETTINGS.soundEnabled,
      debugMode:
        typeof parsed.debugMode === 'boolean'
          ? parsed.debugMode
          : DEFAULT_SETTINGS.debugMode,
      autoLockOnStart:
        typeof parsed.autoLockOnStart === 'boolean'
          ? parsed.autoLockOnStart
          : DEFAULT_SETTINGS.autoLockOnStart,
      pinLockEnabled:
        typeof parsed.pinLockEnabled === 'boolean'
          ? parsed.pinLockEnabled
          : DEFAULT_SETTINGS.pinLockEnabled,
      pinCode:
        typeof parsed.pinCode === 'string' && /^\d{4}$/.test(parsed.pinCode)
          ? parsed.pinCode
          : DEFAULT_SETTINGS.pinCode,
      calibrationFactor:
        typeof parsed.calibrationFactor === 'number' &&
        parsed.calibrationFactor >= 0.5 &&
        parsed.calibrationFactor <= 1.8
          ? parsed.calibrationFactor
          : DEFAULT_SETTINGS.calibrationFactor,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function App() {
  const [settings, setSettings] = useState<GuardSettings>(loadSavedSettings);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(false);
  isExpandedRef.current = isExpanded;
  const autoExpandedByLandscapeRef = useRef(false);

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<PinModalMode>('unlock');
  const [pendingAction, setPendingAction] = useState<
    'open_settings_camera' | 'emergency_stop' | 'collapse_expanded'
  >('open_settings_camera');
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const {
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
  } = useFaceDistanceGuard(settings);

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota issues in Safari Private Mode
    }
  }, [settings]);

  // Auto-dismiss transient feedback notice
  useEffect(() => {
    if (!feedbackNotice) return;
    const timer = window.setTimeout(() => setFeedbackNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [feedbackNotice]);

  // Automatically enable edge-to-edge mode when iPhone rotates to landscape (and return on portrait)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const landscapeQuery = window.matchMedia('(orientation: landscape) and (max-height: 540px)');

    const checkOrientation = () => {
      const isMobileLandscape =
        landscapeQuery.matches ||
        (window.innerWidth > window.innerHeight && window.innerHeight <= 540);

      if (isMobileLandscape) {
        if (!isExpandedRef.current) {
          autoExpandedByLandscapeRef.current = true;
          setIsExpanded(true);
        }
      } else if (autoExpandedByLandscapeRef.current) {
        autoExpandedByLandscapeRef.current = false;
        setIsExpanded(false);
      }
    };

    checkOrientation();

    const handleChange = () => checkOrientation();
    landscapeQuery.addEventListener('change', handleChange);
    window.addEventListener('orientationchange', handleChange);
    window.addEventListener('resize', handleChange);

    return () => {
      landscapeQuery.removeEventListener('change', handleChange);
      window.removeEventListener('orientationchange', handleChange);
      window.removeEventListener('resize', handleChange);
    };
  }, []);

  // Prevent background body scroll while edge-to-edge player is active
  useEffect(() => {
    if (!isExpanded) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isExpanded]);

  const showNotice = useCallback((msg: string | null) => {
    setFeedbackNotice(msg);
  }, []);

  const openPinForSettingsCamera = () => {
    setPendingAction('open_settings_camera');
    setPinModalMode('unlock');
    setPinModalOpen(true);
  };

  const openPinForEmergencyStop = () => {
    setPendingAction('emergency_stop');
    setPinModalMode('unlock');
    setPinModalOpen(true);
  };

  const handleRequestExpand = () => {
    autoExpandedByLandscapeRef.current = false;
    setIsExpanded(true);
  };

  const handleRequestCollapse = () => {
    if (settings.pinLockEnabled) {
      setPendingAction('collapse_expanded');
      setPinModalMode('unlock');
      setPinModalOpen(true);
      return;
    }
    autoExpandedByLandscapeRef.current = false;
    setIsExpanded(false);
  };

  const handleToggleSound = async () => {
    await audioAlert.unlockAudioContext();
    setSettings((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  };

  const handleTestSound = async () => {
    await audioAlert.unlockAudioContext();
    audioAlert.playWarningTone();
  };

  const handleCalibrateAt40Cm = () => {
    const unscaledCm = getCurrentUnscaledCm();
    if (unscaledCm && unscaledCm > 5) {
      const nextFactor = Math.min(1.8, Math.max(0.5, 40 / unscaledCm));
      setSettings((prev) => ({ ...prev, calibrationFactor: nextFactor }));
      showNotice(`Đã hiệu chuẩn chuẩn 40 cm (hệ số ×${nextFactor.toFixed(2)}).`);
    }
  };

  const handleResetCalibration = () => {
    setSettings((prev) => ({ ...prev, calibrationFactor: 1.0 }));
    showNotice('Đã khôi phục hệ số hiệu chuẩn mặc định (×1.00).');
  };

  const distanceDisplay =
    telemetry.smoothedDistanceCm !== null && isMonitoring
      ? `${Math.round(telemetry.smoothedDistanceCm)} cm`
      : '-- cm';

  const statusIndicator = (() => {
    switch (status) {
      case 'initializing':
        return {
          text: 'Đang mở camera...',
          textClass: 'text-blue-700',
          icon: <Loader2 className="w-4 h-4 text-blue-600 animate-spin" aria-hidden="true" />,
        };
      case 'safe':
        return {
          text: 'Khoảng cách an toàn',
          textClass: 'text-emerald-700',
          icon: <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />,
        };
      case 'too_close':
      case 'locked':
      case 'recovering':
        return {
          text: 'Quá gần màn hình',
          textClass: 'text-red-700',
          icon: <ShieldAlert className="w-4 h-4 text-red-600" aria-hidden="true" />,
        };
      case 'no_face':
        return {
          text: 'Đang tìm khuôn mặt',
          textClass: 'text-amber-700',
          icon: <Eye className="w-4 h-4 text-amber-600" aria-hidden="true" />,
        };
      case 'error':
        return {
          text: 'Lỗi quyền camera',
          textClass: 'text-red-700',
          icon: <AlertTriangle className="w-4 h-4 text-red-600" aria-hidden="true" />,
        };
      default:
        return {
          text: 'Bảo vệ mắt đang tắt',
          textClass: 'text-slate-600',
          icon: <Camera className="w-4 h-4 text-slate-500" aria-hidden="true" />,
        };
    }
  })();

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col">
      {/* Compact Top Bar (hidden when edge-to-edge player covers screen) */}
      {!isExpanded && (
        <header className="sticky top-0 z-30 pt-safe bg-white/90 backdrop-blur-md border-b border-slate-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4">
            <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              KidEye Guard
            </span>

            <div className="flex items-center gap-2 shrink-0">
              <PWAInstallButton />

              <button
                type="button"
                onClick={openPinForSettingsCamera}
                className="min-h-[44px] px-3 sm:px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0"
              >
                <SlidersHorizontal className="w-4 h-4 text-blue-600" aria-hidden="true" />
                <span>Cài đặt & Camera</span>
                <Lock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content Optimized for iPhone 14 Plus Portrait Safari */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-4 pb-safe space-y-4">
        {!isExpanded && <OfflineIndicator />}
        {/* Compact Always-Mounted Camera Protection Strip (stays non-display:none behind z-40 during expanded mode so Safari keeps decoding frames) */}
        <section
          aria-hidden={isExpanded}
          className={`bg-white rounded-2xl border border-slate-200 px-3.5 py-2.5 shadow-sm flex items-center justify-between gap-3 ${
            isExpanded ? 'pointer-events-none opacity-0' : ''
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Persistent live mini camera preview */}
            <div className="relative w-14 h-10 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shrink-0 flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`w-full h-full object-cover -scale-x-100 ${
                  isMonitoring ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 w-full h-full object-cover -scale-x-100"
              />
              {!isMonitoring && (
                <Camera
                  className="w-4 h-4 text-slate-400 absolute pointer-events-none"
                  aria-hidden="true"
                />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {statusIndicator.icon}
                <span className={`text-xs font-semibold truncate ${statusIndicator.textClass}`}>
                  {statusIndicator.text}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5 truncate">
                {isMonitoring
                  ? `Hiện tại: ${distanceDisplay} · Ngưỡng: ${settings.thresholdCm} cm`
                  : `Ngưỡng bảo vệ: ${settings.thresholdCm} cm`}
              </div>
            </div>
          </div>

          {!isMonitoring ? (
            <button
              type="button"
              onClick={() => void startMonitoring()}
              disabled={status === 'initializing'}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>Bật bảo vệ</span>
            </button>
          ) : (
            <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap shrink-0 pr-1">
              Đang giám sát
            </span>
          )}
        </section>

        {!isExpanded && status === 'error' && errorMessage && (
          <div
            role="alert"
            className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs leading-relaxed"
          >
            {errorMessage}
          </div>
        )}

        {!isExpanded && feedbackNotice && (
          <div
            role="status"
            className="px-4 py-2.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-medium"
          >
            {feedbackNotice}
          </div>
        )}

        {/* Primary Main Screen: Góc xem YouTube an toàn (with Edge-to-Edge CSS expansion) */}
        <SafeYouTubeSection
          isBlackoutActive={isBlackoutActive}
          isExpanded={isExpanded}
          isMonitoring={isMonitoring}
          status={status}
          distanceCm={telemetry.smoothedDistanceCm}
          thresholdCm={settings.thresholdCm}
          pinLockEnabled={settings.pinLockEnabled}
          onExpand={handleRequestExpand}
          onCollapse={handleRequestCollapse}
          onStartMonitoring={() => void startMonitoring()}
          onPlaybackSyncMessage={showNotice}
        />
      </main>

      {/* PIN-Unlocked "Cài đặt & Camera" Drawer/Modal */}
      <SettingsCameraModal
        isOpen={settingsModalOpen}
        videoRef={videoRef}
        overlayCanvasRef={canvasRef}
        isMonitoring={isMonitoring}
        status={status}
        errorMessage={errorMessage}
        telemetry={telemetry}
        settings={settings}
        onCloseAndLock={() => {
          setSettingsModalOpen(false);
          showNotice('Đã đóng và khóa Cài đặt & Camera bằng mã PIN.');
        }}
        onStartMonitoring={() => void startMonitoring()}
        onStopMonitoring={stopMonitoring}
        onThresholdChange={(value) =>
          setSettings((prev) => ({ ...prev, thresholdCm: value }))
        }
        onToggleSound={() => void handleToggleSound()}
        onTestSound={() => void handleTestSound()}
        onToggleDebug={() =>
          setSettings((prev) => ({ ...prev, debugMode: !prev.debugMode }))
        }
        onCalibrateAt40Cm={handleCalibrateAt40Cm}
        onResetCalibration={handleResetCalibration}
        onTogglePinLock={() =>
          setSettings((prev) => ({ ...prev, pinLockEnabled: !prev.pinLockEnabled }))
        }
        onOpenChangePin={() => {
          setPinModalMode('change');
          setPinModalOpen(true);
        }}
      />

      {/* Fullscreen Pure Black (#000000) Shield Overlay (z-index: 9999) */}
      <BlackoutOverlay
        visible={isBlackoutActive}
        status={status}
        distanceCm={telemetry.smoothedDistanceCm}
        thresholdCm={settings.thresholdCm}
        recoveryElapsedMs={telemetry.recoveryElapsedMs}
        soundEnabled={settings.soundEnabled}
        onRequestParentUnlock={openPinForEmergencyStop}
      />

      {/* 4-Digit Parent PIN Modal (z-index: 10000) */}
      <PinModal
        isOpen={pinModalOpen}
        mode={pinModalMode}
        currentPin={settings.pinCode}
        title={
          pinModalMode === 'unlock'
            ? pendingAction === 'emergency_stop'
              ? 'Phụ huynh xác nhận PIN'
              : pendingAction === 'collapse_expanded'
                ? 'Thu nhỏ màn hình xem'
                : 'Mở khóa Cài đặt & Camera'
            : undefined
        }
        subtitle={
          pinModalMode === 'unlock'
            ? pendingAction === 'emergency_stop'
              ? 'Nhập mã PIN 4 số để tắt bảo vệ và mở lại màn hình.'
              : pendingAction === 'collapse_expanded'
                ? 'Nhập mã PIN 4 số của phụ huynh để thoát chế độ tràn màn hình.'
                : 'Nhập mã PIN 4 số để chỉnh ngưỡng khoảng cách hoặc tắt giám sát.'
            : undefined
        }
        onClose={() => setPinModalOpen(false)}
        onUnlockSuccess={() => {
          setPinModalOpen(false);
          if (pendingAction === 'emergency_stop') {
            emergencyUnlockBlackout();
            setSettingsModalOpen(true);
            showNotice('Đã tắt giám sát và mở Cài đặt & Camera.');
          } else if (pendingAction === 'collapse_expanded') {
            autoExpandedByLandscapeRef.current = false;
            setIsExpanded(false);
          } else {
            setSettingsModalOpen(true);
          }
        }}
        onPinChanged={(newPin) => {
          setSettings((prev) => ({ ...prev, pinCode: newPin }));
          setPinModalOpen(false);
          showNotice('Đã cập nhật mã PIN 4 số mới.');
        }}
      />
    </div>
  );
}
