import { describe, expect, it } from 'vitest';
import { buildIdeasMessages } from './ideas-prompts';
import type { BrandAi, ChatMessage } from './types';

const brand: BrandAi = { name: 'Unidreamity', aiContext: 'Consultoria em Maputo.', aiVoice: 'Próxima.', aiHashtags: [], goal: 'contacts' };
const base = { brand, count: 5, deadline: null, upcomingDeadlines: [], recentTitles: [], platforms: ['instagram' as const, 'tiktok' as const] };
const text = (m: ChatMessage) => (typeof m.content === 'string' ? m.content : m.content.map((p) => (p.type === 'text' ? p.text : '')).join('\n'));

describe('buildIdeasMessages', () => {
  it('usa a mensagem de sistema da marca (pt-PT, contexto)', () => {
    const [sys] = buildIdeasMessages({ ...base, mode: 'shorts' });
    expect(text(sys)).toContain('português de Portugal');
    expect(text(sys)).toContain('Consultoria em Maputo.');
  });

  it('pede campos curtos (cabe na resposta mesmo com 10 ideias)', () => {
    const u = text(buildIdeasMessages({ ...base, mode: 'shorts' })[1]);
    expect(u).toContain('caption: legenda de rascunho curta (até 500 caracteres)');
    expect(u).toContain('outline: 3 a 5 linhas curtas');
    expect(u).not.toContain('2200');
  });

  it('inclui quantidade e redes disponíveis', () => {
    const u = text(buildIdeasMessages({ ...base, mode: 'week' })[1]);
    expect(u).toContain('Quantidade: 5');
    expect(u).toContain('instagram, tiktok');
  });

  it('prazo: sequência com urgência crescente e dados do prazo', () => {
    const u = text(buildIdeasMessages({
      ...base, mode: 'deadline', count: 3,
      deadline: { title: 'Candidaturas Lisboa', dueDate: '2026-12-01', institution: 'Universidade de Lisboa', country: 'Portugal' },
    })[1]);
    expect(u).toContain('Candidaturas Lisboa');
    expect(u).toContain('2026-12-01');
    expect(u).toContain('Universidade de Lisboa');
    expect(u).toMatch(/urgência/);
    expect(u).toContain('Quantidade: 3');
  });

  it('vídeos curtos: gancho de 3 segundos e guião', () => {
    const u = text(buildIdeasMessages({ ...base, mode: 'shorts', count: 10 })[1]);
    expect(u).toMatch(/3 segundos/);
    expect(u).toMatch(/guião/);
  });

  it('semana: menciona prazos próximos só quando existem', () => {
    const withD = text(buildIdeasMessages({ ...base, mode: 'week', upcomingDeadlines: [{ title: 'Porto', dueDate: '2026-11-10' }] })[1]);
    expect(withD).toContain('Porto (2026-11-10)');
    const without = text(buildIdeasMessages({ ...base, mode: 'week' })[1]);
    expect(without).not.toContain('Prazos próximos');
  });

  it('não repetir: até 30 títulos recentes', () => {
    const titles = Array.from({ length: 40 }, (_, i) => `Tema ${i + 1}`);
    const u = text(buildIdeasMessages({ ...base, mode: 'shorts', recentTitles: titles })[1]);
    expect(u).toContain('Tema 30');
    expect(u).not.toContain('Tema 31');
  });
});
