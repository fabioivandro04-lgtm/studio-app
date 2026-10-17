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

const owner = () => db.asUser(s.ownerId);
const agent = () => db.asUser(s.ownerId, { clientId: 'claude-test' });
const newFolder = async (who = owner(), name = 'Prazos 2027', brandId = s.brand.id) =>
  (await who.sql(`insert into media_folders(brand_id, name) values ($1, $2) returning id`, [brandId, name]))[0].id as string;

describe('pastas (dono)', () => {
  it('cria, renomeia e põe ficheiros na pasta', async () => {
    const id = await newFolder();
    await owner().sql(`update media_folders set name='Prazos', notes='Tema' where id=$1`, [id]);
    await owner().sql(`update media_assets set folder_id=$1 where id=$2`, [id, s.media.id]);
    expect((await db.sql('select folder_id from media_assets where id=$1', [s.media.id]))[0].folder_id).toBe(id);
  });

  it('apagar a pasta deixa os ficheiros sem pasta', async () => {
    const id = await newFolder();
    await owner().sql(`update media_assets set folder_id=$1 where id=$2`, [id, s.media.id]);
    await owner().sql(`delete from media_folders where id=$1`, [id]);
    expect(await db.sql('select folder_id from media_assets where id=$1', [s.media.id])).toEqual([{ folder_id: null }]);
  });

  it('recusa pasta de outra marca', async () => {
    const [other] = await db.sql(`insert into brands(name,color) values('Outra','#000000') returning id`);
    const id = await newFolder(owner(), 'X', other.id);
    await expect(owner().sql(`update media_assets set folder_id=$1 where id=$2`, [id, s.media.id])).rejects.toThrow(/outra marca/);
  });

  it('recusa nome repetido na mesma marca (sem distinguir maiúsculas) e nome vazio', async () => {
    await newFolder(owner(), 'Prazos');
    await expect(newFolder(owner(), 'prazos')).rejects.toThrow(/unique|duplicate/);
    await expect(newFolder(owner(), '   ')).rejects.toThrow(/check/);
  });

  it('estranho não vê pastas', async () => {
    await newFolder();
    expect(await db.asUser(s.strangerId).sql('select id from media_folders')).toEqual([]);
  });
});

describe('pastas (agente)', () => {
  it('cria e lê, mas não altera nem apaga', async () => {
    const id = await newFolder(agent());
    expect(await agent().sql('select id from media_folders')).toEqual([{ id }]);
    expect(await agent().sql(`update media_folders set name='Y' returning 1`)).toEqual([]);
    expect(await agent().sql(`delete from media_folders returning 1`)).toEqual([]);
    expect((await db.sql('select name from media_folders'))[0].name).toBe('Prazos 2027');
  });

  it('cria ficheiros já dentro de uma pasta', async () => {
    const id = await newFolder(agent());
    await agent().sql(
      `insert into media_assets(brand_id,storage_path,kind,mime,size_bytes,folder_id) values ($1,'mcp/b/2.png','image','image/png',10,$2)`,
      [s.brand.id, id],
    );
    expect(await db.sql('select count(*)::int as n from media_assets where folder_id=$1', [id])).toEqual([{ n: 1 }]);
  });
});

it('migração 0015 é reaplicável', async () => {
  const sql = readFileSync(path.join(__dirname, '../migrations/0015_pastas.sql'), 'utf8');
  await db.sql(sql);
  await db.sql(sql);
});
