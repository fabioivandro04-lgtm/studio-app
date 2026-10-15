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
  await db.sql(`update app_settings set ai_model = 'anthropic/claude-sonnet-5.5', ai_monthly_limit_usd = 5`);
  s = await seed(db);
});

describe('marcas: campos de IA', () => {
  it('marca nova tem defaults de IA', async () => {
    const [b] = await db.sql('select ai_context, ai_voice, ai_hashtags, goal from brands where id=$1', [s.brand.id]);
    expect(b).toEqual({ ai_context: '', ai_voice: '', ai_hashtags: [], goal: 'contacts' });
  });

  it('goal inválido é recusado', async () => {
    await expect(db.sql(`update brands set goal='x' where id=$1`, [s.brand.id])).rejects.toThrow(/check/);
  });

  it('contexto acima de 4000 é recusado', async () => {
    await expect(db.sql(`update brands set ai_context=repeat('a',4001) where id=$1`, [s.brand.id])).rejects.toThrow(/check/);
  });

  it('voz acima de 2000 é recusada', async () => {
    await expect(db.sql(`update brands set ai_voice=repeat('a',2001) where id=$1`, [s.brand.id])).rejects.toThrow(/check/);
  });

  it('mais de 10 hashtags fixas é recusado', async () => {
    await expect(
      db.sql(`update brands set ai_hashtags=array_fill('#a'::text, array[11]) where id=$1`, [s.brand.id]),
    ).rejects.toThrow(/check/);
  });
});

describe('app_settings', () => {
  it('tem uma linha com defaults', async () => {
    const rows = await db.sql('select ai_model, ai_monthly_limit_usd from app_settings');
    expect(rows).toEqual([{ ai_model: 'anthropic/claude-sonnet-5.5', ai_monthly_limit_usd: '5.00' }]);
  });

  it('não é possível criar segunda linha', async () => {
    await expect(db.sql('insert into app_settings(id) values (false)')).rejects.toThrow();
  });

  it('dono atualiza; outro não vê', async () => {
    await db.asUser(s.ownerId).sql('update app_settings set ai_monthly_limit_usd = 10');
    expect((await db.sql('select ai_monthly_limit_usd from app_settings'))[0].ai_monthly_limit_usd).toBe('10.00');
    expect(await db.asUser(s.strangerId).sql('select * from app_settings')).toHaveLength(0);
  });
});

describe('ai_usage', () => {
  it('dono insere e lê; outro não lê', async () => {
    await db
      .asUser(s.ownerId)
      .sql(
        `insert into ai_usage(brand_id, kind, model, input_tokens, output_tokens, cost_usd) values ($1,'suggest','m',10,5,0.002)`,
        [s.brand.id],
      );
    expect(await db.asUser(s.ownerId).sql('select kind from ai_usage')).toEqual([{ kind: 'suggest' }]);
    expect(await db.asUser(s.strangerId).sql('select * from ai_usage')).toHaveLength(0);
  });

  it('kind inválido é recusado', async () => {
    await expect(db.sql(`insert into ai_usage(kind, model, input_tokens, output_tokens, cost_usd) values ('x','m',0,0,0)`)).rejects.toThrow(/check/);
  });

  it('apagar marca mantém o registo de uso', async () => {
    await db.sql(`insert into ai_usage(brand_id, kind, model, input_tokens, output_tokens, cost_usd) values ($1,'refine','m',1,1,0)`, [s.brand.id]);
    await db.sql('delete from media_assets where brand_id=$1', [s.brand.id]);
    await db.sql('delete from brands where id=$1', [s.brand.id]);
    expect((await db.sql('select brand_id from ai_usage'))[0].brand_id).toBeNull();
  });
});

describe('migração 0009', () => {
  it('pode ser aplicada de novo sem erro nem linhas duplicadas', async () => {
    const sqlText = readFileSync(path.resolve(__dirname, '../migrations/0009_ai.sql'), 'utf8');
    await db.sql(sqlText);
    expect(await db.sql('select count(*)::int as n from app_settings')).toEqual([{ n: 1 }]);
  });
});

describe('post_metrics', () => {
  it('tem profile_visits e follows', async () => {
    const cols = await db.sql(
      `select column_name from information_schema.columns where table_name='post_metrics' and column_name in ('profile_visits','follows') order by 1`,
    );
    expect(cols.map((c) => c.column_name)).toEqual(['follows', 'profile_visits']);
  });
});
