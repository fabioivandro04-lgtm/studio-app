import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fakeDb } from '../testing/fake-db';
import { testCtx } from '../testing/ctx';
import { runTool } from '../server';
import { confirmarEnvio } from './confirmar-envio';
import { importarDeLink } from './importar-de-link';
import { pedirEnvio } from './pedir-envio';

const B = '11111111-1111-4111-8111-111111111111';
const brand = { id: B, name: 'Uni', timezone: 'Africa/Maputo', created_at: '2026-01-01' };
const text = (r: { content: unknown[] }) => (r.content[0] as { text: string }).text;
const fx = (f: string) => new Uint8Array(readFileSync(path.join(import.meta.dirname, '../../media/__fixtures__', f)));

function storage(objects: Record<string, Uint8Array> = {}) {
  const removed: string[] = [];
  return {
    removed, objects,
    api: {
      createSignedUploadUrl: async (p: string) => ({ data: { signedUrl: `https://sb.test/upload/${p}?token=t`, token: 't', path: p }, error: null }),
      download: async (p: string) => (objects[p] ? { data: new Blob([objects[p] as Uint8Array<ArrayBuffer>]), error: null } : { data: null, error: { message: 'Object not found' } }),
      upload: async (p: string, body: Uint8Array) => ((objects[p] = body), { data: { path: p }, error: null }),
      remove: async (ps: string[]) => (removed.push(...ps), { data: [], error: null }),
    },
  };
}

describe('pedir_envio', () => {
  it('JPG/MP4/MOV dão URL de envio e comando curl', async () => {
    const st = storage();
    const r = await runTool(pedirEnvio, { brandId: B, nome: 'reel final.mp4', mime: 'video/mp4', tamanhoBytes: 1000 }, testCtx(fakeDb({ brands: [brand] }, { storage: st.api }).db));
    const d = r.structuredContent as { envioId: string; url: string };
    expect(d.envioId).toMatch(/^[0-9a-f-]{36}\.mp4$/);
    expect(d.url).toBe(`https://sb.test/upload/${B}/mcp/${d.envioId}?token=t`);
    expect(text(r)).toContain(`curl -X PUT -H 'Content-Type: video/mp4' --data-binary @'reel final.mp4' '${d.url}'`);
  });
  it('HEIC/PNG recusados, tamanho acima do limite recusado', async () => {
    const ctx = testCtx(fakeDb({ brands: [brand] }, { storage: storage().api }).db);
    expect(text(await runTool(pedirEnvio, { brandId: B, nome: 'a.heic', mime: 'image/heic', tamanhoBytes: 10 }, ctx))).toBe('Envie as imagens em JPG (o Instagram só aceita JPG).');
    expect(text(await runTool(pedirEnvio, { brandId: B, nome: 'a.png', mime: 'image/png', tamanhoBytes: 10 }, ctx))).toBe('Envie as imagens em JPG (o Instagram só aceita JPG).');
    expect(text(await runTool(pedirEnvio, { brandId: B, nome: 'a.mp4', mime: 'video/mp4', tamanhoBytes: 51 * 1024 * 1024 }, ctx))).toBe('"a.mp4" tem 51 MB; o limite é 50 MB.');
  });
});

