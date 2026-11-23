import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, Loader2 } from 'lucide-react';

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  loadVideoById: (videoId: string) => void;
  cueVideoById: (videoId: string) => void;
  getPlayerState: () => number;
  destroy: () => void;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId?: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (event: { target: YTPlayer }) => void;
        onStateChange?: (event: { data: number; target: YTPlayer }) => void;
        onError?: (event: { data: number }) => void;
      };
    }
  ) => YTPlayer;
  PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeIframeAPI(): Promise<YTNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('No window'));
  }
  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }
  if (ytApiPromise) {
    return ytApiPromise;
  }

  ytApiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previousCallback) previousCallback();
      if (window.YT && window.YT.Player) {
        resolve(window.YT);
      } else {
        reject(new Error('YouTube API failed to initialize'));
      }
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        ytApiPromise = null;
        reject(new Error('Không thể tải YouTube IFrame API'));
      };
      document.head.appendChild(script);
    }
  });

  return ytApiPromise;
}

interface YouTubeSafePlayerProps {
  videoId: string;
  autoplayRequestKey: number;
  isBlackoutActive: boolean;
  onPlaybackSyncMessage?: (msg: string | null) => void;
}

export function YouTubeSafePlayer({
  videoId,
  autoplayRequestKey,
  isBlackoutActive,
  onPlaybackSyncMessage,
}: YouTubeSafePlayerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const isReadyRef = useRef(false);

  const isPlayingRef = useRef(false);
  const wasPlayingBeforeBlackoutRef = useRef(false);
  const prevBlackoutRef = useRef(isBlackoutActive);
  const blackoutRef = useRef(isBlackoutActive);
  blackoutRef.current = isBlackoutActive;

  const initialVideoIdRef = useRef(videoId);
  const lastLoadedKeyRef = useRef(autoplayRequestKey);

  const [apiLoading, setApiLoading] = useState(true);
  const [embedError, setEmbedError] = useState<string | null>(null);

  // Initialize YouTube IFrame Player API once
  useEffect(() => {
    let cancelled = false;

    const initPlayer = async () => {
      try {
        const YT = await loadYouTubeIframeAPI();
        if (cancelled || !hostRef.current) return;

        // Create a dedicated inner mount node so YT.Player iframe replacement stays clean
        const mountNode = document.createElement('div');
        mountNode.className = 'w-full h-full';
        hostRef.current.innerHTML = '';
        hostRef.current.appendChild(mountNode);

        const player = new YT.Player(mountNode, {
          videoId: initialVideoIdRef.current,
          width: '100%',
          height: '100%',
          playerVars: {
            playsinline: 1,
            rel: 0,
            fs: 0,
            modestbranding: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              isReadyRef.current = true;
              setApiLoading(false);
              setEmbedError(null);
            },
            onStateChange: (event) => {
              if (cancelled) return;
              const state = event.data;
              if (state === 1 || state === 3) {
                // PLAYING or BUFFERING
                if (blackoutRef.current) {
                  // Enforce immediate pause if somehow triggered during blackout
                  wasPlayingBeforeBlackoutRef.current = true;
                  event.target.pauseVideo();
                } else {
                  isPlayingRef.current = true;
                }
              } else if (state === 2 || state === 0) {
                // PAUSED or ENDED (only mark manually paused if not caused by blackout)
                if (!blackoutRef.current) {
                  isPlayingRef.current = false;
                }
              }
            },
            onError: (event) => {
              if (cancelled) return;
              isPlayingRef.current = false;
              if (event.data === 101 || event.data === 150) {
                setEmbedError(
                  'Chủ sở hữu video này không cho phép phát nhúng ngoài YouTube. Hãy chọn video khác hoặc mở trực tiếp trên YouTube.'
                );
              } else if (event.data === 100 || event.data === 2) {
                setEmbedError('Video không tồn tại hoặc đã bị gỡ bỏ.');
              } else {
                setEmbedError('Không thể phát video này trong trình phát nhúng.');
              }
            },
          },
        });

        playerRef.current = player;
      } catch {
        if (!cancelled) {
          setApiLoading(false);
          setEmbedError('Không thể kết nối YouTube Player. Vui lòng kiểm tra mạng.');
        }
      }
    };

    void initPlayer();

    return () => {
      cancelled = true;
      isReadyRef.current = false;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignore destroy errors
        }
        playerRef.current = null;
      }
    };
  }, []);

  // Load new video when user selects a curated video or submits a pasted URL
  useEffect(() => {
    if (!isReadyRef.current || !playerRef.current) return;
    if (autoplayRequestKey === lastLoadedKeyRef.current) return;

    lastLoadedKeyRef.current = autoplayRequestKey;
    setEmbedError(null);
    wasPlayingBeforeBlackoutRef.current = false;

    try {
      if (blackoutRef.current) {
        playerRef.current.cueVideoById(videoId);
      } else {
        playerRef.current.loadVideoById(videoId);
        isPlayingRef.current = true;
      }
    } catch {
      // Ignore transient player load issues
    }
  }, [videoId, autoplayRequestKey]);

  // Synchronize strictly with KidEye Guard blackout state
  useEffect(() => {
    const player = playerRef.current;
    const wasBlackout = prevBlackoutRef.current;
    prevBlackoutRef.current = isBlackoutActive;

    if (!player || !isReadyRef.current) return;

    if (isBlackoutActive && !wasBlackout) {
      let currentlyPlaying = isPlayingRef.current;
      try {
        const state = player.getPlayerState();
        if (state === 1 || state === 3) {
          currentlyPlaying = true;
        }
      } catch {
        // Fallback to isPlayingRef
      }

      wasPlayingBeforeBlackoutRef.current = currentlyPlaying;
      try {
        player.pauseVideo();
      } catch {
        // Ignore
      }
      if (currentlyPlaying) {
        onPlaybackSyncMessage?.('Đã tạm dừng video YouTube vì quá gần mắt.');
      }
    } else if (!isBlackoutActive && wasBlackout) {
      if (wasPlayingBeforeBlackoutRef.current) {
        wasPlayingBeforeBlackoutRef.current = false;
        try {
          player.playVideo();
          isPlayingRef.current = true;
          onPlaybackSyncMessage?.('Đã tiếp tục phát video sau 3 giây an toàn.');
        } catch {
          // Ignore
        }
      }
    }
  }, [isBlackoutActive, onPlaybackSyncMessage]);

  return (
    <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
      <div ref={hostRef} className="w-full h-full" />

      {apiLoading && !embedError && (
        <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-white p-4 text-center">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-2" />
          <p className="text-xs text-slate-300">Đang tải trình phát YouTube an toàn...</p>
        </div>
      )}

      {embedError && (
        <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-white p-5 text-center">
          <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
          <p className="text-sm font-semibold">Không thể phát nhúng video này</p>
          <p className="text-xs text-slate-300 mt-1 max-w-xs leading-relaxed">
            {embedError}
          </p>
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <span>Mở trên YouTube</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>
      )}
    </div>
  );
}
