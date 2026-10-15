import { beforeEach, describe, expect, it } from 'vitest';
import { AuthError, PermanentError } from '../errors';
import { fakeFetch, jsonResponse, type FakeFetch } from '../testing/fake-fetch';
import type { AdvanceDeps, MediaInfo, TargetCtx } from '../types';
import { planChunks, tiktokAdapter } from './adapter';

const MiB = 1024 * 1024;
const NOW = new Date('2026-10-15T10:00:00Z');
const adapter = tiktokAdapter({ clientKey: 'ck', clientSecret: 'cs' });
const acct = { id: 'a1', externalId: 'open1', accessToken: 'tok' };
const video = (size: number): MediaInfo => ({ id: 'v', kind: 'video', mime: 'video/mp4', sizeBytes: size, width: 1080, height: 1920, durationS: 30, storagePath: 'b/v.mp4' });
const target = (size: number, progress = {}): TargetCtx => ({ id: 't', format: 'tiktok_video', caption: 'olá', title: null, options: {}, progress, media: [video(size)] });

let fetch: FakeFetch;
let deps: AdvanceDeps;
let clock: Date;
const reads: Array<[number, number]> = [];

beforeEach(() => {
  reads.length = 0;
  clock = NOW;
  fetch = fakeFetch([]);
  deps = {
    fetch,
    now: () => clock,
    deadline: new Date(NOW.getTime() + 40_000),
    storage: {
      signedUrl: async () => 'https://cdn/x',
      readRange: async (_p, s, e) => {
        reads.push([s, e]);
        return new Uint8Array(e - s + 1);
      },
    },
    usageToday: async () => 0,
    recordUsage: async () => {},
  };
});

describe('planChunks', () => {
  it('ficheiro pequeno vai numa parte', () => {
    expect(planChunks(3_000_000)).toEqual({ chunkSize: 3_000_000, totalChunks: 1 });
  });
  it('partes de 10 MiB; a última absorve o resto', () => {
    expect(planChunks(25 * MiB)).toEqual({ chunkSize: 10 * MiB, totalChunks: 2 });
    expect(planChunks(10 * MiB)).toEqual({ chunkSize: 10 * MiB, totalChunks: 1 });
  });
});

