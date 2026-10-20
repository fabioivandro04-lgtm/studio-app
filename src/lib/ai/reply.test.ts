import { describe, expect, it } from 'vitest';
import { createFakeAi } from './fake';
import { buildReplyMessages } from './reply-prompts';
import { runReply, runWeeklyReport, type AiDeps } from './service';
import type { BrandAi } from './types';

const brand: BrandAi = { name: 'Unidreamity', aiContext: 'Ajudamos a estudar em Portugal.', aiVoice: '', aiHashtags: [], goal: 'contacts' };
const deps = (): AiDeps & { used: string[] } => {
  const used: string[] = [];
  return { provider: createFakeAi(), model: 'm', limitUsd: 5, spentUsd: 0, recordUsage: async (u) => void used.push(u.kind), used };
};
const text = (m: ReturnType<typeof buildReplyMessages>) => m.map((x) => (typeof x.content === 'string' ? x.content : '')).join('\n');

describe('respostas com IA', () => {
  it('o pedido leva as respostas guardadas e a conversa', () => {
    const t = text(buildReplyMessages({ brand, knowledge: 'Consulta: 50 €', channel: 'dm', customer: 'ana', turns: [{ fromBusiness: false, text: 'Quanto custa?' }] }));
    expect(t).toContain('Consulta: 50 €');
    expect(t).toContain('@ana: Quanto custa?');
    expect(t).toContain('nunca inventes');
  });

  it('sem respostas guardadas proíbe preços e datas', () => {
    const t = text(buildReplyMessages({ brand, knowledge: '', channel: 'comment', customer: 'rui', turns: [{ fromBusiness: false, text: 'Preço?' }], postCaption: 'Vagas abertas' }));
    expect(t).toContain('não dês preços');
    expect(t).toContain('Legenda do post:\nVagas abertas');
  });

  it('runReply devolve o texto e regista o custo como "reply"', async () => {
    const d = deps();
    const out = await runReply(d, { brandId: 'b', brand, knowledge: '', channel: 'dm', customer: 'ana', turns: [{ fromBusiness: false, text: 'Olá' }] });
    expect(out.length).toBeGreaterThan(0);
    expect(d.used).toEqual(['reply']);
  });

  it('sem mensagem do cliente não chama a IA', async () => {
    const d = deps();
    await expect(runReply(d, { brandId: 'b', brand, knowledge: '', channel: 'dm', customer: 'ana', turns: [{ fromBusiness: true, text: 'Olá' }] })).rejects.toThrow(/cliente/);
    expect(d.used).toEqual([]);
  });

  it('runWeeklyReport devolve o resumo e regista o custo como "report"', async () => {
    const d = deps();
    const r = await runWeeklyReport(d, { brandId: 'b', brand, facts: {
      weekStart: '2026-10-12', weekEnd: '2026-10-18', postsPublished: 2, views: 400, reach: 200, likes: 2, comments: 0, shares: 0, saves: 0,
      previous: null, followersGained: 3, topPosts: [], ads: [], scheduledNextWeek: 1,
    } });
    expect(r.headline).toBeTruthy();
    expect(d.used).toEqual(['report']);
  });
});
