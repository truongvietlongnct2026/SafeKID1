import { useEffect, useState } from 'react';
import {
  Bug,
  KeyRound,
  Lock,
  LockOpen,
  Play,
  Shield,
  SlidersHorizontal,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { BlackoutOverlay } from './components/BlackoutOverlay';
import { CameraViewport } from './components/CameraViewport';
import { DebugPanel } from './components/DebugPanel';
import { PinModal, type PinModalMode } from './components/PinModal';
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

const THRESHOLD_PRESETS = [
  { label: 'Gần · 28 cm', value: 28 },
  { label: 'Chuẩn · 35 cm', value: 35 },
  { label: 'Xa · 45 cm', value: 45 },
];

export default function App() {
  const [settings, setSettings] = useState<GuardSettings>(loadSavedSettings);
  const [settingsLocked, setSettingsLocked] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<PinModalMode>('unlock');
  const [pendingAction, setPendingAction] = useState<'unlock_settings' | 'emergency_stop'>(
    'unlock_settings'
  );
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

  const showNotice = (msg: string) => {
    setFeedbackNotice(msg);
  };

  const openUnlockPinModal = (action: 'unlock_settings' | 'emergency_stop') => {
    setPendingAction(action);
    setPinModalMode('unlock');
    setPinModalOpen(true);
  };

  const openChangePinModal = () => {
    if (settingsLocked) {
      openUnlockPinModal('unlock_settings');
      return;
    }
    setPinModalMode('change');
    setPinModalOpen(true);
  };

  const handleToggleMonitoring = async () => {
    if (isMonitoring) {
      if (settingsLocked) {
        openUnlockPinModal('emergency_stop');
        return;
      }
      stopMonitoring();
      return;
    }

    const started = await startMonitoring();
    if (started && settings.autoLockOnStart) {
      setSettingsLocked(true);
    }
  };

  const handleToggleSound = async () => {
    if (settingsLocked) {
      openUnlockPinModal('unlock_settings');
      return;
    }
    await audioAlert.unlockAudioContext();
    setSettings((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  };

  const handleTestSound = async () => {
    await audioAlert.unlockAudioContext();
    audioAlert.playWarningTone();
  };

  const handleToggleDebug = () => {
    if (settingsLocked) {
      openUnlockPinModal('unlock_settings');
      return;
    }
    setSettings((prev) => ({ ...prev, debugMode: !prev.debugMode }));
  };

  const handleThresholdChange = (value: number) => {
    if (settingsLocked) {
      openUnlockPinModal('unlock_settings');
      return;
    }
    setSettings((prev) => ({ ...prev, thresholdCm: value }));
  };

  const handleCalibrateAt40Cm = () => {
    if (settingsLocked) {
      openUnlockPinModal('unlock_settings');
      return;
    }
    const unscaledCm = getCurrentUnscaledCm();
    if (unscaledCm && unscaledCm > 5) {
      const nextFactor = Math.min(1.8, Math.max(0.5, 40 / unscaledCm));
      setSettings((prev) => ({ ...prev, calibrationFactor: nextFactor }));
      showNotice(`Đã hiệu chuẩn chuẩn 40 cm (hệ số ×${nextFactor.toFixed(2)}).`);
    }
  };

  const handleResetCalibration = () => {
    if (settingsLocked) {
      openUnlockPinModal('unlock_settings');
      return;
    }
    setSettings((prev) => ({ ...prev, calibrationFactor: 1.0 }));
    showNotice('Đã khôi phục hệ số hiệu chuẩn mặc định (×1.00).');
  };

  const sliderProgressPct = ((settings.thresholdCm - 20) / (55 - 20)) * 100;

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col">
      {/* Compact Sticky Top Bar (<= 56px + safe-area-top) */}
      <header className="sticky top-0 z-30 pt-safe bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            KidEye Guard
          </span>

          <button
            type="button"
            onClick={() => {
              if (settingsLocked) {
                openUnlockPinModal('unlock_settings');
              } else {
                setSettingsLocked(true);
                showNotice('Đã khóa cài đặt bằng mã PIN 4 số.');
              }
            }}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              settingsLocked
                ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {settingsLocked ? (
              <>
                <Lock className="w-4 h-4 text-amber-700" aria-hidden="true" />
                <span>Mở khóa PIN</span>
              </>
            ) : (
              <>
                <LockOpen className="w-4 h-4 text-slate-600" aria-hidden="true" />
                <span>Khóa cài đặt</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 pb-safe">
        {feedbackNotice && (
          <div
            role="status"
            className="mb-4 px-4 py-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-medium"
          >
            {feedbackNotice}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Camera Preview + Live Distance + Primary Protection Button */}
          <div className="lg:col-span-7 space-y-4">
            <CameraViewport
              videoRef={videoRef}
              canvasRef={canvasRef}
              isMonitoring={isMonitoring}
              status={status}
              distanceCm={telemetry.smoothedDistanceCm}
              thresholdCm={settings.thresholdCm}
              debugMode={settings.debugMode}
              errorMessage={errorMessage}
              onStart={handleToggleMonitoring}
            />

            {/* Primary Thumb-Friendly Action CTA */}
            <button
              type="button"
              onClick={handleToggleMonitoring}
              disabled={status === 'initializing'}
              className={`w-full min-h-[52px] px-6 py-3.5 rounded-2xl font-semibold text-sm sm:text-base inline-flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] shadow-sm whitespace-nowrap ${
                isMonitoring
                  ? 'bg-slate-900 hover:bg-slate-800 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
              } disabled:opacity-60`}
            >
              {isMonitoring ? (
                <>
                  <Square className="w-4 h-4 fill-current" aria-hidden="true" />
                  <span>
                    {settingsLocked
                      ? 'Tạm dừng bảo vệ (Cần PIN)'
                      : 'Tạm dừng bảo vệ'}
                  </span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                  <span>Bắt đầu bảo vệ mắt</span>
                </>
              )}
            </button>

            <p className="text-xs text-slate-500 text-center sm:text-left leading-relaxed px-1">
              Khi khoảng cách nhỏ hơn{' '}
              <span className="font-mono font-semibold text-slate-700 tabular-nums">
                {settings.thresholdCm} cm
              </span>
              , màn hình sẽ lập tức chuyển đen hoàn toàn và chỉ mở lại sau khi lùi ra xa đủ an toàn liên tục 3 giây.
            </p>
          </div>

          {/* Right Column: PIN-Protected Settings & Optional Debug Telemetry */}
          <div className="lg:col-span-5 space-y-4">
            <section className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal className="w-5 h-5 text-blue-600" aria-hidden="true" />
                  <h1 className="text-base font-semibold text-slate-900">
                    Cài đặt bảo vệ
                  </h1>
                </div>
                <span
                  className={`text-xs font-medium ${
                    settingsLocked ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {settingsLocked ? 'Đang khóa PIN' : 'Đang mở khóa'}
                </span>
              </div>

              {settingsLocked && (
                <button
                  type="button"
                  onClick={() => openUnlockPinModal('unlock_settings')}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-medium flex items-center justify-between gap-3 transition-colors text-left"
                >
                  <span>Cài đặt đang được khóa để tránh trẻ tự chỉnh sửa.</span>
                  <span className="font-semibold underline whitespace-nowrap shrink-0">
                    Nhập PIN
                  </span>
                </button>
              )}

              {/* 1. Distance Threshold Slider */}
              <div
                onClick={
                  settingsLocked ? () => openUnlockPinModal('unlock_settings') : undefined
                }
                className="space-y-2.5 pt-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="threshold-slider"
                    className="text-sm font-medium text-slate-800"
                  >
                    Ngưỡng khoảng cách tối thiểu
                  </label>
                  <span className="font-mono text-base font-bold tabular-nums text-blue-600">
                    {settings.thresholdCm} cm
                  </span>
                </div>

                <input
                  id="threshold-slider"
                  type="range"
                  min={20}
                  max={55}
                  step={1}
                  value={settings.thresholdCm}
                  disabled={settingsLocked}
                  onChange={(e) => handleThresholdChange(Number(e.target.value))}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleThresholdChange(preset.value);
                        }}
                        className={`min-h-[44px] px-2 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        } ${settingsLocked ? 'opacity-60' : ''}`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* 2. Alert Sound Toggle */}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleToggleSound}
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
                    <div className="text-sm font-medium text-slate-900">
                      Âm thanh cảnh báo
                    </div>
                    <div className="text-xs text-slate-500">
                      {settings.soundEnabled
                        ? 'Phát tiếng bíp nhắc khi quá gần'
                        : 'Chỉ phủ màn hình đen, không phát tiếng'}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleTestSound}
                    className="min-h-[44px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium whitespace-nowrap transition-colors"
                  >
                    Thử âm
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.soundEnabled}
                    aria-label="Bật tắt âm thanh cảnh báo"
                    onClick={handleToggleSound}
                    className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
                      settings.soundEnabled ? 'bg-blue-600' : 'bg-slate-300'
                    } ${settingsLocked ? 'opacity-60' : ''}`}
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

              {/* 3. Debug Mode Toggle */}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleToggleDebug}
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
                      Chế độ thử nghiệm (Debug)
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
                  aria-label="Bật tắt chế độ thử nghiệm Debug"
                  onClick={handleToggleDebug}
                  className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
                    settings.debugMode ? 'bg-slate-900' : 'bg-slate-300'
                  } ${settingsLocked ? 'opacity-60' : ''}`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                      settings.debugMode ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <hr className="border-slate-100" />

              {/* 4. 4-digit PIN Lock Controls */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (settingsLocked) {
                        openUnlockPinModal('unlock_settings');
                        return;
                      }
                      setSettings((prev) => ({
                        ...prev,
                        autoLockOnStart: !prev.autoLockOnStart,
                      }));
                    }}
                    className="flex-1 min-h-[44px] flex items-center gap-3 text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        Tự khóa PIN khi bảo vệ
                      </div>
                      <div className="text-xs text-slate-500">
                        Khóa ngay cài đặt khi nhấn Bắt đầu
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.autoLockOnStart}
                    aria-label="Tự động khóa cài đặt bằng mã PIN khi bắt đầu"
                    onClick={() => {
                      if (settingsLocked) {
                        openUnlockPinModal('unlock_settings');
                        return;
                      }
                      setSettings((prev) => ({
                        ...prev,
                        autoLockOnStart: !prev.autoLockOnStart,
                      }));
                    }}
                    className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
                      settings.autoLockOnStart ? 'bg-blue-600' : 'bg-slate-300'
                    } ${settingsLocked ? 'opacity-60' : ''}`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                        settings.autoLockOnStart ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={openChangePinModal}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-slate-600" aria-hidden="true" />
                  <span>Đổi mã PIN 4 số</span>
                </button>
              </div>
            </section>

            {/* Debug Telemetry Panel */}
            {settings.debugMode && (
              <DebugPanel
                telemetry={telemetry}
                status={status}
                thresholdCm={settings.thresholdCm}
                calibrationFactor={settings.calibrationFactor}
                isMonitoring={isMonitoring}
                isLocked={settingsLocked}
                onCalibrateAt40Cm={handleCalibrateAt40Cm}
                onResetCalibration={handleResetCalibration}
              />
            )}
          </div>
        </div>
      </main>

      {/* Fullscreen Pure Black (#000000) Shield Overlay */}
      <BlackoutOverlay
        visible={isBlackoutActive}
        status={status}
        distanceCm={telemetry.smoothedDistanceCm}
        thresholdCm={settings.thresholdCm}
        recoveryElapsedMs={telemetry.recoveryElapsedMs}
        soundEnabled={settings.soundEnabled}
        onRequestParentUnlock={() => openUnlockPinModal('emergency_stop')}
      />

      {/* 4-Digit Parent PIN Modal */}
      <PinModal
        isOpen={pinModalOpen}
        mode={pinModalMode}
        currentPin={settings.pinCode}
        title={
          pinModalMode === 'unlock' && pendingAction === 'emergency_stop'
            ? 'Phụ huynh xác nhận PIN'
            : undefined
        }
        subtitle={
          pinModalMode === 'unlock' && pendingAction === 'emergency_stop'
            ? 'Nhập mã PIN 4 số để tạm dừng bảo vệ và mở lại cài đặt.'
            : undefined
        }
        onClose={() => setPinModalOpen(false)}
        onUnlockSuccess={() => {
          setPinModalOpen(false);
          setSettingsLocked(false);
          if (pendingAction === 'emergency_stop') {
            emergencyUnlockBlackout();
            showNotice('Đã tạm dừng bảo vệ và mở khóa cài đặt.');
          } else {
            showNotice('Đã mở khóa cài đặt.');
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
