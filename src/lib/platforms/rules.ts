import type { MediaInfo, ValidationError } from './types';

/** Utilitários partilhados pelos validadores. Mensagens em pt-PT. */
export const isJpeg = (m: MediaInfo) => m.mime === 'image/jpeg' || m.mime === 'image/jpg';
export const isVideo = (m: MediaInfo) => m.kind === 'video';

export function captionMax(caption: string, max: number, label = 'A legenda'): ValidationError[] {
  return caption.length > max
    ? [{ field: 'caption', message: `${label} tem ${caption.length} caracteres; o máximo é ${max}.` }]
    : [];
}

export function noMedia(media: MediaInfo[]): ValidationError[] {
  return media.length === 0 ? [{ field: 'media', message: 'Escolha pelo menos um ficheiro.' }] : [];
}

export function videoDuration(m: MediaInfo, minS: number, maxS: number, what: string): ValidationError[] {
  if (m.durationS == null) return [];
  if (m.durationS < minS) return [{ field: 'media', message: `${what} tem de ter pelo menos ${minS} s.` }];
  if (m.durationS > maxS) return [{ field: 'media', message: `${what} pode ter no máximo ${formatDuration(maxS)}.` }];
  return [];
}

function formatDuration(s: number): string {
  return s >= 60 ? `${s / 60} min` : `${s} s`;
}
