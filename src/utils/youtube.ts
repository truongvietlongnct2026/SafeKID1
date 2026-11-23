export interface CuratedVideo {
  id: string;
  title: string;
  channel: string;
  topic: string;
  durationLabel: string;
}

export function parseYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Direct 11-character YouTube video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  let candidateUrl = trimmed;
  if (!/^https?:\/\//i.test(candidateUrl)) {
    candidateUrl = `https://${candidateUrl}`;
  }

  try {
    const url = new URL(candidateUrl);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();

    // youtu.be/VIDEO_ID
    if (host === 'youtu.be') {
      const seg = url.pathname.split('/').filter(Boolean)[0];
      if (seg && /^[a-zA-Z0-9_-]{11}$/.test(seg)) {
        return seg;
      }
    }

    // youtube.com / m.youtube.com / music.youtube.com / youtube-nocookie.com
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      // /watch?v=VIDEO_ID
      const vParam = url.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
        return vParam;
      }

      // /shorts/VIDEO_ID, /embed/VIDEO_ID, /live/VIDEO_ID, /v/VIDEO_ID
      const parts = url.pathname.split('/').filter(Boolean);
      if (
        parts.length >= 2 &&
        ['shorts', 'embed', 'live', 'v'].includes(parts[0].toLowerCase())
      ) {
        const idPart = parts[1];
        if (/^[a-zA-Z0-9_-]{11}$/.test(idPart)) {
          return idPart;
        }
      }
    }
  } catch {
    // Fallback regex extraction for partial pasted strings
    const match = trimmed.match(
      /(?:v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([a-zA-Z0-9_-]{11})/
    );
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export const CURATED_KIDS_VIDEOS: CuratedVideo[] = [
  {
    id: 'l4WNrvVjiTw',
    title: "If You're Happy — Vận động & Cảm xúc",
    channel: 'Super Simple Songs',
    topic: 'Tiếng Anh mầm non',
    durationLabel: '2:00',
  },
  {
    id: '75p-N9YKqNo',
    title: 'The ABC Song — Học bảng chữ cái',
    channel: 'KidsTV123',
    topic: 'Chữ cái ABC',
    durationLabel: '2:18',
  },
  {
    id: 'DR-cfDsHCGA',
    title: 'Counting 1–10 Song — Học đếm số',
    channel: 'The Singing Walrus',
    topic: 'Toán học vui',
    durationLabel: '2:45',
  },
  {
    id: 'Qd6nLM2QlWw',
    title: 'Exploring Our Solar System — Khám phá Hệ Mặt Trời',
    channel: 'Free School',
    topic: 'Khoa học & Vũ trụ',
    durationLabel: '11:55',
  },
  {
    id: 'mXMofxtDPUQ',
    title: 'Days of the Week Song — Các ngày trong tuần',
    channel: 'The Singing Walrus',
    topic: 'Tiếng Anh thiếu nhi',
    durationLabel: '2:30',
  },
  {
    id: 'GzrjwOQpAl0',
    title: 'The Wheels On The Bus — Bài hát tương tác',
    channel: 'Super Simple Songs',
    topic: 'Âm nhạc thiếu nhi',
    durationLabel: '3:55',
  },
  {
    id: 'h4eueDYPTIg',
    title: 'Head, Shoulders, Knees & Toes — Từ vựng cơ thể',
    channel: 'ChuChu TV',
    topic: 'Vận động',
    durationLabel: '2:10',
  },
  {
    id: 'libKVRa01L8',
    title: 'Solar System 101 — Bí ẩn các hành tinh',
    channel: 'National Geographic',
    topic: 'Thiên văn học',
    durationLabel: '4:10',
  },
];
