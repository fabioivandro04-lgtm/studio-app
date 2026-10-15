import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
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

async function post(opts: { status?: string; at?: string } = {}) {
  const [p] = await db.sql(
    `insert into posts(brand_id, scheduled_at, status) values ($1, now() + ($2)::interval, $3) returning *`,
    [s.brand.id, opts.at ?? '-1 minute', opts.status ?? 'scheduled'],
  );
  return p;
}
async function target(postId: string, extra: Record<string, unknown> = {}) {
  const cols = ['post_id', 'social_account_id', 'format', ...Object.keys(extra)];
  const vals = [postId, s.account.id, 'ig_image', ...Object.values(extra)];
  const [t] = await db.sql(
    `insert into post_targets(${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')}) returning *`,
    vals,
  );
  return t;
}
async function claimAs(client: pg.Client | null, limit: number) {
  const run = async (c: pg.Client) => {
    await c.query('begin');
    await c.query('set local role service_role');
    const r = await c.query('select * from claim_due_targets($1)', [limit]);
    await c.query('commit');
    return r.rows;
  };
  return run(client ?? (await db.connect()));
}

describe('claim_due_targets', () => {
  it('devolve só destinos devidos', async () => {
    const due = await target((await post()).id);
    await target((await post({ at: '1 hour' })).id);
    await target((await post({ status: 'draft' })).id);
    await target((await post({ status: 'cancelled' })).id);
    await target((await post()).id, { status: 'awaiting_user' });
    const rows = await claimAs(null, 10);
    expect(rows.map((r) => r.id)).toEqual([due.id]);
    expect(rows[0].locked_until).not.toBeNull();
  });

  it('duas chamadas concorrentes não devolvem o mesmo destino', async () => {
    for (let i = 0; i < 10; i++) await target((await post()).id);
    const [c1, c2] = [await db.connect(), await db.connect()];
    const [a, b] = await Promise.all([claimAs(c1, 10), claimAs(c2, 10)]);
    const ids = [...a, ...b].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(10);
  });

  it('destino bloqueado não volta antes de locked_until', async () => {
    await target((await post()).id);
    expect(await claimAs(null, 10)).toHaveLength(1);
    expect(await claimAs(null, 10)).toHaveLength(0);
    await db.sql(`update post_targets set locked_until = now() - interval '1 second'`);
    expect(await claimAs(null, 10)).toHaveLength(1);
  });

  it('ignora destinos de contas needs_reauth e não altera attempts', async () => {
    await target((await post()).id);
    await db.sql(`update social_accounts set status='needs_reauth'`);
    expect(await claimAs(null, 10)).toHaveLength(0);
    await db.sql(`update social_accounts set status='active'`);
    const rows = await claimAs(null, 10);
    expect(rows).toHaveLength(1);
    expect(rows[0].attempts).toBe(0);
  });

  it('respeita next_attempt_at', async () => {
    const p = await post();
    await target(p.id, { next_attempt_at: new Date(Date.now() + 60_000).toISOString() });
    expect(await claimAs(null, 10)).toHaveLength(0);
  });

  it('respeita o limite', async () => {
    for (let i = 0; i < 3; i++) await target((await post()).id);
    expect(await claimAs(null, 2)).toHaveLength(2);
  });

  it('authenticated não pode executar claim_due_targets', async () => {
    await expect(db.asUser(s.ownerId).sql('select * from claim_due_targets(5)')).rejects.toThrow(/permission denied/);
  });
});

describe('refresh_post_status', () => {
  async function statusFor(postStatus: string, targets: string[]) {
    const p = await post({ status: postStatus });
    for (const st of targets) await target(p.id, { status: st });
    const [r] = await db.sql('select refresh_post_status($1) as s', [p.id]);
    const [row] = await db.sql('select status from posts where id=$1', [p.id]);
    expect(row.status).toBe(r.s);
    return r.s;
  }
  it('published + awaiting_user → needs_action', async () => {
    expect(await statusFor('publishing', ['published', 'awaiting_user'])).toBe('needs_action');
  });
  it('todos pending → scheduled', async () => {
    expect(await statusFor('scheduled', ['pending', 'pending'])).toBe('scheduled');
  });
  it('published + pending → publishing', async () => {
    expect(await statusFor('scheduled', ['published', 'pending'])).toBe('publishing');
  });
  it('published + failed → partial', async () => {
    expect(await statusFor('publishing', ['published', 'failed'])).toBe('partial');
  });
  it('todos failed → failed', async () => {
    expect(await statusFor('publishing', ['failed', 'failed'])).toBe('failed');
  });
  it('todos published → published', async () => {
    expect(await statusFor('publishing', ['published', 'published'])).toBe('published');
  });
  it('cancelled e draft ficam', async () => {
    expect(await statusFor('cancelled', ['pending'])).toBe('cancelled');
    expect(await statusFor('draft', ['pending'])).toBe('draft');
  });
});