describe('tiktokAdapter.advance', () => {
  const initRoute = () =>
    fetch.routes.push(['POST', /inbox\/video\/init/, () => ({ data: { publish_id: 'pub1', upload_url: 'https://up.tiktok/u1' }, error: { code: 'ok' } })]);
  const putRoute = () => fetch.routes.push(['PUT', /up\.tiktok/, () => new Response(null, { status: 206 })]);

  it('init usa FILE_UPLOAD (nunca PULL_FROM_URL) e envia as partes', async () => {
    initRoute();
    putRoute();
    const r = await adapter.advance(target(25 * MiB), acct, deps);
    const init = fetch.calls[0];
    expect(init.headers.authorization).toBe('Bearer tok');
    expect(init.body).toEqual({ source_info: { source: 'FILE_UPLOAD', video_size: 25 * MiB, chunk_size: 10 * MiB, total_chunk_count: 2 } });
    expect(JSON.stringify(fetch.calls)).not.toContain('PULL_FROM_URL');
    const puts = fetch.calls.filter((c) => c.method === 'PUT');
    expect(puts.map((c) => c.headers['content-range'])).toEqual(['bytes 0-10485759/26214400', 'bytes 10485760-26214399/26214400']);
    expect(puts[0].headers['content-type']).toBe('video/mp4');
    expect(reads).toEqual([[0, 10485759], [10485760, 26214399]]);
    expect(r).toMatchObject({ kind: 'progress', status: 'processing', progress: { publishId: 'pub1', nextChunk: 2 } });
  });

  it('pára no deadline e retoma em nextChunk no tick seguinte', async () => {
    initRoute();
    fetch.routes.push(['PUT', /up\.tiktok/, () => {
      clock = new Date(clock.getTime() + 30_000);
      return new Response(null, { status: 206 });
    }]);
    const r1 = await adapter.advance(target(35 * MiB), acct, deps);
    expect(r1).toMatchObject({ kind: 'progress', status: 'uploading', progress: { nextChunk: 2, totalChunks: 3 } });

    clock = NOW;
    deps.deadline = new Date(NOW.getTime() + 40_000);
    const r2 = await adapter.advance(target(35 * MiB, (r1 as { progress: Record<string, unknown> }).progress), acct, deps);
    expect(r2).toMatchObject({ kind: 'progress', status: 'processing', progress: { nextChunk: 3 } });
    expect(fetch.calls.filter((c) => c.method === 'POST')).toHaveLength(1); // init só uma vez
    expect(fetch.calls.at(-1)!.headers['content-range']).toBe(`bytes ${20 * MiB}-${35 * MiB - 1}/${35 * MiB}`);
  });

  it('SEND_TO_USER_INBOX → awaiting_user com uploadedAt', async () => {
    fetch.routes.push(['POST', /status\/fetch/, (c) => {
      expect(c.body).toEqual({ publish_id: 'pub1' });
      return { data: { status: 'SEND_TO_USER_INBOX' }, error: { code: 'ok' } };
    }]);
    const r = await adapter.advance(target(3_000_000, { step: 'processing', publishId: 'pub1', startedAt: NOW.toISOString() }), acct, deps);
    expect(r).toMatchObject({ kind: 'awaiting_user', externalPostId: null, permalink: null, progress: { uploadedAt: NOW.toISOString() } });
  });

  it('PUBLISH_COMPLETE → published', async () => {
    fetch.routes.push(['POST', /status\/fetch/, () => ({ data: { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: [7123] }, error: { code: 'ok' } })]);
    const r = await adapter.advance(target(3_000_000, { step: 'processing', publishId: 'pub1', startedAt: NOW.toISOString() }), acct, deps);
    expect(r).toMatchObject({ kind: 'published', externalPostId: '7123' });
  });

  it('PROCESSING_UPLOAD mantém processing', async () => {
    fetch.routes.push(['POST', /status\/fetch/, () => ({ data: { status: 'PROCESSING_UPLOAD' }, error: { code: 'ok' } })]);
    const progress = { step: 'processing', publishId: 'pub1', startedAt: NOW.toISOString() };
    expect(await adapter.advance(target(3_000_000, progress), acct, deps)).toEqual({ kind: 'progress', status: 'processing', progress });
  });

  it('FAILED → PermanentError com o motivo traduzido', async () => {
    fetch.routes.push(['POST', /status\/fetch/, () => ({ data: { status: 'FAILED', fail_reason: 'file_format_check_failed' }, error: { code: 'ok' } })]);
    const err = await adapter.advance(target(3_000_000, { step: 'processing', publishId: 'pub1', startedAt: NOW.toISOString() }), acct, deps).catch((e) => e);
    expect(err).toBeInstanceOf(PermanentError);
    expect(err.userMessage).toMatch(/formato/);
  });

  it('upload_url com mais de 55 min → reinicia do init', async () => {
    initRoute();
    putRoute();
    const old = new Date(NOW.getTime() - 56 * 60_000).toISOString();
    const r = await adapter.advance(
      target(3_000_000, { step: 'uploading', publishId: 'velho', uploadUrl: 'https://up.tiktok/old', chunkSize: 3_000_000, totalChunks: 1, nextChunk: 0, startedAt: old }),
      acct, deps,
    );
    expect(fetch.calls[0].url).toMatch(/inbox\/video\/init/);
    expect(r).toMatchObject({ progress: { publishId: 'pub1', startedAt: NOW.toISOString() } });
  });

  it('token inválido → AuthError', async () => {
    fetch.routes.push(['POST', /inbox\/video\/init/, () => jsonResponse(401, { error: { code: 'access_token_invalid' } })]);
    await expect(adapter.advance(target(3_000_000), acct, deps)).rejects.toBeInstanceOf(AuthError);
  });

  it('processamento há mais de 30 min → PermanentError', async () => {
    fetch.routes.push(['POST', /status\/fetch/, () => ({ data: { status: 'PROCESSING_UPLOAD' }, error: { code: 'ok' } })]);
    const old = new Date(NOW.getTime() - 31 * 60_000).toISOString();
    await expect(adapter.advance(target(3_000_000, { step: 'processing', publishId: 'p', startedAt: old }), acct, deps)).rejects.toBeInstanceOf(PermanentError);
  });
});

describe('revisão final', () => {
  it('I2: vídeo entre 5 e 10 MiB vai numa só parte', () => {
    expect(planChunks(7 * MiB)).toEqual({ chunkSize: 7 * MiB, totalChunks: 1 });
    expect(planChunks(5 * MiB)).toEqual({ chunkSize: 5 * MiB, totalChunks: 1 });
    expect(planChunks(19.9 * MiB)).toEqual({ chunkSize: 10 * MiB, totalChunks: 1 });
  });

  it('I1: SEND_TO_USER_INBOX é aceite mesmo depois de 30 min', async () => {
    fetch.routes.push(['POST', /status\/fetch/, () => ({ data: { status: 'SEND_TO_USER_INBOX' }, error: { code: 'ok' } })]);
    const old = new Date(NOW.getTime() - 3 * 3600_000).toISOString();
    const r = await adapter.advance(target(3_000_000, { step: 'processing', publishId: 'p', startedAt: old }), acct, deps);
    expect(r.kind).toBe('awaiting_user');
  });
});
