import { describe, expect, it } from 'vitest';
import { fakeDb } from '../testing/fake-db';
import { testCtx } from '../testing/ctx';
import { runTool } from '../server';
import { grelhaInstagram } from './grelha-instagram';
import { metricas } from './metricas';
import { resumoSemana } from './resumo-semana';

const B = '11111111-1111-4111-8111-111111111111';
const brand = { id: B, name: 'Uni', timezone: 'Africa/Maputo', created_at: '2026-01-01', posting_slots: [], goal: 'contacts' };
const text = (r: { content: unknown[] }) => (r.content[0] as { text: string }).text;

describe('metricas', () => {
  it('recusa mais de 90 dias', async () => {
    const r = await runTool(metricas, { brandId: B, dias: 91 }, testCtx(fakeDb({ brands: [brand] }).db));
    expect(r.isError).toBe(true);
  });
  it('sem dados → zeros', async () => {
    const r = await runTool(metricas, { brandId: B }, testCtx(fakeDb({ brands: [brand], post_metrics: [], account_metrics: [], social_accounts: [], post_targets: [] }).db));
    expect(r.structuredContent).toMatchObject({ totais: { views: 0 }, top: [], melhoresHoras: [] });
  });
});

describe('grelha_instagram', () => {
  it('Instagram não ligado', async () => {
    const r = await runTool(grelhaInstagram, { brandId: B }, testCtx(fakeDb({ brands: [brand], social_accounts: [], posts: [] }).db));
    expect(text(r)).toBe('O Instagram desta marca não está ligado.');
  });
});

describe('resumo_semana', () => {
  it('publicados na semana, rascunhos por agendar e próximos prazos', async () => {
    const { db } = fakeDb({
      brands: [brand],
      posts: [
        { id: 'p1', brand_id: B, internal_title: 'Saiu', scheduled_at: '2026-10-18T17:00:00.000Z', status: 'published' },
        { id: 'p2', brand_id: B, internal_title: 'Rascunho', scheduled_at: '2026-10-25T17:00:00.000Z', status: 'draft' },
        { id: 'p3', brand_id: B, internal_title: 'Antigo', scheduled_at: '2026-09-01T17:00:00.000Z', status: 'published' },
      ],
      deadlines: [{ id: 'd', brand_id: B, title: 'Bolsa', due_date: '2026-10-30' }, { id: 'd2', brand_id: B, title: 'Longe', due_date: '2026-12-30' }],
      post_metrics: [], account_metrics: [], social_accounts: [], post_targets: [],
    });
    const r = await runTool(resumoSemana, { brandId: B }, testCtx(db));
    expect(r.structuredContent).toMatchObject({
      publicados: [{ titulo: 'Saiu' }],
      rascunhosPorAgendar: [{ titulo: 'Rascunho', data: '2026-10-25' }],
      proximosPrazos: [{ titulo: 'Bolsa', data: '2026-10-30' }],
    });
  });
});
