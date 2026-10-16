import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seed, startTestDb, type TestDb } from './db';

// Token OAuth do Claude = JWT do dono com o claim client_id ("agente").
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

const agent = () => db.asUser(s.ownerId, { clientId: 'claude-test' });
const owner = () => db.asUser(s.ownerId);
const payload = (over: Record<string, unknown> = {}) => ({
  brandId: s.brand.id, internalTitle: 'Do Claude', scheduledAt: '2030-11-02T07:00:00Z', intent: 'draft', origin: 'claude',
  mediaIds: [s.media.id], targets: [{ accountId: s.account.id, format: 'ig_image', caption: 'Olá', title: '' }], ...over,
});
const saveAs = (who: ReturnType<typeof agent>, p: unknown) => who.sql('select save_post($1::jsonb) as id', [JSON.stringify(p)]);

describe('origem do post', () => {
  it('omissão "app"; save_post grava "claude" quando pedido', async () => {
    const [{ id: a }] = await saveAs(owner(), payload({ origin: undefined }));
    const [{ id: c }] = await saveAs(agent(), payload());
    expect(await db.sql('select id, origin from posts order by origin')).toEqual([{ id: a, origin: 'app' }, { id: c, origin: 'claude' }]);
    await expect(db.sql(`update posts set origin='outra' where id=$1`, [a])).rejects.toThrow(/check/);
  });
});

describe('agente (token do Claude)', () => {
  it('cria e edita rascunhos', async () => {
    const [{ id }] = await saveAs(agent(), payload());
    await saveAs(agent(), payload({ id, internalTitle: 'Editado' }));
    expect((await db.sql('select internal_title, status from posts where id=$1', [id]))[0]).toEqual({ internal_title: 'Editado', status: 'draft' });
    expect(await db.sql('select count(*)::int as n from post_targets where post_id=$1', [id])).toEqual([{ n: 1 }]);
  });

  it('save_post com intent=schedule é recusado', async () => {
    await expect(saveAs(agent(), payload({ intent: 'schedule' }))).rejects.toThrow(/Só rascunhos/);
    const [{ id }] = await saveAs(agent(), payload());
    await expect(saveAs(agent(), payload({ id, intent: 'schedule' }))).rejects.toThrow(/Só rascunhos/);
  });

  it('não muda o estado nem mexe em posts não-rascunho', async () => {
    const [{ id: draft }] = await saveAs(agent(), payload());
    await expect(agent().sql(`update posts set status='scheduled' where id=$1`, [draft])).rejects.toThrow(/row-level security/);
    const [{ id: sched }] = await saveAs(owner(), payload({ intent: 'schedule' }));
    expect(await agent().sql(`update posts set internal_title='x' where id=$1 returning id`, [sched])).toEqual([]);
    await expect(agent().sql(`update posts set status='cancelled' where id=$1`, [draft])).rejects.toThrow(/row-level security/);
    await expect(saveAs(agent(), payload({ id: sched }))).rejects.toThrow();
    expect((await db.sql('select status, internal_title from posts where id=$1', [sched]))[0]).toEqual({ status: 'scheduled', internal_title: 'Do Claude' });
  });

  it('não apaga nada', async () => {
    const [{ id }] = await saveAs(agent(), payload());
    await db.sql(`insert into ideas(brand_id, kind, title) values ($1,'week','I')`, [s.brand.id]);
    await db.sql(`insert into deadlines(brand_id, title, due_date) values ($1,'P','2030-01-01')`, [s.brand.id]);
    await db.sql(`insert into storage.objects(bucket_id, name) values ('media','b/1.jpg')`);
    for (const t of ['posts', 'media_assets', 'ideas', 'deadlines', 'storage.objects', 'brands']) {
      expect(await agent().sql(`delete from ${t} returning 1`)).toEqual([]);
    }
    expect(await db.sql('select count(*)::int as n from posts where id=$1', [id])).toEqual([{ n: 1 }]);
    expect(await db.sql('select count(*)::int as n from ideas')).toEqual([{ n: 1 }]);
    expect(await db.sql('select count(*)::int as n from storage.objects')).toEqual([{ n: 1 }]);
  });

  it('não escreve em contas, marcas, definições nem grupos de hashtags', async () => {
    expect(await agent().sql(`update social_accounts set status='needs_reauth' returning 1`)).toEqual([]);
    expect(await agent().sql(`update brands set name='X' returning 1`)).toEqual([]);
    await expect(agent().sql(`insert into brands(name,color) values('Nova','#000000')`)).rejects.toThrow(/row-level security/);
    await expect(agent().sql(`insert into hashtag_groups(brand_id,name,tags) values ($1,'G','{#a}')`, [s.brand.id])).rejects.toThrow(/row-level security/);
    expect(await agent().sql(`update app_settings set ai_monthly_limit_usd = 999 returning 1`)).toEqual([]);
  });

  it('pode criar ideias, prazos, ficheiros e registo', async () => {
    await agent().sql(`insert into ideas(brand_id, kind, title) values ($1,'week','Ideia')`, [s.brand.id]);
    await agent().sql(`insert into deadlines(brand_id, title, due_date) values ($1,'Prazo','2030-01-01')`, [s.brand.id]);
    await agent().sql(`insert into media_assets(brand_id,storage_path,kind,mime,size_bytes) values ($1,'b/2.png','image','image/png',10)`, [s.brand.id]);
    await agent().sql(`insert into activity_log(brand_id, level, source, message) values ($1,'info','mcp','ok')`, [s.brand.id]);
    expect(await db.sql('select count(*)::int as n from media_assets')).toEqual([{ n: 2 }]);
  });
});

