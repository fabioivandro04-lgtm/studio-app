import { describe, expect, it } from 'vitest';
import { fakeFetch, jsonResponse } from '@/lib/platforms/testing/fake-fetch';
import { AiError } from './errors';
import { createFakeAi } from './fake';
import { createOpenRouter } from './openrouter';
import { RefinedSpec, SuggestionsSpec, VoiceSpec } from './schemas';

const URL_RE = /openrouter\.ai\/api\/v1\/chat\/completions/;
const okBody = (content: string, usage: Record<string, unknown> = { prompt_tokens: 100, completion_tokens: 50, cost: 0.0021 }) => ({
  choices: [{ message: { role: 'assistant', content } }],
  usage,
});
const req = { model: 'anthropic/claude-sonnet-5.5', messages: [{ role: 'user' as const, content: 'olá' }], spec: RefinedSpec, maxTokens: 600 };

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e instanceof AiError ? e.code : `other:${(e as Error).message}`;
  }
  return 'no-error';
}

describe('createOpenRouter', () => {
  it('envia o pedido certo e devolve dados validados e custo', async () => {
    const fetch = fakeFetch([['POST', URL_RE, () => okBody('{"text":"Olá!"}')]]);
    const ai = createOpenRouter({ apiKey: 'sk-or-1', appUrl: 'https://app.example', fetch });
    const r = await ai.chat(req);
    expect(r).toEqual({ data: { text: 'Olá!' }, usage: { inputTokens: 100, outputTokens: 50, costUsd: 0.0021 } });
    const call = fetch.calls[0];
    expect(call.headers.authorization).toBe('Bearer sk-or-1');
    expect(call.headers['http-referer']).toBe('https://app.example');
    expect(call.headers['x-title']).toBe('Estúdio');
    expect(call.body).toMatchObject({
      model: 'anthropic/claude-sonnet-5.5',
      max_tokens: 600,
      messages: req.messages,
      response_format: { type: 'json_schema', json_schema: { name: 'refined', strict: true, schema: RefinedSpec.schema } },
      usage: { include: true },
    });
  });

  it('aceita JSON dentro de bloco ```json', async () => {
    const fetch = fakeFetch([['POST', URL_RE, () => okBody('```json\n{"text":"ok"}\n```')]]);
    const r = await createOpenRouter({ apiKey: 'k', appUrl: 'https://a', fetch }).chat(req);
    expect(r.data).toEqual({ text: 'ok' });
  });

  it('custo ausente conta como 0', async () => {
    const fetch = fakeFetch([['POST', URL_RE, () => okBody('{"text":"ok"}', { prompt_tokens: 1, completion_tokens: 2 })]]);
    const r = await createOpenRouter({ apiKey: 'k', appUrl: 'https://a', fetch }).chat(req);
    expect(r.usage).toEqual({ inputTokens: 1, outputTokens: 2, costUsd: 0 });
  });

  it.each([
    [401, 'auth'],
    [402, 'auth'],
    [429, 'unavailable'],
    [500, 'unavailable'],
  ])('HTTP %i → %s', async (status, code) => {
    const fetch = fakeFetch([['POST', URL_RE, () => jsonResponse(status, { error: { message: 'x' } })]]);
    expect(await codeOf(createOpenRouter({ apiKey: 'k', appUrl: 'https://a', fetch }).chat(req))).toBe(code);
  });

  it.each([400, 404, 413, 422])('HTTP %i → bad_request com mensagem própria', async (status) => {
    const fetch = fakeFetch([['POST', URL_RE, () => jsonResponse(status, { error: { message: 'x' } })]]);
    const p = createOpenRouter({ apiKey: 'k', appUrl: 'https://a', fetch }).chat(req);
    expect(await codeOf(p)).toBe('bad_request');
    await expect(createOpenRouter({ apiKey: 'k', appUrl: 'https://a', fetch }).chat(req)).rejects.toThrow(
      'A IA recusou o pedido (modelo ou imagem não suportados). Experimente outro motor em Definições → IA.',
    );
  });

  it('mensagens de erro em pt-PT', async () => {
    const fetch = fakeFetch([['POST', URL_RE, () => jsonResponse(402, {})]]);
    await expect(createOpenRouter({ apiKey: 'k', appUrl: 'https://a', fetch }).chat(req)).rejects.toThrow(
      'A conta OpenRouter não tem crédito ou a chave é inválida.',
    );
  });

  it('timeout → unavailable', async () => {
    const never = ((_u: string, init: RequestInit) =>
      new Promise((_r, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))) as unknown as typeof fetch;
    expect(await codeOf(createOpenRouter({ apiKey: 'k', appUrl: 'https://a', fetch: never, timeoutMs: 20 }).chat(req))).toBe('unavailable');
  });

  it('falha de rede → unavailable', async () => {
    const broken = (() => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch;
    expect(await codeOf(createOpenRouter({ apiKey: 'k', appUrl: 'https://a', fetch: broken }).chat(req))).toBe('unavailable');
  });

  it('conteúdo não-JSON ou fora do esquema → invalid_response', async () => {
    const notJson = fakeFetch([['POST', URL_RE, () => okBody('olá, aqui vai')]]);
    expect(await codeOf(createOpenRouter({ apiKey: 'k', appUrl: 'https://a', fetch: notJson }).chat(req))).toBe('invalid_response');
    const wrong = fakeFetch([['POST', URL_RE, () => okBody('{"texto":"x"}')]]);
    expect(await codeOf(createOpenRouter({ apiKey: 'k', appUrl: 'https://a', fetch: wrong }).chat(req))).toBe('invalid_response');
    const empty = fakeFetch([['POST', URL_RE, () => ({ choices: [] })]]);
    expect(await codeOf(createOpenRouter({ apiKey: 'k', appUrl: 'https://a', fetch: empty }).chat(req))).toBe('invalid_response');
  });
});

describe('createFakeAi', () => {
  it('devolve respostas válidas para cada esquema, com custo 0', async () => {
    const ai = createFakeAi();
    const base = { model: 'm', messages: [], maxTokens: 10 };
    const s = await ai.chat({ ...base, spec: SuggestionsSpec });
    expect(SuggestionsSpec.parse(s.data)).toEqual(s.data);
    expect(s.data.byPlatform.map((p) => p.platform)).toEqual(['instagram', 'tiktok', 'youtube']);
    expect(s.usage.costUsd).toBe(0);
    expect((await ai.chat({ ...base, spec: RefinedSpec })).data.text).toBeTruthy();
    expect((await ai.chat({ ...base, spec: VoiceSpec })).data.voice).toBeTruthy();
  });
});
