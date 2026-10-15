import { describe, expect, it } from 'vitest';
import { isPublicPath } from './paths';

describe('isPublicPath', () => {
  it.each(['/login', '/auth/callback', '/legal/privacidade', '/legal/termos', '/api/cron/tick', '/api/oauth/tiktok/callback', '/manifest.webmanifest', '/icons/icon-192.png', '/favicon.ico'])(
    '%s é público',
    (p) => expect(isPublicPath(p)).toBe(true),
  );

  it.each(['/', '/calendario', '/posts/novo', '/definicoes/contas', '/api/oauth/tiktok/start', '/legalx', '/loginx'])(
    '%s exige sessão',
    (p) => expect(isPublicPath(p)).toBe(false),
  );
});
