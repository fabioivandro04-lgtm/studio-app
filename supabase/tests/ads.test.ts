import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seed, startTestDb, type TestDb } from './db';

let db: TestDb;
let s: Awaited<ReturnType<typeof seed>>;
let adId: string;

beforeAll(async () => {
  db = await startTestDb();
});
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.sql('truncate brands, app_owner, auth.users cascade');
  s = await seed(db);
  const [a] = await db.sql(`insert into ad_accounts(brand_id,external_id,name,access_token_enc) values ($1,'111','Uni ads','v1.x.y') returning id`, [s.brand.id]);
  adId = a.id;
});

describe('contas de anúncios', () => {
  it('dono lê as colunas públicas, mas não o token', async () => {
    expect(await db.asUser(s.ownerId).sql('select id, name, currency from ad_accounts')).toEqual([{ id: adId, name: 'Uni ads', currency: 'EUR' }]);
    await expect(db.asUser(s.ownerId).sql('select access_token_enc from ad_accounts')).rejects.toThrow(/permission denied/);
  });

  it('só o servidor cria ou altera contas', async () => {
    await expect(db.asUser(s.ownerId).sql(`insert into ad_accounts(brand_id,external_id,name,access_token_enc) values ($1,'2','X','t')`, [s.brand.id])).rejects.toThrow(/permission denied/);
    await expect(db.asUser(s.ownerId).sql(`update ad_accounts set name='X'`)).rejects.toThrow(/permission denied/);
  });

  it('outro utilizador não vê nem apaga', async () => {
    expect(await db.asUser(s.strangerId).sql('select id from ad_accounts')).toHaveLength(0);
    expect(await db.asUser(s.strangerId).sql('delete from ad_accounts returning 1')).toEqual([]);
  });

  it('o agente (Claude) não apaga; o dono sim', async () => {
    expect(await db.asUser(s.ownerId, { clientId: 'claude-test' }).sql('delete from ad_accounts returning 1')).toEqual([]);
    expect(await db.asUser(s.ownerId).sql('delete from ad_accounts returning 1')).toHaveLength(1);
  });
});
