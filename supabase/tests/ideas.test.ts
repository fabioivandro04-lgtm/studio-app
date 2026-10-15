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
  await db.sql('truncate brands, app_owner, auth.users, ai_usage cascade');
  s = await seed(db);
});

const insertIdea = (over = '') =>
  db.sql(`insert into ideas(brand_id, kind, title${over ? ', ' + over.split('=')[0] : ''}) values ($1, 'shorts', 'Ideia'${over ? ', ' + over.split('=')[1] : ''}) returning *`, [s.brand.id]);

describe('marcas: posts por semana', () => {
  it('omissão 3; recusa 0 e 22', async () => {
    expect((await db.sql('select posts_per_week from brands where id=$1', [s.brand.id]))[0].posts_per_week).toBe(3);
    await expect(db.sql('update brands set posts_per_week=0 where id=$1', [s.brand.id])).rejects.toThrow(/check/);
    await expect(db.sql('update brands set posts_per_week=22 where id=$1', [s.brand.id])).rejects.toThrow(/check/);
  });
});

describe('ideias', () => {
  it('defaults', async () => {
    const [i] = await insertIdea();
    expect(i).toMatchObject({ status: 'new', platforms: [], hook: '', outline: '', caption: '', format: null, suggested_at: null, post_id: null });
  });

  it('checks de tipo, estado e tamanho', async () => {
    await expect(db.sql(`insert into ideas(brand_id, kind, title) values ($1,'x','t')`, [s.brand.id])).rejects.toThrow(/check/);
    await expect(insertIdea("status='feita'")).rejects.toThrow(/check/);
    await expect(db.sql(`insert into ideas(brand_id, kind, title) values ($1,'shorts', repeat('a',121))`, [s.brand.id])).rejects.toThrow(/check/);
    await expect(db.sql(`insert into ideas(brand_id, kind, title) values ($1,'shorts', '')`, [s.brand.id])).rejects.toThrow(/check/);
  });

  it('RLS: dono lê e escreve; outro não vê', async () => {
    await db.asUser(s.ownerId).sql(`insert into ideas(brand_id, kind, title) values ($1,'week','Plano')`, [s.brand.id]);
    expect(await db.asUser(s.ownerId).sql('select title from ideas')).toEqual([{ title: 'Plano' }]);
    expect(await db.asUser(s.strangerId).sql('select * from ideas')).toHaveLength(0);
  });

  it('apagar prazo e post mantém a ideia; apagar marca apaga-a', async () => {
    const [d] = await db.sql(`insert into deadlines(brand_id, title, due_date) values ($1,'Lisboa','2026-12-01') returning id`, [s.brand.id]);
    const [p] = await db.sql(`insert into posts(brand_id, internal_title, status) values ($1,'x','draft') returning id`, [s.brand.id]);
    const [i] = await db.sql(`insert into ideas(brand_id, kind, title, deadline_id, post_id) values ($1,'deadline','I',$2,$3) returning id`, [s.brand.id, d.id, p.id]);
    await db.sql('delete from deadlines where id=$1', [d.id]);
    await db.sql('delete from posts where id=$1', [p.id]);
    expect((await db.sql('select deadline_id, post_id from ideas where id=$1', [i.id]))[0]).toEqual({ deadline_id: null, post_id: null });
    await db.sql('delete from media_assets where brand_id=$1', [s.brand.id]);
    await db.sql('delete from brands where id=$1', [s.brand.id]);
    expect(await db.sql('select * from ideas')).toHaveLength(0);
  });

  it('ai_usage aceita kind ideas', async () => {
    await db.sql(`insert into ai_usage(kind, model, input_tokens, output_tokens, cost_usd) values ('ideas','m',1,1,0)`);
    expect(await db.sql(`select kind from ai_usage`)).toEqual([{ kind: 'ideas' }]);
  });

  it('migração 0011 reaplicável', async () => {
    await db.sql(readFileSync(path.resolve(__dirname, '../migrations/0011_ideas.sql'), 'utf8'));
    expect((await db.sql('select posts_per_week from brands where id=$1', [s.brand.id]))[0].posts_per_week).toBe(3);
  });
});
