import { readFileSync } from 'node:fs';
import path from 'node:path';
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

const addGroup = (name: string, tags: string) => db.sql(`insert into hashtag_groups(brand_id, name, tags) values ($1, $2, $3::text[]) returning *`, [s.brand.id, name, tags]);

describe('grupos de hashtags', () => {
  it('cria; recusa nome vazio/41 e tags vazias/31', async () => {
    expect((await addGroup('Bolsas', '{#bolsas,#estudar}'))[0].tags).toEqual(['#bolsas', '#estudar']);
    await expect(addGroup('', '{#a}')).rejects.toThrow(/check/);
    await expect(addGroup('x'.repeat(41), '{#a}')).rejects.toThrow(/check/);
    await expect(addGroup('Vazio', '{}')).rejects.toThrow(/check/);
    await expect(addGroup('Muitas', `{${Array.from({ length: 31 }, (_, i) => `#t${i}`).join(',')}}`)).rejects.toThrow(/check/);
  });

  it('RLS: dono lê e escreve; outro não vê', async () => {
    await db.asUser(s.ownerId).sql(`insert into hashtag_groups(brand_id, name, tags) values ($1,'G','{#a}')`, [s.brand.id]);
    expect(await db.asUser(s.ownerId).sql('select name from hashtag_groups')).toEqual([{ name: 'G' }]);
    expect(await db.asUser(s.strangerId).sql('select * from hashtag_groups')).toHaveLength(0);
  });

  it('apagar a marca apaga os grupos', async () => {
    await addGroup('G', '{#a}');
    await db.sql('delete from brands where id=$1', [s.brand.id]);
    expect(await db.sql('select * from hashtag_groups')).toHaveLength(0);
  });
});

describe('horários fixos', () => {
  it('omissão [] e só aceita lista', async () => {
    expect((await db.sql('select posting_slots from brands where id=$1', [s.brand.id]))[0].posting_slots).toEqual([]);
    await db.sql(`update brands set posting_slots='[{"weekday":1,"time":"19:00"}]' where id=$1`, [s.brand.id]);
    await expect(db.sql(`update brands set posting_slots='{}' where id=$1`, [s.brand.id])).rejects.toThrow(/check/);
  });

  it('migração 0012 reaplicável', async () => {
    await db.sql(readFileSync(path.resolve(__dirname, '../migrations/0012_quick.sql'), 'utf8'));
  });
});
