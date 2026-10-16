import { describe, expect, it } from 'vitest';
import { isPublicPath, loginNext } from './paths';

describe('isPublicPath', () => {
  it.each(['/login', '/auth/callback', '/legal/privacidade', '/legal/termos', '/api/cron/tick', '/api/oauth/tiktok/callback', '/manifest.webmanifest', '/icons/icon-192.png', '/favicon.ico', '/tiktokAbc123.txt', '/legal/termos/tiktokAbc123.txt', '/api/mcp', '/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/api/mcp'])(
    '%s é público',
    (p) => expect(isPublicPath(p)).toBe(true),
  );

  it.each(['/', '/calendario', '/posts/novo', '/definicoes/contas', '/api/oauth/tiktok/start', '/legalx', '/loginx', '/tiktok.txt', '/posts/tiktokAbc.txt', '/oauth/autorizar', '/api/mcpx', '/.well-known/outra'])(
    '%s exige sessão',
    (p) => expect(isPublicPath(p)).toBe(false),
  );
});

describe('loginNext', () => {
  it('guarda caminho e query (o pedido OAuth precisa do authorization_id)', () => {
    expect(loginNext('/oauth/autorizar', '?authorization_id=abc')).toBe('/oauth/autorizar?authorization_id=abc');
    expect(loginNext('/calendario', '')).toBe('/calendario');
    expect(loginNext('/', '')).toBeNull();
  });
});
