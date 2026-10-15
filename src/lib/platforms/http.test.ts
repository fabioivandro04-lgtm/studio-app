import { describe, expect, it } from 'vitest';
import { AuthError, DeferError, PermanentError, TransientError } from './errors';
import { requestJson } from './http';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  (async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })) as unknown as typeof fetch;

const now = () => new Date('2026-10-15T10:00:00Z');

describe('requestJson', () => {
  it('devolve o corpo em sucesso', async () => {
    const r = await requestJson<{ id: string }>(json(200, { id: 'x' }), 'https://a', { platform: 'instagram' });
    expect(r.body.id).toBe('x');
    expect(r.status).toBe(200);
  });

  it('308 (upload resumível) não é erro', async () => {
    const r = await requestJson(json(308, {}, { range: 'bytes=0-9' }), 'https://a', { platform: 'youtube' });
    expect(r.status).toBe(308);
    expect(r.headers.get('range')).toBe('bytes=0-9');
  });

  it.each([500, 502, 503, 429])('%i → TransientError', async (status) => {
    await expect(requestJson(json(status, {}), 'https://a', { platform: 'tiktok' })).rejects.toBeInstanceOf(TransientError);
  });

  it('erro de rede → TransientError', async () => {
    const boom = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    await expect(requestJson(boom, 'https://a', { platform: 'instagram' })).rejects.toBeInstanceOf(TransientError);
  });

  it('400 → PermanentError com a mensagem da API', async () => {
    const err = await requestJson(json(400, { error: { message: 'Invalid image' } }), 'https://a', { platform: 'instagram' }).catch((e) => e);
    expect(err).toBeInstanceOf(PermanentError);
    expect(err.userMessage).toMatch(/Instagram.*Invalid image/);
  });

  it('401 → AuthError', async () => {
    await expect(requestJson(json(401, {}), 'https://a', { platform: 'youtube' })).rejects.toBeInstanceOf(AuthError);
  });

  it('Instagram code 190 → AuthError', async () => {
    await expect(
      requestJson(json(400, { error: { code: 190, message: 'expired' } }), 'https://a', { platform: 'instagram' }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it('TikTok access_token_invalid → AuthError', async () => {
    await expect(
      requestJson(json(401, { error: { code: 'access_token_invalid' } }), 'https://a', { platform: 'tiktok' }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it('TikTok 200 com error.code ok é sucesso', async () => {
    const r = await requestJson<{ data: { x: number } }>(json(200, { data: { x: 1 }, error: { code: 'ok' } }), 'https://a', { platform: 'tiktok' });
    expect(r.body.data.x).toBe(1);
  });

  it('TikTok 200 com error.code de erro → PermanentError', async () => {
    await expect(
      requestJson(json(200, { error: { code: 'invalid_params', message: 'bad' } }), 'https://a', { platform: 'tiktok' }),
    ).rejects.toBeInstanceOf(PermanentError);
  });

  it('YouTube quotaExceeded → DeferError até à meia-noite de Los Angeles', async () => {
    const err = await requestJson(
      json(403, { error: { code: 403, errors: [{ reason: 'quotaExceeded' }] } }),
      'https://a',
      { platform: 'youtube', now },
    ).catch((e) => e);
    expect(err).toBeInstanceOf(DeferError);
    expect(err.until.toISOString()).toBe('2026-10-16T07:00:00.000Z');
  });
});
