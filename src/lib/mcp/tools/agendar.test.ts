import { describe, expect, it } from 'vitest';
import { fakeDb } from '../testing/fake-db';
import { testCtx } from '../testing/ctx';
import { runTool } from '../server';
import { agendarRascunhos, desagendarPost } from './agendar';

const B = '11111111-1111-4111-8111-111111111111';
const IG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const M = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const OK = '33333333-3333-4333-8333-333333333333';
const PAST = '44444444-4444-4444-8444-444444444444';
const SCHED = '55555555-5555-4555-8555-555555555555';
const text = (r: { content: unknown[] }) => (r.content[0] as { text: string }).text;

const image = { id: M, brand_id: B, kind: 'image', mime: 'image/jpeg', size_bytes: 1000, width: 1080, height: 1350, duration_s: null, storage_path: 'x' };
function world(rpc: Record<string, (a: Record<string, unknown>) => unknown> = {}) {
  return fakeDb(
    {
      brands: [{ id: B, name: 'Uni', timezone: 'Africa/Maputo', created_at: '2026-01-01' }],
      social_accounts: [{ id: IG, brand_id: B, platform: 'instagram', handle: 'unidreamity', status: 'active' }],
      posts: [
        { id: OK, brand_id: B, internal_title: 'Bolsa', scheduled_at: '2026-10-23T17:00:00Z', status: 'draft' },
        { id: PAST, brand_id: B, internal_title: 'Velho', scheduled_at: '2026-10-01T17:00:00Z', status: 'draft' },
        { id: SCHED, brand_id: B, internal_title: 'Agendado', scheduled_at: '2026-10-23T17:00:00Z', status: 'scheduled' },
      ],
      post_media: [OK, PAST, SCHED].map((post_id) => ({ post_id, position: 0, media_assets: image })),
      post_targets: [OK, PAST, SCHED].map((post_id) => ({ post_id, social_account_id: IG, format: 'ig_image', caption: 'Olá', title: null, options: {} })),
      activity_log: [],
    },
    { rpc: { agent_schedule_post: () => null, agent_unschedule_post: () => null, ...rpc } },
  );
}

describe('agendar_rascunhos', () => {
  it('agenda os que passam nas regras e explica os outros', async () => {
    const w = world();
    const r = await runTool(agendarRascunhos, { postIds: [OK, PAST, SCHED] }, testCtx(w.db));
    expect(w.calls.filter((c) => c.table === 'rpc:agent_schedule_post').map((c) => c.payload)).toEqual([{ p_id: OK, p_at: '2026-10-23T17:00:00.000Z' }]);
    const s = r.structuredContent as { agendados: { postId: string }[]; recusados: { postId: string; motivo: string }[] };
    expect(s.agendados.map((a) => a.postId)).toEqual([OK]);
    expect(s.recusados.map((x) => x.postId).sort()).toEqual([PAST, SCHED].sort());
    expect(s.recusados.find((x) => x.postId === SCHED)?.motivo).toBe('Já não é um rascunho.');
    expect(w.tables.activity_log).toHaveLength(1);
  });

  it('erro da base de dados → motivo legível, nada registado', async () => {
    const w = world({ agent_schedule_post: () => { throw new Error('post_locked'); } });
    const r = await runTool(agendarRascunhos, { postIds: [OK] }, testCtx(w.db));
    expect(text(r)).toContain('Já começou a ser publicado.');
    expect(w.tables.activity_log).toHaveLength(0);
  });
});

describe('desagendar_post', () => {
  it('volta a rascunho e regista', async () => {
    const w = world();
    const r = await runTool(desagendarPost, { postId: SCHED }, testCtx(w.db));
    expect(text(r)).toContain(`/posts/${SCHED}`);
    expect(w.calls.some((c) => c.table === 'rpc:agent_unschedule_post')).toBe(true);
    expect(w.tables.activity_log).toHaveLength(1);
  });

  it('não agendado → erro claro', async () => {
    const w = world({ agent_unschedule_post: () => { throw new Error('not_scheduled'); } });
    const r = await runTool(desagendarPost, { postId: OK }, testCtx(w.db));
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('Não está agendado.');
  });
});
