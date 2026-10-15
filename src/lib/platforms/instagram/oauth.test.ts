import { describe, expect, it } from 'vitest';
import { fakeFetch } from '../testing/fake-fetch';
import { instagramAdapter } from './adapter';

const NOW = new Date('2026-10-15T10:00:00Z');
const adapter = instagramAdapter({ appId: 'app', appSecret: 'sec', apiVersion: 'v23.0' });

describe('Instagram OAuth', () => {
  it('authorizeUrl pede as permissões de leitura e publicação', () => {
    const u = new URL(adapter.authorizeUrl('st', 'https://app/cb'));
    expect(u.origin + u.pathname).toBe('https://www.instagram.com/oauth/authorize');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      client_id: 'app', redirect_uri: 'https://app/cb', response_type: 'code', state: 'st',
      scope: 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights',
    });
  });

  it('exchangeCode troca código → token curto → token longo e lê o perfil', async () => {
    const fetch = fakeFetch([
      ['POST', /api\.instagram\.com\/oauth\/access_token/, (c) => {
        expect(c.params).toMatchObject({ client_id: 'app', client_secret: 'sec', grant_type: 'authorization_code', code: 'CODE', redirect_uri: 'https://app/cb' });
        return { access_token: 'short', user_id: 1 };
      }],
      ['GET', /graph\.instagram\.com\/access_token\?/, (c) => {
        expect(c.params).toMatchObject({ grant_type: 'ig_exchange_token', client_secret: 'sec', access_token: 'short' });
        return { access_token: 'long', expires_in: 5184000 };
      }],
      ['GET', /\/me\?/, () => ({ user_id: '1784', username: 'unidreamity', name: 'Unidreamity', profile_picture_url: 'https://pic' })],
    ]);
    const r = await adapter.exchangeCode('CODE', 'https://app/cb', { fetch, now: () => NOW });
    expect(r.tokens).toEqual({
      accessToken: 'long', refreshToken: null, expiresAt: new Date('2026-12-14T10:00:00Z'), refreshExpiresAt: null,
      scopes: ['instagram_business_basic', 'instagram_business_content_publish', 'instagram_business_manage_insights'],
    });
    expect(r.profile).toEqual({ externalId: '1784', handle: 'unidreamity', displayName: 'Unidreamity', avatarUrl: 'https://pic' });
  });

  it('refreshToken usa ig_refresh_token', async () => {
    const fetch = fakeFetch([
      ['GET', /refresh_access_token\?/, (c) => {
        expect(c.params).toMatchObject({ grant_type: 'ig_refresh_token', access_token: 'long' });
        return { access_token: 'long2', expires_in: 5184000 };
      }],
    ]);
    const t = await adapter.refreshToken({ accessToken: 'long', refreshToken: null }, { fetch, now: () => NOW });
    expect(t.accessToken).toBe('long2');
    expect(t.expiresAt?.toISOString()).toBe('2026-12-14T10:00:00.000Z');
  });
});

describe('Instagram métricas', () => {
  const acct = { id: 'a', externalId: 'IG1', accessToken: 'tok' };
  it('seguidores da conta', async () => {
    const fetch = fakeFetch([['GET', /\/me\?/, () => ({ followers_count: 1200, media_count: 40 })]]);
    expect(await adapter.fetchAccountMetrics(acct, { fetch })).toMatchObject({ followers: 1200 });
  });

  it('insights por post; post com erro é ignorado', async () => {
    const fetch = fakeFetch([
      ['GET', /\/m1\/insights/, () => ({ data: [
        { name: 'reach', values: [{ value: 100 }] }, { name: 'views', values: [{ value: 250 }] },
        { name: 'likes', values: [{ value: 9 }] }, { name: 'comments', values: [{ value: 2 }] },
        { name: 'saved', values: [{ value: 4 }] }, { name: 'shares', values: [{ value: 1 }] },
      ] })],
      ['GET', /\/m2\/insights/, () => new Response(JSON.stringify({ error: { message: 'unsupported' } }), { status: 400 })],
    ]);
    const r = await adapter.fetchPostMetrics(acct, ['m1', 'm2'], { fetch });
    expect(r.m1).toMatchObject({ reach: 100, views: 250, likes: 9, comments: 2, saves: 4, shares: 1, isPublic: true, watchTimeS: null });
    expect(r.m2).toBeUndefined();
  });

  it('insights extra: profile_visits e follows', async () => {
    const fetch = fakeFetch([
      ['GET', /\/m1\/insights/, (c) =>
        c.params.metric === 'profile_visits,follows'
          ? { data: [{ name: 'profile_visits', values: [{ value: 7 }] }, { name: 'follows', values: [{ value: 2 }] }] }
          : { data: [{ name: 'reach', values: [{ value: 100 }] }] }],
    ]);
    const r = await adapter.fetchPostMetrics(acct, ['m1'], { fetch });
    expect(r.m1).toMatchObject({ reach: 100, profileVisits: 7, follows: 2 });
  });

  it('insights extra falham → campos nulos e métricas base mantêm-se', async () => {
    const fetch = fakeFetch([
      ['GET', /\/m1\/insights/, (c) =>
        c.params.metric === 'profile_visits,follows'
          ? new Response(JSON.stringify({ error: { message: 'unsupported metric' } }), { status: 400 })
          : { data: [{ name: 'reach', values: [{ value: 100 }] }] }],
    ]);
    const r = await adapter.fetchPostMetrics(acct, ['m1'], { fetch });
    expect(r.m1).toMatchObject({ reach: 100, profileVisits: null, follows: null });
  });

  it('listRecentPosts filtra pela data', async () => {
    const fetch = fakeFetch([['GET', /\/IG1\/media\?/, () => ({ data: [
      { id: 'a', timestamp: '2026-10-15T09:00:00+0000', permalink: 'pa', caption: 'x' },
      { id: 'b', timestamp: '2026-10-14T09:00:00+0000', permalink: 'pb' },
    ] })]]);
    const r = await adapter.listRecentPosts(acct, new Date('2026-10-15T00:00:00Z'), { fetch });
    expect(r.map((p) => p.externalId)).toEqual(['a']);
  });
});
