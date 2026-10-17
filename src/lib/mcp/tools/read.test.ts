import { describe, expect, it } from 'vitest';
import { fakeDb } from '../testing/fake-db';
import { testCtx } from '../testing/ctx';
import { runTool } from '../server';
import { biblioteca } from './biblioteca';
import { calendario } from './calendario';
import { contextoMarca } from './contexto-marca';
import { estadoPublicacoes } from './estado-publicacoes';
import { horariosLivres } from './horarios-livres';
import { ideias } from './ideias';
import { prazos } from './prazos';

const B = '11111111-1111-4111-8111-111111111111';
const brand = (slots: unknown[] = []) => ({ id: B, name: 'Uni', timezone: 'Africa/Maputo', created_at: '2026-01-01', posting_slots: slots, ai_context: 'Bolsas', ai_voice: 'próxima', ai_hashtags: ['#bolsas'], goal: 'contacts', posts_per_week: 3 });
const text = (r: { content: unknown[] }) => (r.content[0] as { text: string }).text;

describe('contexto_marca', () => {
  it('voz, contexto e grupos de hashtags', async () => {
    const { db } = fakeDb({ brands: [brand()], hashtag_groups: [{ id: 'g', brand_id: B, name: 'Bolsas', tags: ['#a', '#b'] }] });
    const r = await runTool(contextoMarca, { brandId: B }, testCtx(db));
    expect(r.structuredContent).toMatchObject({ contexto: 'Bolsas', voz: 'próxima', gruposHashtags: [{ nome: 'Bolsas', hashtags: ['#a', '#b'] }] });
  });
  it('marca desconhecida', async () => {
    const r = await runTool(contextoMarca, { brandId: '22222222-2222-4222-8222-222222222222' }, testCtx(fakeDb({ brands: [] }).db));
    expect(text(r)).toBe('Marca não encontrada.');
  });
});

describe('calendario', () => {
  it('recusa mais de 62 dias e datas inválidas', async () => {
    const ctx = testCtx(fakeDb({ brands: [brand()] }).db);
    expect(text(await runTool(calendario, { brandId: B, de: '2026-10-01', ate: '2026-12-31' }, ctx))).toBe('Escolha no máximo 62 dias.');
    expect((await runTool(calendario, { brandId: B, de: '2026-13-01', ate: '2026-12-31' }, ctx)).isError).toBe(true);
  });
  it('hora local da marca, estado, origem e redes', async () => {
    const { db } = fakeDb({
      brands: [brand()],
      posts: [
        { id: 'p1', brand_id: B, internal_title: 'Bolsa X', scheduled_at: '2026-10-21T17:00:00.000Z', status: 'draft', origin: 'claude' },
        { id: 'p2', brand_id: B, internal_title: 'Fora', scheduled_at: '2026-11-30T17:00:00.000Z', status: 'scheduled', origin: 'app' },
      ],
      post_targets: [{ id: 't1', post_id: 'p1', social_account_id: 'a1', format: 'ig_reel', status: 'pending' }],
      social_accounts: [{ id: 'a1', brand_id: B, platform: 'instagram', handle: 'uni' }],
    });
    const r = await runTool(calendario, { brandId: B, de: '2026-10-20', ate: '2026-10-26' }, testCtx(db));
    expect(r.structuredContent).toEqual({
      posts: [{ id: 'p1', marcaId: B, titulo: 'Bolsa X', data: '2026-10-21', hora: '19:00', estado: 'draft', origem: 'claude', redes: [{ rede: 'instagram', formato: 'ig_reel', estado: 'pending' }], link: 'https://app.test/posts/p1' }],
    });
  });
});

describe('horarios_livres', () => {
  it('sem horários fixos → mensagem', async () => {
    const r = await runTool(horariosLivres, { brandId: B, de: '2026-10-20', ate: '2026-10-26' }, testCtx(fakeDb({ brands: [brand()] }).db));
    expect(text(r)).toBe('Esta marca não tem horários fixos.');
  });
  it('salta os ocupados', async () => {
    const { db } = fakeDb({
      brands: [brand([{ weekday: 3, time: '19:00' }, { weekday: 5, time: '19:00' }])],
      posts: [{ id: 'p', brand_id: B, scheduled_at: '2026-10-21T17:00:00.000Z', status: 'scheduled' }],
      ideas: [],
    });
    const r = await runTool(horariosLivres, { brandId: B, de: '2026-10-20', ate: '2026-10-26' }, testCtx(db));
    expect(r.structuredContent).toEqual({ livres: [{ data: '2026-10-23', hora: '19:00' }] });
  });
});

