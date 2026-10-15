import { describe, expect, it } from 'vitest';
import { openUrl } from './links';

describe('openUrl', () => {
  it('TikTok abre a app/site', () => expect(openUrl({ platform: 'tiktok', externalPostId: null })).toBe('https://www.tiktok.com/'));
  it('YouTube abre o Studio do vídeo', () => expect(openUrl({ platform: 'youtube', externalPostId: 'abc' })).toBe('https://studio.youtube.com/video/abc/edit'));
  it('YouTube sem id não tem link', () => expect(openUrl({ platform: 'youtube', externalPostId: null })).toBeNull());
  it('Instagram não tem passo manual', () => expect(openUrl({ platform: 'instagram', externalPostId: 'x' })).toBeNull());
});
