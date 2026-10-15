import { describe, expect, it, vi } from 'vitest';
import { AiError } from './errors';
import { createFakeAi } from './fake';
import { runDraftVoice, runRefine, runSuggest, type AiDeps } from './service';
import type { AiProvider, BrandAi, ChatMessage } from './types';

const brand: BrandAi = { name: 'Unidreamity', aiContext: 'ctx', aiVoice: 'voz', aiHashtags: ['#unidreamity'], goal: 'contacts' };

function spyProvider(inner: AiProvider = createFakeAi(), costUsd = 0.01) {
  const calls: { messages: ChatMessage[]; maxTokens: number; model: string }[] = [];
  const provider: AiProvider = {
    async chat(req) {
      calls.push({ messages: req.messages, maxTokens: req.maxTokens, model: req.model });
      const r = await inner.chat(req);
      return { ...r, usage: { inputTokens: 10, outputTokens: 5, costUsd } };
    },
  };
  return { provider, calls };
}

const deps = (over: Partial<AiDeps> = {}): AiDeps => ({
  provider: createFakeAi(),
  model: 'anthropic/claude-sonnet-5.5',
  limitUsd: 5,
  spentUsd: 0,
  recordUsage: vi.fn(async () => {}),
  ...over,
});

async function errOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e as AiError;
  }
  throw new Error('não lançou');
}

describe('runSuggest', () => {
  const input = { brandId: 'b1', brand, prompt: 'prazos Lisboa', imageUrl: null, targets: [{ platform: 'instagram' as const, format: 'ig_image' as const }] };

  it('sem imagem: sem image_url, devolve sugestões pós-processadas e regista o uso', async () => {
    const { provider, calls } = spyProvider();
    const d = deps({ provider });
    const r = await runSuggest(d, input);
    expect(calls[0].maxTokens).toBe(1500);
    expect(calls[0].model).toBe('anthropic/claude-sonnet-5.5');
    expect(JSON.stringify(calls[0].messages)).not.toContain('image_url');
    expect(r.byPlatform.map((p) => p.platform)).toEqual(['instagram']);
    expect(r.byPlatform[0].hashtags[0]).toBe('#unidreamity');
    expect(r.youtubeTitle).toBeNull();
    expect(d.recordUsage).toHaveBeenCalledTimes(1);
    expect(d.recordUsage).toHaveBeenCalledWith({
      brandId: 'b1', kind: 'suggest', model: 'anthropic/claude-sonnet-5.5', usage: { inputTokens: 10, outputTokens: 5, costUsd: 0.01 },
    });
  });

  it('sem provider → no_key', async () => {
    expect((await errOf(runSuggest(deps({ provider: null }), input))).code).toBe('no_key');
  });

  it('gasto no limite → budget, sem chamar a IA', async () => {
    const { provider, calls } = spyProvider();
    expect((await errOf(runSuggest(deps({ provider, spentUsd: 5 }), input))).code).toBe('budget');
    expect(calls).toHaveLength(0);
  });

  it('pedido vazio ou sem redes → mensagem clara', async () => {
    expect((await errOf(runSuggest(deps(), { ...input, prompt: '   ' }))).message).toBe('Escreva sobre o que é o post.');
    expect((await errOf(runSuggest(deps(), { ...input, targets: [] }))).message).toBe('Escolha pelo menos uma rede.');
  });

  it('erro da IA não regista uso', async () => {
    const failing: AiProvider = { chat: async () => { throw new AiError('unavailable', 'x'); } };
    const d = deps({ provider: failing });
    await errOf(runSuggest(d, input));
    expect(d.recordUsage).not.toHaveBeenCalled();
  });
});

describe('runRefine', () => {
  it('corta ao limite da rede e usa 600 tokens', async () => {
    const long: AiProvider = { chat: async (req) => ({ data: req.spec.parse({ text: 'x'.repeat(3000) }), usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } }) };
    const { provider, calls } = spyProvider(long);
    const t = await runRefine(deps({ provider }), { brandId: 'b1', brand, platform: 'tiktok', text: 'abc', action: 'shorten' });
    expect(t).toHaveLength(2200);
    expect(calls[0].maxTokens).toBe(600);
  });

  it('texto vazio → erro', async () => {
    expect((await errOf(runRefine(deps(), { brandId: 'b1', brand, platform: 'instagram', text: ' ', action: 'catchy' }))).message).toBe(
      'Escreva primeiro uma legenda.',
    );
  });
});

describe('runDraftVoice', () => {
  it('sem legendas → erro', async () => {
    expect((await errOf(runDraftVoice(deps(), { brandId: 'b1', brand, captions: ['', ' '] }))).message).toBe(
      'Não há legendas no Instagram para analisar.',
    );
  });

  it('devolve voz cortada a 2000 e regista kind voice', async () => {
    const long: AiProvider = { chat: async (req) => ({ data: req.spec.parse({ voice: 'v'.repeat(2500) }), usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } }) };
    const d = deps({ provider: long });
    const v = await runDraftVoice(d, { brandId: 'b1', brand, captions: ['olá'] });
    expect(v).toHaveLength(2000);
    expect(d.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'voice' }));
  });
});
