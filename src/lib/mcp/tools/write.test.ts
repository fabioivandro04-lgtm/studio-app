import { describe, expect, it } from 'vitest';
import { fakeDb } from '../testing/fake-db';
import { testCtx } from '../testing/ctx';
import { runTool } from '../server';
import { criarPrazo } from './criar-prazo';
import { criarRascunho } from './criar-rascunho';
import { editarRascunho } from './editar-rascunho';
import { guardarIdeia } from './guardar-ideia';
import { verificarPost } from './verificar-post';

const B = '11111111-1111-4111-8111-111111111111';
const B2 = '22222222-2222-4222-8222-222222222222';
const IG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const M = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const IDEA = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const text = (r: { content: unknown[] }) => (r.content[0] as { text: string }).text;

function world(over: Record<string, Record<string, unknown>[]> = {}) {
  const saved: Record<string, unknown>[] = [];
  const f = fakeDb(
    {
      brands: [{ id: B, name: 'Uni', timezone: 'Africa/Maputo', created_at: '2026-01-01' }, { id: B2, name: 'Outra', timezone: 'Africa/Maputo', created_at: '2026-01-02' }],
      social_accounts: [
        { id: IG, brand_id: B, platform: 'instagram', handle: 'unidreamity', status: 'active' },
        { id: TT, brand_id: B, platform: 'tiktok', handle: 'Unidreamity', status: 'active' },
        { id: OTHER, brand_id: B2, platform: 'instagram', handle: 'outra', status: 'active' },
      ],
      media_assets: [{ id: M, brand_id: B, kind: 'video', mime: 'video/mp4', size_bytes: 1000, width: 1080, height: 1920, duration_s: 20, storage_path: 'x' }],
      posts: [], ideas: [{ id: IDEA, brand_id: B, status: 'new', title: 'Ideia' }], activity_log: [], deadlines: [],
      ...over,
    },
    { rpc: { save_post: ({ p }: { p: Record<string, unknown> }) => (saved.push(p), (p.id as string) ?? 'novo-post') } },
  );
  return { ...f, saved };
}
const args = (over: Record<string, unknown> = {}) => ({
  brandId: B, titulo: 'Bolsa China', mediaIds: [M], data: '2026-10-23', hora: '19:00',
  redes: [{ rede: 'instagram', legenda: 'Candidaturas abertas #bolsas' }, { conta: TT, legenda: 'Vê isto' }], ...over,
});

