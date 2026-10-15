import { beforeEach, describe, expect, it } from 'vitest';
import { DeferError } from '../errors';
import { fakeFetch, jsonResponse, type FakeFetch } from '../testing/fake-fetch';
import type { AdvanceDeps, MediaInfo, TargetCtx } from '../types';
import { youtubeAdapter } from './adapter';

const MiB = 1024 * 1024;
const NOW = new Date('2026-10-15T10:00:00Z');
const adapter = youtubeAdapter({ clientId: 'cid', clientSecret: 'cs', uploadUnits: 1600, dailyUnits: 10000 });
const acct = { id: 'a1', externalId: 'UC1', accessToken: 'tok' };
const video = (size: number): MediaInfo => ({ id: 'v', kind: 'video', mime: 'video/mp4', sizeBytes: size, width: 1080, height: 1920, durationS: 30, storagePath: 'b/v.mp4' });
const target = (size: number, progress = {}): TargetCtx => ({ id: 't', format: 'yt_short', caption: 'descrição', title: 'Título', options: {}, progress, media: [video(size)] });

let fetch: FakeFetch;
let deps: AdvanceDeps;
let clock: Date;
let usage: number;
const recorded: Array<[string, number]> = [];

beforeEach(() => {
  clock = NOW;
  usage = 0;
  recorded.length = 0;
  fetch = fakeFetch([]);
  deps = {
    fetch,
    now: () => clock,
    deadline: new Date(NOW.getTime() + 40_000),
    storage: { signedUrl: async () => 'x', readRange: async (_p, s, e) => new Uint8Array(e - s + 1) },
    usageToday: async () => usage,
    recordUsage: async (k, u) => {
      recorded.push([k, u]);
    },
  };
});

const initRoute = () =>
  fetch.routes.push(['POST', /upload\/youtube\/v3\/videos\?uploadType=resumable/, () => new Response('', { status: 200, headers: { location: 'https://up.yt/s1' } })]);

describe('youtubeAdapter.advance', () => {
  it('init envia privacyStatus private e regista 1600 unidades', async () => {
    initRoute();
    fetch.routes.push(['PUT', /up\.yt\/s1/, () => jsonResponse(201, { id: 'vid1' })]);
    const r = await adapter.advance(target(3 * MiB), acct, deps);
    const init = fetch.calls[0];
    expect(init.url).toContain('part=snippet%2Cstatus');
    expect(init.headers['x-upload-content-length']).toBe(String(3 * MiB));
    expect(init.headers['x-upload-content-type']).toBe('video/mp4');
    expect(init.body).toEqual({
      snippet: { title: 'Título', description: 'descrição', categoryId: '22' },
      status: { privacyStatus: 'private', selfDeclaredMadeForKids: false },
    });
    expect(recorded).toEqual([['yt_units', 1600]]);
    expect(r).toEqual({
      kind: 'awaiting_user', externalPostId: 'vid1', permalink: 'https://youtube.com/shorts/vid1',
      progress: expect.objectContaining({ sessionUri: 'https://up.yt/s1' }),
    });
  });

  it('quota esgotada → DeferError até à meia-noite de Los Angeles, sem chamar a API', async () => {
    usage = 9000;
    const err = await adapter.advance(target(MiB), acct, deps).catch((e) => e);
    expect(err).toBeInstanceOf(DeferError);
    expect(err.until.toISOString()).toBe('2026-10-16T07:00:00.000Z');
    expect(fetch.calls).toHaveLength(0);
  });

  it('308 com Range bytes=0-8388607 → offset 8388608 e para no deadline', async () => {
    fetch.routes.push(['PUT', /up\.yt\/s1/, () => {
      clock = new Date(clock.getTime() + 50_000);
      return new Response('', { status: 308, headers: { range: 'bytes=0-8388607' } });
    }]);
    const r = await adapter.advance(target(20 * MiB, { step: 'uploading', sessionUri: 'https://up.yt/s1', offset: 0, startedAt: NOW.toISOString() }), acct, deps);
    expect(fetch.calls[0].headers['content-range']).toBe(`bytes 0-8388607/${20 * MiB}`);
    expect(r).toMatchObject({ kind: 'progress', status: 'uploading', progress: { offset: 8388608 } });
  });

  it('308 sem Range → offset 0', async () => {
    fetch.routes.push(['PUT', /up\.yt\/s1/, () => {
      clock = new Date(clock.getTime() + 50_000);
      return new Response('', { status: 308 });
    }]);
    const r = await adapter.advance(target(20 * MiB, { step: 'uploading', sessionUri: 'https://up.yt/s1', offset: 0, startedAt: NOW.toISOString() }), acct, deps);
    expect(r).toMatchObject({ progress: { offset: 0 } });
  });

  it('retoma do offset e a última parte vai até size-1', async () => {
    fetch.routes.push(['PUT', /up\.yt\/s1/, () => jsonResponse(200, { id: 'vid9' })]);
    const r = await adapter.advance(target(10 * MiB, { step: 'uploading', sessionUri: 'https://up.yt/s1', offset: 8 * MiB, startedAt: NOW.toISOString() }), acct, deps);
    expect(fetch.calls[0].headers['content-range']).toBe(`bytes ${8 * MiB}-${10 * MiB - 1}/${10 * MiB}`);
    expect(r).toMatchObject({ kind: 'awaiting_user', externalPostId: 'vid9' });
  });

  it('403 quotaExceeded durante o init → DeferError', async () => {
    fetch.routes.push(['POST', /upload\/youtube/, () => jsonResponse(403, { error: { code: 403, errors: [{ reason: 'quotaExceeded' }] } })]);
    await expect(adapter.advance(target(MiB), acct, deps)).rejects.toBeInstanceOf(DeferError);
  });
});

