import { useState, type FormEvent } from 'react';
import { ExternalLink, Link2, Play, Tv, X } from 'lucide-react';
import type { GuardStatus } from '../types/guard';
import { CURATED_KIDS_VIDEOS, parseYouTubeVideoId, type CuratedVideo } from '../utils/youtube';
import { YouTubeSafePlayer } from './YouTubeSafePlayer';

interface SafeYouTubeSectionProps {
  isBlackoutActive: boolean;
  isExpanded: boolean;
  isMonitoring: boolean;
  status: GuardStatus;
  distanceCm: number | null;
  thresholdCm: number;
  pinLockEnabled: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onStartMonitoring: () => void;
  onPlaybackSyncMessage?: (msg: string | null) => void;
}

function VideoThumbnail({ videoId, title }: { videoId: string; title: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-28 sm:w-32 aspect-video rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
        <Tv className="w-5 h-5" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="relative w-28 sm:w-32 aspect-video rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-200">
      <img
        src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
        alt={title}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

export function SafeYouTubeSection({
  isBlackoutActive,
  isExpanded,
  isMonitoring,
  status,
  distanceCm,
  thresholdCm,
  pinLockEnabled,
  onExpand,
  onCollapse,
  onStartMonitoring,
  onPlaybackSyncMessage,
}: SafeYouTubeSectionProps) {
  const [activeVideoId, setActiveVideoId] = useState<string>(CURATED_KIDS_VIDEOS[0].id);
  const [activeTitle, setActiveTitle] = useState<string>(CURATED_KIDS_VIDEOS[0].title);
  const [activeChannel, setActiveChannel] = useState<string>(CURATED_KIDS_VIDEOS[0].channel);
  const [autoplayKey, setAutoplayKey] = useState(0);

  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  const handlePlayUrlSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsedId = parseYouTubeVideoId(urlInput);
    if (!parsedId) {
      setUrlError(
        'Link chưa hợp lệ. Hãy dán link youtube.com/watch?v=..., youtu.be/... hoặc youtube.com/shorts/...'
      );
      return;
    }

    setUrlError(null);
    setActiveVideoId(parsedId);
    setActiveTitle('Video từ liên kết đã dán');
    setActiveChannel(`ID: ${parsedId}`);
    setAutoplayKey((k) => k + 1);
  };

  const handleSelectCurated = (video: CuratedVideo) => {
    setUrlError(null);
    setActiveVideoId(video.id);
    setActiveTitle(video.title);
    setActiveChannel(video.channel);
    setAutoplayKey((k) => k + 1);
  };

  return (
    <section className="space-y-4">
      {/* Main Safe YouTube Player Card (card chrome hides in expanded mode while keeping player mounted) */}
      <div
        className={
          isExpanded
            ? ''
            : 'bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4'
        }
      >
        {!isExpanded && (
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Góc xem YouTube an toàn
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[240px] sm:max-w-md">
                {activeTitle} · {activeChannel}
              </p>
            </div>
            <a
              href="https://m.youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0"
            >
              <span>Mở YouTube</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            </a>
          </div>
        )}

        {/* Inline / Edge-to-Edge YouTube IFrame Player */}
        <YouTubeSafePlayer
          videoId={activeVideoId}
          autoplayRequestKey={autoplayKey}
          isBlackoutActive={isBlackoutActive}
          isExpanded={isExpanded}
          isMonitoring={isMonitoring}
          status={status}
          distanceCm={distanceCm}
          thresholdCm={thresholdCm}
          pinLockEnabled={pinLockEnabled}
          onExpand={onExpand}
          onCollapse={onCollapse}
          onStartMonitoring={onStartMonitoring}
          onPlaybackSyncMessage={onPlaybackSyncMessage}
        />

        {/* Paste YouTube Link Form */}
        {!isExpanded && (
          <form onSubmit={handlePlayUrlSubmit} className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Link2
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="url"
                  inputMode="url"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    if (urlError) setUrlError(null);
                  }}
                  placeholder="Dán link YouTube (watch, youtu.be, shorts)..."
                  aria-label="Dán link YouTube"
                  className="w-full min-h-[44px] pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:outline-none text-sm text-slate-900 placeholder:text-slate-400"
                />
                {urlInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setUrlInput('');
                      setUrlError(null);
                    }}
                    aria-label="Xóa link đã dán"
                    className="min-w-[40px] min-h-[40px] absolute right-1 top-1/2 -translate-y-1/2 rounded-lg text-slate-400 hover:text-slate-700 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>Phát video</span>
              </button>
            </div>

            {urlError && (
              <p role="alert" className="text-xs font-medium text-red-600 px-1">
                {urlError}
              </p>
            )}
          </form>
        )}
      </div>

      {/* Curated Educational Kids Videos List (hidden during edge-to-edge mode) */}
      {!isExpanded && (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">
              Video thiếu nhi giáo dục gợi ý
            </h2>
            <span className="text-xs text-slate-500">Chạm để phát ngay</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {CURATED_KIDS_VIDEOS.map((video) => {
              const isSelected = activeVideoId === video.id;
              return (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => handleSelectCurated(video)}
                  className={`w-full min-h-[76px] p-2.5 rounded-2xl border text-left flex items-center gap-3 transition-all active:scale-[0.99] ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-300'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <VideoThumbnail videoId={video.id} title={video.title} />

                  <div className="min-w-0 flex-1 space-y-1">
                    <div
                      className={`text-sm font-semibold leading-snug line-clamp-2 ${
                        isSelected ? 'text-blue-900' : 'text-slate-900'
                      }`}
                    >
                      {video.title}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                      <span className="truncate">{video.channel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0">{video.topic}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums shrink-0">
                        {video.durationLabel}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