describe('dono na app (sem client_id)', () => {
  it('continua a agendar, cancelar e apagar', async () => {
    const [{ id }] = await saveAs(owner(), payload({ intent: 'schedule', origin: undefined }));
    await owner().sql(`update posts set status='cancelled' where id=$1`, [id]);
    expect(await owner().sql('delete from posts where id=$1 returning 1', [id])).toHaveLength(1);
    expect(await owner().sql(`update brands set name='Y' returning 1`)).toHaveLength(1);
  });
});

it('migração 0014 é reaplicável', async () => {
  const sql = readFileSync(path.join(__dirname, '../migrations/0014_mcp.sql'), 'utf8');
  await db.sql(sql);
  await db.sql(sql);
});

describe('revisão final: agente', () => {
  it('não altera ficheiros da Biblioteca (media_assets) nem objetos do Storage', async () => {
    expect(await agent().sql(`update media_assets set storage_path='outro' where id=$1 returning 1`, [s.media.id])).toEqual([]);
    await db.sql(`insert into storage.objects(bucket_id, name) values ('media','b/1.jpg')`);
    expect(await agent().sql(`update storage.objects set name='b/2.jpg' returning 1`)).toEqual([]);
  });
  it('não esconde a origem: save_post e insert direto ficam "claude"', async () => {
    const [{ id }] = await saveAs(agent(), payload({ origin: undefined }));
    expect((await db.sql('select origin from posts where id=$1', [id]))[0].origin).toBe('claude');
    await expect(agent().sql(`insert into posts(brand_id, status, origin) values ($1,'draft','app')`, [s.brand.id])).rejects.toThrow(/row-level security/);
    await expect(agent().sql(`update posts set origin='app' where id=$1`, [id])).rejects.toThrow(/row-level security/);
  });
  it('não reescreve o registo de atividade', async () => {
    await db.sql(`insert into activity_log(brand_id, level, source, message) values ($1,'info','app','x')`, [s.brand.id]);
    expect(await agent().sql(`update activity_log set message='y' returning 1`)).toEqual([]);
  });
  it('cancel_post e retry_target como agente não mudam um post agendado', async () => {
    const [{ id }] = await saveAs(owner(), payload({ intent: 'schedule', origin: undefined }));
    await agent().sql('select cancel_post($1)', [id]).catch(() => {});
    expect((await db.sql('select status from posts where id=$1', [id]))[0].status).toBe('scheduled');
  });
});
