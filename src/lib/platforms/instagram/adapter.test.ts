import { beforeEach, describe, expect, it } from 'vitest';
import { DeferError, PermanentError } from '../errors';
import { fakeFetch, jsonResponse, type FakeFetch, type Route } from '../testing/fake-fetch';
import type { AdvanceDeps, MediaInfo, TargetCtx } from '../types';
import { instagramAdapter } from './adapter';

const NOW = new Date('2026-10-15T10:00:00Z');
const adapter = instagramAdapter({ appId: 'app', appSecret: 'sec', apiVersion: 'v23.0' });
const acct = { id: 'a1', externalId: 'IG1', accessToken: 'tok' };
const jpg: MediaInfo = { id: 'm1', kind: 'image', mime: 'image/jpeg', sizeBytes: 10, width: 1080, height: 1350, durationS: null, storagePath: 'b/1.jpg' };
const vid: MediaInfo = { id: 'm2', kind: 'video', mime: 'video/mp4', sizeBytes: 10, width: 1080, height: 1920, durationS: 20, storagePath: 'b/2.mp4' };

function target(over: Partial<TargetCtx> = {}): TargetCtx {
  return { id: 't1', format: 'ig_image', caption: 'Olá #uni', title: null, options: {}, progress: {}, media: [jpg], ...over };
}

let fetch: FakeFetch;
let deps: AdvanceDeps;
const limitOk: Route = ['GET', /content_publishing_limit/, () => ({ data: [{ quota_usage: 3, config: { quota_total: 100 } }] })];

beforeEach(() => {
  fetch = fakeFetch([limitOk]);
  deps = {
    fetch,
    now: () => NOW,
    deadline: new Date(NOW.getTime() + 40_000),
    storage: { signedUrl: async (p) => `https://cdn.test/${p}?sig=1`, readRange: async () => new Uint8Array() },
    usageToday: async () => 0,
    recordUsage: async () => {},
  };
});

const route = (r: Route) => fetch.routes.push(r);
const startedAt = NOW.toISOString();