describe('biblioteca', () => {
  it('filtra por texto (nome ou etiquetas) e tipo, mais recentes primeiro, limite', async () => {
    const m = (id: string, name: string, kind: string, created: string, tags: string[] = []) => ({ id, brand_id: B, original_name: name, kind, mime: kind === 'video' ? 'video/mp4' : 'image/png', width: 1080, height: 1920, duration_s: kind === 'video' ? 12.5 : null, size_bytes: 10, tags, created_at: created });
    const { db } = fakeDb({ media_assets: [m('1', 'bolsa-china.png', 'image', '2026-10-01'), m('2', 'reel.mp4', 'video', '2026-10-02', ['bolsa']), m('3', 'outro.png', 'image', '2026-10-03')], brands: [brand()] });
    const r = await runTool(biblioteca, { brandId: B, texto: 'bolsa' }, testCtx(db));
    expect((r.structuredContent as { ficheiros: { id: string }[] }).ficheiros.map((f) => f.id)).toEqual(['2', '1']);
    const v = await runTool(biblioteca, { brandId: B, tipo: 'video', limite: 1 }, testCtx(db));
    expect(v.structuredContent).toEqual({ ficheiros: [{ id: '2', nome: 'reel.mp4', tipo: 'video', mime: 'video/mp4', largura: 1080, altura: 1920, duracaoS: 12.5, etiquetas: ['bolsa'], criadoEm: '2026-10-02', pasta: null }] });
    expect((await runTool(biblioteca, { brandId: B, limite: 51 }, testCtx(db))).isError).toBe(true);
  });
});

describe('ideias e prazos', () => {
  it('ideias por estado', async () => {
    const { db } = fakeDb({ brands: [brand()], ideas: [{ id: 'i1', brand_id: B, kind: 'week', status: 'new', title: 'T', hook: 'H', outline: '', caption: '', format: 'ig_reel', platforms: ['instagram'], suggested_at: null, post_id: null, created_at: '2026-10-01' }, { id: 'i2', brand_id: B, kind: 'week', status: 'used', title: 'U', hook: '', outline: '', caption: '', format: null, platforms: [], created_at: '2026-10-01' }] });
    const r = await runTool(ideias, { brandId: B }, testCtx(db));
    expect((r.structuredContent as { ideias: { id: string }[] }).ideias.map((i) => i.id)).toEqual(['i1']);
  });
  it('prazos no intervalo', async () => {
    const { db } = fakeDb({ brands: [brand()], deadlines: [{ id: 'd1', brand_id: B, title: 'Bolsa Japão', due_date: '2026-11-10', institution: 'MEXT', country: 'Japão' }, { id: 'd2', brand_id: B, title: 'Longe', due_date: '2027-05-01' }] });
    const r = await runTool(prazos, { brandId: B, de: '2026-10-20', ate: '2026-12-20' }, testCtx(db));
    expect(r.structuredContent).toEqual({ prazos: [{ id: 'd1', titulo: 'Bolsa Japão', data: '2026-11-10', instituicao: 'MEXT', pais: 'Japão' }] });
  });
});

describe('estado_publicacoes', () => {
  it('agrupa publicados, falhados e à espera de toque dos últimos 14 dias', async () => {
    const { db } = fakeDb({
      brands: [brand()],
      posts: [
        { id: 'p1', brand_id: B, internal_title: 'A', scheduled_at: '2026-10-18T17:00:00.000Z', status: 'published' },
        { id: 'p2', brand_id: B, internal_title: 'B', scheduled_at: '2026-10-19T17:00:00.000Z', status: 'failed' },
        { id: 'p3', brand_id: B, internal_title: 'C', scheduled_at: '2026-10-19T18:00:00.000Z', status: 'needs_action' },
        { id: 'p4', brand_id: B, internal_title: 'Velho', scheduled_at: '2026-09-01T17:00:00.000Z', status: 'failed' },
      ],
      post_targets: [
        { id: 't1', post_id: 'p1', social_account_id: 'a1', format: 'ig_reel', status: 'published', permalink: 'https://ig/p1' },
        { id: 't2', post_id: 'p2', social_account_id: 'a1', format: 'ig_reel', status: 'failed', last_error: 'Vídeo longo demais' },
        { id: 't3', post_id: 'p3', social_account_id: 'a2', format: 'tiktok_video', status: 'awaiting_user' },
      ],
      social_accounts: [{ id: 'a1', brand_id: B, platform: 'instagram', handle: 'uni' }, { id: 'a2', brand_id: B, platform: 'tiktok', handle: 'uni' }],
    });
    const r = await runTool(estadoPublicacoes, { brandId: B }, testCtx(db));
    expect(r.structuredContent).toMatchObject({
      publicados: [{ titulo: 'A', rede: 'instagram', link: 'https://ig/p1' }],
      falhados: [{ titulo: 'B', rede: 'instagram', motivo: 'Vídeo longo demais' }],
      aEsperaDeToque: [{ titulo: 'C', rede: 'tiktok' }],
    });
  });
});
