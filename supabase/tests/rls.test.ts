import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seed, startTestDb, type TestDb } from './db';

let db: TestDb;
let s: Awaited<ReturnType<typeof seed>>;
beforeAll(async () => {
  db = await startTestDb();
  s = await seed(db);
});
afterAll(async () => {
  await db?.stop();
});

describe('RLS', () => {
  it('dono vê as marcas', async () => {
    expect(await db.asUser(s.ownerId).sql('select * from brands')).toHaveLength(1);
  });

  it('outro utilizador não vê nada', async () => {
    expect(await db.asUser(s.strangerId).sql('select * from brands')).toHaveLength(0);
    expect(await db.asUser(s.strangerId).sql('select id from social_accounts')).toHaveLength(0);
  });

  it('anónimo não vê nada', async () => {
    expect(await db.asUser(null).sql('select id from brands')).toHaveLength(0);
    await expect(db.asUser(null).sql('select id from social_accounts')).rejects.toThrow(/permission denied/);
  });

  it('outro utilizador não consegue criar marcas', async () => {
    await expect(
      db.asUser(s.strangerId).sql(`insert into brands(name,color) values('X','#000000')`),
    ).rejects.toThrow(/row-level security/);
  });

  it('dono não consegue ler colunas de tokens', async () => {
    await expect(db.asUser(s.ownerId).sql('select access_token_enc from social_accounts')).rejects.toThrow(
      /permission denied/,
    );
  });

  it('dono lê as colunas públicas da conta', async () => {
    const rows = await db.asUser(s.ownerId).sql('select id, handle, status from social_accounts');
    expect(rows).toEqual([{ id: s.account.id, handle: '@uni', status: 'active' }]);
  });

  it('dono pode usar o bucket media; outro não', async () => {
    await db.asUser(s.ownerId).sql(`insert into storage.objects(bucket_id,name) values('media','a/b.jpg')`);
    expect(await db.asUser(s.strangerId).sql(`select * from storage.objects`)).toHaveLength(0);
    await expect(
      db.asUser(s.strangerId).sql(`insert into storage.objects(bucket_id,name) values('media','c.jpg')`),
    ).rejects.toThrow(/row-level security/);
  });
});
