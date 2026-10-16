import { describe, expect, it } from 'vitest';
import { isPublicPath } from './paths';

describe('isPublicPath', () => {
  it.each(['/login', '/auth/callback', '/legal/privacidade', '/legal/termos', '/api/cron/tick', '/api/oauth/tiktok/callback', '/manifest.webmanifest', '/icons/icon-192.png', '/favicon.ico', '/tiktokAbc123.txt', '/legal/termos/tiktokAbc123.txt'])(
    '%s é público',
    (p) => expect(isPublicPath(p)).toBe(true),
  );

  it.each(['/', '/calendario', '/posts/novo', '/definicoes/contas', '/api/oauth/tiktok/start', '/legalx', '/loginx', '/tiktok.txt', '/posts/tiktokAbc.txt'])(
    '%s exige sessão',
    (p) => expect(isPublicPath(p)).toBe(false),
  );
});
