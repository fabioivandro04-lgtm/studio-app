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

const insert = (who: ReturnType<TestDb['asUser']>, week = '2026-10-12') =>
  who.sql(`insert into weekly_reports(brand_id, week_start, facts, report) values ($1, $2, '{}', '{"headline":"x"}') returning id`, [s.brand.id, week]);

describe('relatórios semanais e respostas guardadas', () => {
  it('dono guarda e lê um relatório por semana', async () => {
    await insert(db.asUser(s.ownerId));
    await expect(insert(db.asUser(s.ownerId))).rejects.toThrow(/duplicate key/);
    expect(await db.asUser(s.ownerId).sql('select week_start::text from weekly_reports')).toEqual([{ week_start: '2026-10-12' }]);
  });

  it('a semana começa sempre a uma segunda-feira', async () => {
    await expect(insert(db.asUser(s.ownerId), '2026-10-13')).rejects.toThrow(/check constraint/);
  });

  it('outro utilizador não vê; o agente só lê', async () => {
    await insert(db.asUser(s.ownerId));
    expect(await db.asUser(s.strangerId).sql('select id from weekly_reports')).toHaveLength(0);
    const agent = db.asUser(s.ownerId, { clientId: 'claude-test' });
    expect(await agent.sql('select id from weekly_reports')).toHaveLength(1);
    await expect(insert(agent, '2026-10-05')).rejects.toThrow(/row-level security/);
  });

  it('respostas guardadas por marca e novos tipos de custo de IA', async () => {
    await db.asUser(s.ownerId).sql(`update brands set reply_knowledge = 'Consulta: 50 €' where id = $1`, [s.brand.id]);
    expect((await db.sql('select reply_knowledge from brands'))[0].reply_knowledge).toBe('Consulta: 50 €');
    await db.sql(`insert into ai_usage(brand_id, kind, model, input_tokens, output_tokens, cost_usd) values ($1, 'reply', 'm', 1, 1, 0), ($1, 'report', 'm', 1, 1, 0)`, [s.brand.id]);
  });
});
