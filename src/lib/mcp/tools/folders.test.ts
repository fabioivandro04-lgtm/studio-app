import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fakeDb } from '../testing/fake-db';
import { testCtx } from '../testing/ctx';
import { runTool } from '../server';
import { biblioteca } from './biblioteca';
import { confirmarEnvio } from './confirmar-envio';
import { criarPasta } from './criar-pasta';
import { pastas } from './pastas';

const B = '11111111-1111-4111-8111-111111111111';
const B2 = '22222222-2222-4222-8222-222222222222';
const F = '44444444-4444-4444-8444-444444444444';
const F2 = '55555555-5555-4555-8555-555555555555';
const brand = { id: B, name: 'Uni', timezone: 'Africa/Maputo', created_at: '2026-01-01' };
const folders = () => [{ id: F, brand_id: B, name: 'Prazos 2027', notes: 'Datas', created_at: '2026-10-01' }, { id: F2, brand_id: B2, name: 'Outra', notes: '', created_at: '2026-10-01' }];
const media = (id: string, folder: string | null) => ({ id, brand_id: B, original_name: `${id}.jpg`, kind: 'image', mime: 'image/jpeg', width: 1, height: 1, duration_s: null, size_bytes: 1, tags: [], folder_id: folder, created_at: '2026-10-02' });
const fx = (f: string) => new Uint8Array(readFileSync(path.join(import.meta.dirname, '../../media/__fixtures__', f)));

describe('pastas', () => {
  it('lista as pastas da marca com nº de ficheiros', async () => {
    const { db } = fakeDb(
      { brands: [brand], media_folders: folders(), media_assets: [media('a', F), media('b', F), media('c', null)] },
      { rpc: { media_folder_stats: ({ p_brand }: { p_brand: string }) => (p_brand === B ? [{ folder_id: F, files: 2, used_in: 0, previews: [] }] : []) } },
    );
    const r = await runTool(pastas, { brandId: B }, testCtx(db));
    expect(r.structuredContent).toEqual({ pastas: [{ id: F, nome: 'Prazos 2027', tema: 'Datas', ficheiros: 2 }], semPasta: 1 });
  });
});

describe('criar_pasta', () => {
  it('cria; nome repetido devolve a existente', async () => {
    const { db, tables } = fakeDb({ brands: [brand], media_folders: folders(), activity_log: [] });
    const r = await runTool(criarPasta, { brandId: B, nome: 'Bastidores', tema: 'Equipa' }, testCtx(db));
    expect(r.isError).toBeFalsy();
    expect(tables.media_folders.at(-1)).toMatchObject({ brand_id: B, name: 'Bastidores', notes: 'Equipa' });
    const again = await runTool(criarPasta, { brandId: B, nome: 'prazos 2027' }, testCtx(db));
    expect(again.structuredContent).toEqual({ pastaId: F, criada: false });
  });
});

describe('biblioteca com pastas', () => {
  it('mostra a pasta de cada ficheiro e filtra por pastaId', async () => {
    const { db } = fakeDb({ brands: [brand], media_folders: folders(), media_assets: [media('a', F), media('c', null)] });
    const r = await runTool(biblioteca, { brandId: B, pastaId: F }, testCtx(db));
    const fs = (r.structuredContent as { ficheiros: { id: string; pasta: unknown }[] }).ficheiros;
    expect(fs.map((f) => [f.id, f.pasta])).toEqual([['a', { id: F, nome: 'Prazos 2027' }]]);
  });
});

describe('confirmar_envio com pastaId', () => {
  const env = '33333333-3333-4333-8333-333333333333.mp4';
  const st = () => {
    const objects: Record<string, Uint8Array> = { [`${B}/mcp/${env}`]: fx('blue-64x96-1.5s.mp4') };
    return {
      download: async (p: string) => (objects[p] ? { data: new Blob([objects[p] as Uint8Array<ArrayBuffer>]), error: null } : { data: null, error: { message: 'nf' } }),
      remove: async () => ({ data: [], error: null }),
    };
  };
  it('põe o ficheiro na pasta', async () => {
    const { db, tables } = fakeDb({ brands: [brand], media_folders: folders(), media_assets: [], activity_log: [] }, { storage: st() });
    await runTool(confirmarEnvio, { brandId: B, envioId: env, nome: 'reel.mp4', pastaId: F }, testCtx(db));
    expect(tables.media_assets[0].folder_id).toBe(F);
  });
  it('pasta de outra marca → erro, nada criado', async () => {
    const { db, tables } = fakeDb({ brands: [brand], media_folders: folders(), media_assets: [], activity_log: [] }, { storage: st() });
    const r = await runTool(confirmarEnvio, { brandId: B, envioId: env, nome: 'reel.mp4', pastaId: F2 }, testCtx(db));
    expect(r.isError).toBe(true);
    expect((r.content[0] as { text: string }).text).toContain('Pasta não encontrada nesta marca.');
    expect(tables.media_assets).toEqual([]);
  });
});
