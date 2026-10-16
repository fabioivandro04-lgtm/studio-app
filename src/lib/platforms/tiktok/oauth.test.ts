import { describe, expect, it } from 'vitest';
import { fakeFetch } from '../testing/fake-fetch';
import { tiktokAdapter } from './adapter';

const NOW = new Date('2026-10-15T10:00:00Z');
const adapter = tiktokAdapter({ clientKey: 'ck', clientSecret: 'cs' });
const acct = { id: 'a', externalId: 'open1', accessToken: 'tok' };

describe('TikTok OAuth', () => {
  it('authorizeUrl com os scopes da spec', () => {
    const u = new URL(adapter.authorizeUrl('st', 'https://app/cb'));
    expect(u.origin + u.pathname).toBe('https://www.tiktok.com/v2/auth/authorize/');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      client_key: 'ck', response_type: 'code', redirect_uri: 'https://app/cb', state: 'st',
      scope: 'user.info.basic,user.info.stats,video.upload,video.list',
    });
  });

  it('exchangeCode guarda open_id como externalId e as validades', async () => {
    const fetch = fakeFetch([
      ['POST', /oauth\/token/, (c) => {
        expect(c.params).toMatchObject({ client_key: 'ck', client_secret: 'cs', code: 'CODE', grant_type: 'authorization_code', redirect_uri: 'https://app/cb' });
        return { access_token: 'at', expires_in: 86400, refresh_token: 'rt', refresh_expires_in: 31536000, open_id: 'open1', scope: 'user.info.basic,video.upload' };
      }],
      ['GET', /user\/info/, (c) => {
        expect(c.headers.authorization).toBe('Bearer at');
        // "username" exige o scope user.info.profile, que não pedimos: só campos de user.info.basic.
        expect(c.url).toContain('fields=open_id%2Cavatar_url%2Cdisplay_name');
        expect(c.url).not.toContain('username');
        return { data: { user: { open_id: 'open1', display_name: 'Viral', avatar_url: 'https://a' } }, error: { code: 'ok' } };
      }],
    ]);
    const r = await adapter.exchangeCode('CODE', 'https://app/cb', { fetch, now: () => NOW });
    expect(r.tokens).toEqual({
      accessToken: 'at', refreshToken: 'rt', expiresAt: new Date('2026-10-16T10:00:00Z'),
      refreshExpiresAt: new Date('2027-10-15T10:00:00Z'), scopes: ['user.info.basic', 'video.upload'],
    });
    expect(r.profile).toEqual({ externalId: 'open1', handle: 'Viral', displayName: 'Viral', avatarUrl: 'https://a' });
  });

  it('exchangeCode mostra o erro do TikTok quando o token não vem (200 com error)', async () => {
    const fetch = fakeFetch([['POST', /oauth\/token/, () => ({ error: 'invalid_client', error_description: 'Client key or secret is incorrect.' })]]);
    await expect(adapter.exchangeCode('CODE', 'https://app/cb', { fetch, now: () => NOW })).rejects.toMatchObject({
      userMessage: 'O TikTok recusou a ligação (invalid_client: Client key or secret is incorrect.).',
    });
  });

  it('refreshToken usa grant_type=refresh_token', async () => {
    const fetch = fakeFetch([['POST', /oauth\/token/, (c) => {
      expect(c.params).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'rt' });
      return { access_token: 'at2', expires_in: 86400, refresh_token: 'rt2', refresh_expires_in: 31536000, scope: 'video.upload' };
    }]]);
    const t = await adapter.refreshToken({ accessToken: 'at', refreshToken: 'rt' }, { fetch, now: () => NOW });
    expect(t).toMatchObject({ accessToken: 'at2', refreshToken: 'rt2' });
  });
});

describe('TikTok métricas', () => {
  it('conta: seguidores', async () => {
    const fetch = fakeFetch([['GET', /user\/info/, () => ({ data: { user: { follower_count: 500, likes_count: 9, video_count: 3 } }, error: { code: 'ok' } })]]);
    expect(await adapter.fetchAccountMetrics(acct, { fetch })).toMatchObject({ followers: 500 });
  });

  it('posts: video/query em lotes de 20', async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `v${i}`);
    const fetch = fakeFetch([['POST', /video\/query/, (c) => {
      const asked = (c.body as { filters: { video_ids: string[] } }).filters.video_ids;
      return { data: { videos: asked.map((id) => ({ id, view_count: 10, like_count: 2, comment_count: 1, share_count: 3 })) }, error: { code: 'ok' } };
    }]]);
    const r = await adapter.fetchPostMetrics(acct, ids, { fetch });
    expect(fetch.calls).toHaveLength(2);
    expect(Object.keys(r)).toHaveLength(25);
    expect(r.v0).toMatchObject({ views: 10, likes: 2, comments: 1, shares: 3, isPublic: true });
  });

  it('listRecentPosts converte create_time e filtra', async () => {
    const fetch = fakeFetch([['POST', /video\/list/, () => ({ data: { videos: [
      { id: 'n', create_time: 1760522400, share_url: 'https://tiktok/n', cover_image_url: 'c', title: 't' },
      { id: 'o', create_time: 1700000000 },
    ] }, error: { code: 'ok' } })]]);
    const r = await adapter.listRecentPosts(acct, new Date('2025-10-01T00:00:00Z'), { fetch });
    expect(r).toEqual([{ externalId: 'n', createdAt: new Date(1760522400 * 1000), permalink: 'https://tiktok/n', thumbnailUrl: 'c', title: 't' }]);
  });
});
