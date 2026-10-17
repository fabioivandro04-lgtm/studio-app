import { describe, expect, it } from 'vitest';
import { fakeDb } from '@/lib/mcp/testing/fake-db';
import { createFolder, deleteFolder, ensureFolder, moveMedia, updateFolder } from './folders';

const B1 = '11111111-1111-4111-8111-111111111111';
const B2 = '22222222-2222-4222-8222-222222222222';
const setup = () =>
  fakeDb({
    media_folders: [{ id: 'f1', brand_id: B1, name: 'Prazos', notes: '' }, { id: 'f2', brand_id: B2, name: 'Outra', notes: '' }],
    media_assets: [
      { id: 'm1', brand_id: B1, folder_id: null },
      { id: 'm2', brand_id: B1, folder_id: null },
      { id: 'm3', brand_id: B2, folder_id: null },
    ],
  });

describe('createFolder', () => {
  it('cria com nome limpo', async () => {
    const { db, tables } = setup();
    const r = await createFolder(db, { brandId: B1, name: '  Bastidores  ', notes: 'Equipa' });
    expect(r).toMatchObject({ ok: true });
    expect(tables.media_folders.at(-1)).toMatchObject({ brand_id: B1, name: 'Bastidores', notes: 'Equipa' });
  });
  it('nome inválido', async () => {
    const { db } = setup();
    expect(await createFolder(db, { brandId: B1, name: ' ' })).toEqual({ ok: false, error: 'O nome tem de ter entre 1 e 80 caracteres.' });
  });
  it('nome repetido (maiúsculas diferentes)', async () => {
    const { db } = setup();
    expect(await createFolder(db, { brandId: B1, name: 'prazos' })).toEqual({ ok: false, error: 'Já existe uma pasta com esse nome.' });
  });
  it('nome igual noutra marca é permitido', async () => {
    const { db } = setup();
    expect((await createFolder(db, { brandId: B2, name: 'Prazos' })).ok).toBe(true);
  });
});

describe('ensureFolder', () => {
  it('reutiliza a existente', async () => {
    const { db, tables } = setup();
    expect(await ensureFolder(db, { brandId: B1, name: 'PRAZOS' })).toEqual({ ok: true, id: 'f1', created: false });
    expect(tables.media_folders).toHaveLength(2);
  });
  it('cria quando não existe', async () => {
    const { db } = setup();
    expect(await ensureFolder(db, { brandId: B1, name: 'Nova' })).toMatchObject({ ok: true, created: true });
  });
});

describe('updateFolder / deleteFolder', () => {
  it('muda nome e nota', async () => {
    const { db, tables } = setup();
    expect(await updateFolder(db, { id: 'f1', name: 'Prazos 2027', notes: 'Tema' })).toEqual({ ok: true });
    expect(tables.media_folders[0]).toMatchObject({ name: 'Prazos 2027', notes: 'Tema' });
  });
  it('nota longa recusada', async () => {
    const { db } = setup();
    expect(await updateFolder(db, { id: 'f1', notes: 'x'.repeat(2001) })).toEqual({ ok: false, error: 'A nota pode ter até 2000 caracteres.' });
  });
  it('apaga a pasta', async () => {
    const { db, tables } = setup();
    expect(await deleteFolder(db, 'f1')).toEqual({ ok: true });
    expect(tables.media_folders.map((f) => f.id)).toEqual(['f2']);
  });
});

describe('moveMedia', () => {
  it('move ficheiros para a pasta', async () => {
    const { db, tables } = setup();
    expect(await moveMedia(db, { ids: ['m1', 'm2'], folderId: 'f1' })).toEqual({ ok: true, moved: 2 });
    expect(tables.media_assets.filter((m) => m.folder_id === 'f1').map((m) => m.id)).toEqual(['m1', 'm2']);
  });
  it('tira da pasta', async () => {
    const { db, tables } = setup();
    tables.media_assets[0].folder_id = 'f1';
    expect(await moveMedia(db, { ids: ['m1'], folderId: null })).toEqual({ ok: true, moved: 1 });
    expect(tables.media_assets[0].folder_id).toBeNull();
  });
  it('ficheiros de marcas diferentes', async () => {
    const { db } = setup();
    expect(await moveMedia(db, { ids: ['m1', 'm3'], folderId: null })).toEqual({ ok: false, error: 'Escolha ficheiros de uma só marca.' });
  });
  it('pasta de outra marca', async () => {
    const { db, tables } = setup();
    expect(await moveMedia(db, { ids: ['m1'], folderId: 'f2' })).toEqual({ ok: false, error: 'A pasta é de outra marca.' });
    expect(tables.media_assets[0].folder_id).toBeNull();
  });
  it('ficheiro ou pasta inexistente; lista vazia', async () => {
    const { db } = setup();
    expect(await moveMedia(db, { ids: ['zz'], folderId: null })).toEqual({ ok: false, error: 'Ficheiro não encontrado.' });
    expect(await moveMedia(db, { ids: ['m1'], folderId: 'zz' })).toEqual({ ok: false, error: 'Pasta não encontrada.' });
    expect(await moveMedia(db, { ids: [], folderId: null })).toEqual({ ok: false, error: 'Escolha pelo menos um ficheiro.' });
  });
});