describe('criar_rascunho', () => {
  it('resolve @handle e id, formato por omissão, grava rascunho do Claude', async () => {
    const w = world();
    const r = await runTool(criarRascunho, args(), testCtx(w.db));
    expect(r.isError).toBeUndefined();
    expect(w.saved[0]).toMatchObject({
      brandId: B, internalTitle: 'Bolsa China', intent: 'draft', origin: 'claude', scheduledAt: '2026-10-23T17:00:00.000Z', mediaIds: [M],
      targets: [{ accountId: IG, format: 'ig_reel', caption: 'Candidaturas abertas #bolsas', title: null }, { accountId: TT, format: 'tiktok_video', caption: 'Vê isto', title: null }],
    });
    expect(r.structuredContent).toMatchObject({ postId: 'novo-post', link: 'https://app.test/posts/novo-post' });
    expect(w.tables.activity_log[0]).toMatchObject({ source: 'mcp', message: 'Claude criou o rascunho «Bolsa China»' });
  });
  it('@handle repetido em duas redes: pede a rede; com rede resolve', async () => {
    const w = world();
    expect(text(await runTool(criarRascunho, args({ redes: [{ conta: '@unidreamity', legenda: 'x' }] }), testCtx(w.db)))).toBe('Há mais de uma conta "@unidreamity" nesta marca; indique a rede e o id da conta.');
    await runTool(criarRascunho, args({ redes: [{ rede: 'tiktok', conta: '@unidreamity', legenda: 'x' }] }), testCtx(w.db));
    expect(w.saved[0]).toMatchObject({ targets: [{ accountId: TT }] });
  });
  it('conta de outra marca → erro claro, nada gravado', async () => {
    const w = world();
    const r = await runTool(criarRascunho, args({ redes: [{ conta: OTHER, legenda: 'x' }] }), testCtx(w.db));
    expect(text(r)).toBe(`A conta ${OTHER} não é desta marca. Use "marcas" para ver as contas.`);
    expect(w.saved).toHaveLength(0);
  });
  it('data passada → cria na mesma e avisa', async () => {
    const w = world();
    const r = await runTool(criarRascunho, args({ data: '2026-10-01' }), testCtx(w.db));
    expect(w.saved).toHaveLength(1);
    expect(text(r)).toContain('A data já passou.');
  });
  it('com ideiaId marca a ideia como usada e liga-a ao post', async () => {
    const w = world();
    await runTool(criarRascunho, args({ ideiaId: IDEA }), testCtx(w.db));
    expect(w.tables.ideas[0]).toMatchObject({ status: 'used', post_id: 'novo-post' });
  });
  it('ideia já usada → recusado', async () => {
    const w = world({ ideas: [{ id: IDEA, brand_id: B, status: 'used', title: 'I' }] });
    const r = await runTool(criarRascunho, args({ ideiaId: IDEA }), testCtx(w.db));
    expect(text(r)).toBe('Esta ideia já foi usada ou descartada.');
    expect(w.saved).toHaveLength(0);
  });
  it('ficheiro de outra marca', async () => {
    const w = world({ media_assets: [{ id: M, brand_id: B2, kind: 'video', mime: 'video/mp4', size_bytes: 1, storage_path: 'x' }] });
    expect(text(await runTool(criarRascunho, args(), testCtx(w.db)))).toBe('Um dos ficheiros não existe ou não é desta marca.');
  });
});

describe('verificar_post', () => {
  it('sem problemas → "Tudo certo para agendar."', async () => {
    const r = await runTool(verificarPost, args(), testCtx(world().db));
    expect(text(r)).toBe('Tudo certo para agendar.');
  });
  it('avisos por rede', async () => {
    const r = await runTool(verificarPost, args({ data: '2026-10-01' }), testCtx(world().db));
    expect(text(r)).toContain('A data já passou.');
  });
});

describe('editar_rascunho', () => {
  it('só rascunhos', async () => {
    const w = world({ posts: [{ id: 'p1', brand_id: B, status: 'scheduled' }] });
    const r = await runTool(editarRascunho, { postId: 'p1', ...args() }, testCtx(w.db));
    expect(text(r)).toBe('Só pode editar rascunhos.');
    expect(w.saved).toHaveLength(0);
  });
  it('edita um rascunho', async () => {
    const w = world({ posts: [{ id: 'p1', brand_id: B, status: 'draft' }] });
    const r = await runTool(editarRascunho, { postId: 'p1', ...args({ titulo: 'Novo' }) }, testCtx(w.db));
    expect(r.isError).toBeUndefined();
    expect(w.saved[0]).toMatchObject({ id: 'p1', internalTitle: 'Novo', intent: 'draft' });
  });
});

describe('guardar_ideia e criar_prazo', () => {
  it('guarda ideia nova', async () => {
    const w = world({ ideas: [] });
    await runTool(guardarIdeia, { brandId: B, titulo: 'Reel bolsa', gancho: 'Sabias que…', formato: 'ig_reel', redes: ['instagram'] }, testCtx(w.db));
    expect(w.tables.ideas[0]).toMatchObject({ brand_id: B, kind: 'shorts', title: 'Reel bolsa', hook: 'Sabias que…', format: 'ig_reel', platforms: ['instagram'] });
  });
  it('cria prazo', async () => {
    const w = world();
    await runTool(criarPrazo, { brandId: B, titulo: 'MEXT', data: '2027-04-01', instituicao: 'Embaixada', pais: 'Japão' }, testCtx(w.db));
    expect(w.tables.deadlines[0]).toMatchObject({ brand_id: B, title: 'MEXT', due_date: '2027-04-01', institution: 'Embaixada', country: 'Japão' });
  });
});