describe('confirmar_envio', () => {
  it('lê medidas e cria o ficheiro na Biblioteca', async () => {
    const env = '33333333-3333-4333-8333-333333333333.mp4';
    const st = storage({ [`${B}/mcp/${env}`]: fx('blue-64x96-1.5s.mp4') });
    const { db, tables } = fakeDb({ brands: [brand], media_assets: [], activity_log: [] }, { storage: st.api });
    const r = await runTool(confirmarEnvio, { brandId: B, envioId: env, nome: 'reel.mp4' }, testCtx(db));
    expect(r.isError).toBeUndefined();
    expect(tables.media_assets[0]).toMatchObject({ id: '33333333-3333-4333-8333-333333333333', brand_id: B, storage_path: `${B}/mcp/${env}`, kind: 'video', mime: 'video/mp4', width: 64, height: 96, duration_s: 1.52, original_name: 'reel.mp4' });
    expect(r.structuredContent).toMatchObject({ mediaId: '33333333-3333-4333-8333-333333333333' });
    expect(tables.activity_log).toHaveLength(1);
  });
  it('ficheiro ainda não chegou → mensagem, sem linha', async () => {
    const { db, tables } = fakeDb({ brands: [brand], media_assets: [] }, { storage: storage().api });
    const r = await runTool(confirmarEnvio, { brandId: B, envioId: '33333333-3333-4333-8333-333333333333.jpg', nome: 'a.jpg' }, testCtx(db));
    expect(text(r)).toBe('O ficheiro ainda não chegou. Confirme que o envio terminou e tente de novo.');
    expect(tables.media_assets).toHaveLength(0);
  });
  it('conteúdo que não é o tipo indicado → apaga e explica', async () => {
    const env = '33333333-3333-4333-8333-333333333333.jpg';
    const st = storage({ [`${B}/mcp/${env}`]: new TextEncoder().encode('<html>') });
    const { db, tables } = fakeDb({ brands: [brand], media_assets: [] }, { storage: st.api });
    const r = await runTool(confirmarEnvio, { brandId: B, envioId: env, nome: 'a.jpg' }, testCtx(db));
    expect(text(r)).toBe('"a.jpg" não é um ficheiro JPG/MP4/MOV válido.');
    expect(st.removed).toEqual([`${B}/mcp/${env}`]);
    expect(tables.media_assets).toHaveLength(0);
  });
  it('repetir confirmar_envio devolve o mesmo ficheiro e nunca apaga nada', async () => {
    const env = '33333333-3333-4333-8333-333333333333.mp4';
    const st = storage({ [`${B}/mcp/${env}`]: fx('blue-64x96-1.5s.mp4') });
    const { db, tables } = fakeDb({ brands: [brand], media_assets: [], activity_log: [] }, { storage: st.api });
    await runTool(confirmarEnvio, { brandId: B, envioId: env, nome: 'reel.mp4' }, testCtx(db));
    const r2 = await runTool(confirmarEnvio, { brandId: B, envioId: env, nome: 'reel.mp4' }, testCtx(db));
    expect(r2.isError).toBeUndefined();
    expect(r2.structuredContent).toMatchObject({ mediaId: '33333333-3333-4333-8333-333333333333' });
    expect(tables.media_assets).toHaveLength(1);
    expect(st.removed).toEqual([]);
  });
  it('um ficheiro da app (fora de mcp/) nunca é lido nem apagado', async () => {
    const env = '44444444-4444-4444-8444-444444444444.jpg';
    const st = storage({ [`${B}/${env}`]: new TextEncoder().encode('<html>') });
    const { db } = fakeDb({ brands: [brand], media_assets: [] }, { storage: st.api });
    const r = await runTool(confirmarEnvio, { brandId: B, envioId: env, nome: 'a.jpg' }, testCtx(db));
    expect(text(r)).toBe('O ficheiro ainda não chegou. Confirme que o envio terminou e tente de novo.');
    expect(st.removed).toEqual([]);
  });
  it('envioId inválido', async () => {
    const r = await runTool(confirmarEnvio, { brandId: B, envioId: '../x.jpg', nome: 'a' }, testCtx(fakeDb({ brands: [brand] }).db));
    expect(r.isError).toBe(true);
  });
});

describe('importar_de_link', () => {
  it('descarrega, guarda e cria o ficheiro', async () => {
    const st = storage();
    const { db, tables } = fakeDb({ brands: [brand], media_assets: [], activity_log: [] }, { storage: st.api });
    const fetchFn = async () => ({ bytes: fx('red-40x50.jpg'), mime: 'image/jpeg', name: 'capa.jpg' });
    const r = await runTool(importarDeLink, { brandId: B, url: 'https://drive.test/capa.jpg' }, testCtx(db, { fetchLink: fetchFn }));
    expect(r.isError).toBeUndefined();
    expect(tables.media_assets[0]).toMatchObject({ kind: 'image', mime: 'image/jpeg', width: 40, height: 50, original_name: 'capa.jpg' });
    expect(Object.keys(st.objects)).toEqual([tables.media_assets[0].storage_path]);
    expect(tables.media_assets[0].storage_path).toMatch(new RegExp(`^${B}/mcp/[0-9a-f-]{36}\\.jpg$`));
  });
  it('erro do link chega ao utilizador', async () => {
    const { db } = fakeDb({ brands: [brand] }, { storage: storage().api });
    const { LinkError } = await import('@/lib/net/safe-fetch');
    const r = await runTool(importarDeLink, { brandId: B, url: 'https://x.test/a' }, testCtx(db, { fetchLink: async () => { throw new LinkError('Link não permitido.'); } }));
    expect(text(r)).toBe('Link não permitido.');
  });
});