describe('instagramAdapter.advance', () => {
  it('ig_image: 1.º advance verifica o limite, cria o contentor e fica em processing', async () => {
    route(['POST', /\/IG1\/media$/, () => ({ id: 'c1' })]);
    const r = await adapter.advance(target(), acct, deps);
    expect(r).toEqual({ kind: 'progress', status: 'processing', progress: { step: 'container', containerId: 'c1', startedAt } });
    const create = fetch.calls.find((c) => c.method === 'POST')!;
    expect(create.url).toBe('https://graph.instagram.com/v23.0/IG1/media');
    expect(create.params).toMatchObject({ image_url: 'https://cdn.test/b/1.jpg?sig=1', caption: 'Olá #uni', access_token: 'tok' });
  });

  it('com FINISHED publica e devolve o permalink', async () => {
    route(['GET', /\/c1\?/, () => ({ status_code: 'FINISHED' })]);
    route(['POST', /media_publish/, (c) => (c.params.creation_id === 'c1' ? { id: '1789' } : jsonResponse(400, {}))]);
    route(['GET', /\/1789\?/, () => ({ permalink: 'https://instagram.com/p/x' })]);
    const r = await adapter.advance(target({ progress: { step: 'container', containerId: 'c1', startedAt } }), acct, deps);
    expect(r).toMatchObject({ kind: 'published', externalPostId: '1789', permalink: 'https://instagram.com/p/x' });
  });

  it('IN_PROGRESS mantém processing sem publicar', async () => {
    route(['GET', /\/c1\?/, () => ({ status_code: 'IN_PROGRESS' })]);
    const progress = { step: 'container', containerId: 'c1', startedAt };
    const r = await adapter.advance(target({ progress }), acct, deps);
    expect(r).toEqual({ kind: 'progress', status: 'processing', progress });
    expect(fetch.calls.some((c) => c.url.includes('media_publish'))).toBe(false);
  });

  it('contentor PUBLISHED recupera o media id sem republicar', async () => {
    route(['GET', /\/c1\?/, () => ({ status_code: 'PUBLISHED' })]);
    route(['GET', /\/IG1\/media\?/, () => ({ data: [
      { id: 'm8', caption: 'outro', permalink: 'p8', timestamp: '2026-10-15T09:59:00+0000' },
      { id: 'm9', caption: 'Olá #uni', permalink: 'p9', timestamp: '2026-10-15T10:00:00+0000' },
    ] })]);
    const r = await adapter.advance(target({ progress: { step: 'container', containerId: 'c1', startedAt } }), acct, deps);
    expect(r).toMatchObject({ kind: 'published', externalPostId: 'm9', permalink: 'p9' });
    expect(fetch.calls.some((c) => c.url.includes('media_publish'))).toBe(false);
  });

  it('ERROR no contentor → PermanentError em português', async () => {
    route(['GET', /\/c1\?/, () => ({ status_code: 'ERROR' })]);
    const err = await adapter.advance(target({ progress: { step: 'container', containerId: 'c1', startedAt } }), acct, deps).catch((e) => e);
    expect(err).toBeInstanceOf(PermanentError);
    expect(err.userMessage).toMatch(/Instagram/);
  });

  it('processamento há mais de 30 min → PermanentError', async () => {
    route(['GET', /\/c1\?/, () => ({ status_code: 'IN_PROGRESS' })]);
    const old = new Date(NOW.getTime() - 31 * 60_000).toISOString();
    const err = await adapter.advance(target({ progress: { step: 'container', containerId: 'c1', startedAt: old } }), acct, deps).catch((e) => e);
    expect(err).toBeInstanceOf(PermanentError);
    expect(err.userMessage).toMatch(/Tempo de processamento/);
  });

  it('limite atingido → DeferError com until = now + 1h', async () => {
    fetch.routes[0] = ['GET', /content_publishing_limit/, () => ({ data: [{ quota_usage: 50, config: { quota_total: 50 } }] })];
    const err = await adapter.advance(target(), acct, deps).catch((e) => e);
    expect(err).toBeInstanceOf(DeferError);
    expect(err.until.toISOString()).toBe('2026-10-15T11:00:00.000Z');
  });

  it('carrossel: cria filhos, espera FINISHED de todos, cria o pai e publica', async () => {
    let n = 0;
    route(['POST', /\/IG1\/media$/, (c) => (c.params.media_type === 'CAROUSEL' ? { id: 'parent' } : { id: `ch${++n}` })]);
    const t = target({ format: 'ig_carousel', media: [jpg, vid] });

    const r1 = await adapter.advance(t, acct, deps);
    expect(r1).toMatchObject({ kind: 'progress', progress: { step: 'children', childIds: ['ch1', 'ch2'] } });
    const children = fetch.calls.filter((c) => c.method === 'POST');
    expect(children[0].params).toMatchObject({ is_carousel_item: 'true', image_url: expect.any(String) });
    expect(children[1].params).toMatchObject({ is_carousel_item: 'true', media_type: 'VIDEO', video_url: expect.any(String) });
    expect(children[0].params.caption).toBeUndefined();

    let ch2 = 'IN_PROGRESS';
    route(['GET', /\/ch1\?/, () => ({ status_code: 'FINISHED' })]);
    route(['GET', /\/ch2\?/, () => ({ status_code: ch2 })]);
    const r2 = await adapter.advance({ ...t, progress: (r1 as { progress: object }).progress }, acct, deps);
    expect(r2).toMatchObject({ progress: { step: 'children' } });

    ch2 = 'FINISHED';
    const r3 = await adapter.advance({ ...t, progress: (r2 as { progress: object }).progress }, acct, deps);
    expect(r3).toMatchObject({ progress: { step: 'container', containerId: 'parent' } });
    const parent = fetch.calls.filter((c) => c.method === 'POST').at(-1)!;
    expect(parent.params).toMatchObject({ media_type: 'CAROUSEL', children: 'ch1,ch2', caption: 'Olá #uni' });
  });

  it('reel envia media_type=REELS e share_to_feed=true', async () => {
    route(['POST', /\/IG1\/media$/, () => ({ id: 'c1' })]);
    await adapter.advance(target({ format: 'ig_reel', media: [vid] }), acct, deps);
    expect(fetch.calls.find((c) => c.method === 'POST')!.params).toMatchObject({
      media_type: 'REELS', share_to_feed: 'true', video_url: 'https://cdn.test/b/2.mp4?sig=1', caption: 'Olá #uni',
    });
  });

  it('story não envia caption', async () => {
    route(['POST', /\/IG1\/media$/, () => ({ id: 'c1' })]);
    await adapter.advance(target({ format: 'ig_story' }), acct, deps);
    const p = fetch.calls.find((c) => c.method === 'POST')!.params;
    expect(p).toMatchObject({ media_type: 'STORIES', image_url: expect.any(String) });
    expect(p.caption).toBeUndefined();
  });
});
