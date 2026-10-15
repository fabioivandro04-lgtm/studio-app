import type { Platform } from '@/lib/platforms/types';

/** Onde o utilizador conclui o "1 toque" de cada rede. */
export function openUrl(item: { platform: Platform; externalPostId: string | null }): string | null {
  if (item.platform === 'tiktok') return 'https://www.tiktok.com/';
  if (item.platform === 'youtube' && item.externalPostId) return `https://studio.youtube.com/video/${item.externalPostId}/edit`;
  return null;
}
