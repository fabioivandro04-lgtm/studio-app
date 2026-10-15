import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seed, startTestDb, type TestDb } from './db';

let db: TestDb;
let s: Awaited<ReturnType<typeof seed>>;
let postId: string;
let targetId: string;

beforeAll(async () => {
  db = await startTestDb();
});
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.sql('truncate brands, app_owner, auth.users cascade');
  s = await seed(db);
  const [p] = await db.sql(`insert into posts(brand_id, scheduled_at, status) values ($1, now() - interval '1 hour', 'failed') returning id`, [s.brand.id]);
  postId = p.id;
  const [t] = await db.sql(
    `insert into post_targets(post_id, social_account_id, format, status, attempts, last_error, progress, next_attempt_at)
     values ($1,$2,'ig_image','failed',4,'Rede em baixo','{"step":"container"}', now()) returning id`,
    [postId, s.account.id],
  );
  targetId = t.id;
});

const asOwner = (q: string, p: unknown[]) => db.asUser(s.ownerId).sql(q, p);

describe('retry_target', () => {
  it('volta a pending, limpa erro e progresso, e o post volta a ser apanhado', async () => {
    await asOwner('select retry_target($1)', [targetId]);
    const [t] = await db.sql('select status, attempts, last_error, progress, next_attempt_at from post_targets where id=$1', [targetId]);
    expect(t).toEqual({ status: 'pending', attempts: 0, last_error: null, progress: {}, next_attempt_at: null });
    const [p] = await db.sql('select status from posts where id=$1', [postId]);
    expect(p.status).toBe('scheduled');
  });

  it('só funciona em destinos failed', async () => {
    await db.sql(`update post_targets set status='published' where id=$1`, [targetId]);
    await expect(asOwner('select retry_target($1)', [targetId])).rejects.toThrow(/not_failed/);
  });
});

describe('mark_target_done', () => {
  it('awaiting_user → published e atualiza o post', async () => {
    await db.sql(`update post_targets set status='awaiting_user' where id=$1`, [targetId]);
    await asOwner('select mark_target_done($1, null, null)', [targetId]);
    const [t] = await db.sql('select status, published_at from post_targets where id=$1', [targetId]);
    expect(t.status).toBe('published');
    expect(t.published_at).not.toBeNull();
    expect((await db.sql('select status from posts where id=$1', [postId]))[0].status).toBe('published');
  });

  it('associa id e link externos', async () => {
    await db.sql(`update post_targets set status='awaiting_user' where id=$1`, [targetId]);
    await asOwner('select mark_target_done($1, $2, $3)', [targetId, '7123', 'https://tiktok/7123']);
    const [t] = await db.sql('select external_post_id, permalink from post_targets where id=$1', [targetId]);
    expect(t).toEqual({ external_post_id: '7123', permalink: 'https://tiktok/7123' });
  });

  it('não marca destinos ainda a enviar', async () => {
    await db.sql(`update post_targets set status='uploading' where id=$1`, [targetId]);
    await expect(asOwner('select mark_target_done($1, null, null)', [targetId])).rejects.toThrow(/not_awaiting/);
  });

  it('outro utilizador não altera nada', async () => {
    await db.sql(`update post_targets set status='awaiting_user' where id=$1`, [targetId]);
    await expect(db.asUser(s.strangerId).sql('select mark_target_done($1, null, null)', [targetId])).rejects.toThrow(/not_found/);
  });
});
