import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seed, startTestDb, type TestDb } from './db';

let db: TestDb;
let s: Awaited<ReturnType<typeof seed>>;

beforeAll(async () => {
  db = await startTestDb();
});
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.sql('truncate brands, app_owner, auth.users cascade');
  s = await seed(db);
});

const payload = (over: Record<string, unknown> = {}) => ({
  brandId: s.brand.id, internalTitle: 'Prazos', scheduledAt: '2026-11-02T07:00:00Z', intent: 'schedule',
  mediaIds: [s.media.id], targets: [{ accountId: s.account.id, format: 'ig_image', caption: 'Olá', title: '' }], ...over,
});
const save = (p: unknown) => db.asUser(s.ownerId).sql('select save_post($1::jsonb) as id', [JSON.stringify(p)]);

describe('save_post', () => {
  it('cria post, mídia e destinos', async () => {
    const [{ id }] = await save(payload());
    const [post] = await db.sql('select * from posts where id=$1', [id]);
    expect(post).toMatchObject({ status: 'scheduled', internal_title: 'Prazos' });
    expect(await db.sql('select media_id, position from post_media where post_id=$1', [id])).toEqual([{ media_id: s.media.id, position: 0 }]);
    const [t] = await db.sql('select * from post_targets where post_id=$1', [id]);
    expect(t).toMatchObject({ format: 'ig_image', caption: 'Olá', title: null, status: 'pending' });
  });

  it('guarda o momento da capa (coverMs) nas opções do destino', async () => {
    const [{ id }] = await save(payload({ targets: [{ accountId: s.account.id, format: 'ig_image', caption: 'Olá', title: '', coverMs: 3200 }] }));
    const [t] = await db.sql('select options from post_targets where post_id=$1', [id]);
    expect(t.options).toEqual({ thumbOffsetMs: 3200 });
    const [{ id: id2 }] = await save(payload());
    const [t2] = await db.sql('select options from post_targets where post_id=$1', [id2]);
    expect(t2.options).toEqual({});
  });

  it('rascunho fica draft', async () => {
    const [{ id }] = await save(payload({ intent: 'draft' }));
    expect((await db.sql('select status from posts where id=$1', [id]))[0].status).toBe('draft');
  });

  it('editar substitui mídia e destinos', async () => {
    const [{ id }] = await save(payload());
    await save(payload({ id, internalTitle: 'Novo', targets: [{ accountId: s.account.id, format: 'ig_story', caption: '', title: '' }] }));
    expect((await db.sql('select internal_title from posts where id=$1', [id]))[0].internal_title).toBe('Novo');
    expect((await db.sql('select format from post_targets where post_id=$1', [id])).map((r) => r.format)).toEqual(['ig_story']);
  });

  it('não deixa editar post que já começou a publicar', async () => {
    const [{ id }] = await save(payload());
    await db.sql(`update post_targets set status='processing' where post_id=$1`, [id]);
    await expect(save(payload({ id }))).rejects.toThrow(/post_locked/);
  });

  it('recusa mídia de outra marca', async () => {
    const [other] = await db.sql(`insert into brands(name,color) values('Outra','#000000') returning id`);
    const [m] = await db.sql(`insert into media_assets(brand_id,storage_path,kind,mime,size_bytes) values ($1,'o/1.jpg','image','image/jpeg',1) returning id`, [other.id]);
    await expect(save(payload({ mediaIds: [m.id] }))).rejects.toThrow(/media_brand/);
  });

  it('recusa conta de outra marca', async () => {
    const [other] = await db.sql(`insert into brands(name,color) values('Outra','#000000') returning id`);
    const [a] = await db.sql(`insert into social_accounts(brand_id,platform,external_id,handle,display_name,access_token_enc) values ($1,'instagram','o','o','o','x') returning id`, [other.id]);
    await expect(save(payload({ targets: [{ accountId: a.id, format: 'ig_image', caption: '', title: '' }] }))).rejects.toThrow(/account_brand/);
  });

  it('é atómico: erro nos destinos não deixa post criado', async () => {
    await expect(save(payload({ targets: [{ accountId: s.account.id, format: 'tiktok_video', caption: '', title: '' }] }))).rejects.toThrow();
    expect(await db.sql('select * from posts')).toHaveLength(0);
  });

  it('outro utilizador não consegue guardar', async () => {
    await expect(db.asUser(s.strangerId).sql('select save_post($1::jsonb)', [JSON.stringify(payload())])).rejects.toThrow();
  });
});

describe('cancel_post', () => {
  it('cancela o post e marca destinos por publicar como failed', async () => {
    const [{ id }] = await save(payload());
    await db.asUser(s.ownerId).sql('select cancel_post($1)', [id]);
    expect((await db.sql('select status from posts where id=$1', [id]))[0].status).toBe('cancelled');
    expect((await db.sql('select status, last_error from post_targets where post_id=$1', [id]))[0]).toEqual({ status: 'failed', last_error: 'Cancelado' });
  });

  it('não altera destinos já publicados', async () => {
    const [{ id }] = await save(payload());
    await db.sql(`update post_targets set status='published' where post_id=$1`, [id]);
    await db.asUser(s.ownerId).sql('select cancel_post($1)', [id]);
    expect((await db.sql('select status from post_targets where post_id=$1', [id]))[0].status).toBe('published');
  });
});