describe('YouTube OAuth e métricas', () => {
  it('authorizeUrl pede acesso offline e os 3 scopes', () => {
    const u = new URL(adapter.authorizeUrl('st', 'https://app/cb'));
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      client_id: 'cid', redirect_uri: 'https://app/cb', response_type: 'code', access_type: 'offline', prompt: 'consent', state: 'st',
      scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly',
    });
  });

  it('exchangeCode guarda refresh_token e lê o canal', async () => {
    const f = fakeFetch([
      ['POST', /oauth2\.googleapis\.com\/token/, (c) => {
        expect(c.params).toMatchObject({ code: 'CODE', grant_type: 'authorization_code', client_id: 'cid', client_secret: 'cs', redirect_uri: 'https://app/cb' });
        return { access_token: 'at', expires_in: 3600, refresh_token: 'rt', scope: 'a b' };
      }],
      ['GET', /channels\?/, () => ({ items: [{ id: 'UC1', snippet: { title: 'Viral', customUrl: '@viral', thumbnails: { default: { url: 'https://t' } } } }] })],
    ]);
    const r = await adapter.exchangeCode('CODE', 'https://app/cb', { fetch: f, now: () => NOW });
    expect(r.tokens).toMatchObject({ accessToken: 'at', refreshToken: 'rt', expiresAt: new Date('2026-10-15T11:00:00Z'), scopes: ['a', 'b'] });
    expect(r.profile).toEqual({ externalId: 'UC1', handle: '@viral', displayName: 'Viral', avatarUrl: 'https://t' });
  });

  it('refreshToken mantém o refresh_token quando o Google não devolve outro', async () => {
    const f = fakeFetch([['POST', /oauth2\.googleapis\.com\/token/, (c) => {
      expect(c.params).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'rt' });
      return { access_token: 'at2', expires_in: 3600 };
    }]]);
    const t = await adapter.refreshToken({ accessToken: 'at', refreshToken: 'rt' }, { fetch: f, now: () => NOW });
    expect(t).toMatchObject({ accessToken: 'at2', refreshToken: 'rt' });
  });

  it('fetchPostMetrics marca isPublic e converte minutos em segundos', async () => {
    const f = fakeFetch([
      ['GET', /youtube\/v3\/videos\?/, () => ({ items: [
        { id: 'v1', statistics: { viewCount: '100', likeCount: '5', commentCount: '2' }, status: { privacyStatus: 'public' } },
        { id: 'v2', statistics: { viewCount: '0' }, status: { privacyStatus: 'private' } },
      ] })],
      ['GET', /youtubeanalytics/, () => ({ rows: [['v1', 3]] })],
    ]);
    const r = await adapter.fetchPostMetrics(acct, ['v1', 'v2'], { fetch: f });
    expect(r.v1).toMatchObject({ views: 100, likes: 5, comments: 2, watchTimeS: 180, isPublic: true });
    expect(r.v2).toMatchObject({ isPublic: false, watchTimeS: null });
  });

  it('fetchAccountMetrics lê subscritores', async () => {
    const f = fakeFetch([['GET', /channels\?/, () => ({ items: [{ id: 'UC1', statistics: { subscriberCount: '42', viewCount: '900' } }] })]]);
    expect(await adapter.fetchAccountMetrics(acct, { fetch: f })).toMatchObject({ followers: 42, views: 900 });
  });
});
