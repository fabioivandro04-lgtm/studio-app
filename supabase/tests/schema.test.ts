import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seed, startTestDb, type TestDb } from './db';

let db: TestDb;
beforeAll(async () => {
  db = await startTestDb();
});
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.sql('truncate brands, app_owner, auth.users cascade');
});

async function makePost(s: Awaited<ReturnType<typeof seed>>, format = 'ig_image') {
  const [post] = await db.sql(
    `insert into posts(brand_id, internal_title, scheduled_at, status) values ($1,'t',now(),'scheduled') returning *`,
    [s.brand.id],
  );
  await db.sql(`insert into post_media(post_id, media_id, position) values ($1,$2,0)`, [post.id, s.media.id]);
  const [target] = await db.sql(
    `insert into post_targets(post_id, social_account_id, format, caption) values ($1,$2,$3,'olá') returning *`,
    [post.id, s.account.id, format],
  );
  return { post, target };
}

describe('esquema', () => {
  it('cria uma marca com fuso padrão Africa/Maputo', async () => {
    const [b] = await db.sql(`insert into brands(name,color) values('Unidreamity','#0B1F45') returning timezone`);
    expect(b.timezone).toBe('Africa/Maputo');
  });

  it('destino começa pending com 0 tentativas', async () => {
    const s = await seed(db);
    const { target } = await makePost(s);
    expect(target.status).toBe('pending');
    expect(target.attempts).toBe(0);
    expect(target.progress).toEqual({});
  });

  it('impede apagar mídia usada num post', async () => {
    const s = await seed(db);
    await makePost(s);
    await expect(db.sql(`delete from media_assets where id=$1`, [s.media.id])).rejects.toThrow(/foreign key/);
  });

  it('impede apagar conta com destinos', async () => {
    const s = await seed(db);
    await makePost(s);
    await expect(db.sql(`delete from social_accounts where id=$1`, [s.account.id])).rejects.toThrow(/foreign key/);
  });

  it('apagar post apaga os seus destinos e post_media', async () => {
    const s = await seed(db);
    const { post } = await makePost(s);
    await db.sql(`delete from posts where id=$1`, [post.id]);
    expect(await db.sql(`select * from post_targets`)).toHaveLength(0);
    expect(await db.sql(`select * from post_media`)).toHaveLength(0);
  });

  it('rejeita formato incompatível com a plataforma da conta', async () => {
    const s = await seed(db, { platform: 'tiktok' });
    await expect(makePost(s, 'ig_reel')).rejects.toThrow(/formato/);
  });

  it('aceita formato da plataforma certa', async () => {
    const s = await seed(db, { platform: 'tiktok' });
    const { target } = await makePost(s, 'tiktok_video');
    expect(target.format).toBe('tiktok_video');
  });

  it('não permite duas contas iguais na mesma marca', async () => {
    const s = await seed(db);
    await expect(
      db.sql(
        `insert into social_accounts(brand_id,platform,external_id,handle,display_name,access_token_enc)
         values ($1,'instagram','ext1','@uni','Uni','v1.x.y')`,
        [s.brand.id],
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it('métricas: uma linha por destino e dia', async () => {
    const s = await seed(db);
    const { target } = await makePost(s);
    await db.sql(`insert into post_metrics(post_target_id, collected_on, views) values ($1,'2026-10-15',1)`, [target.id]);
    await expect(
      db.sql(`insert into post_metrics(post_target_id, collected_on, views) values ($1,'2026-10-15',2)`, [target.id]),
    ).rejects.toThrow(/duplicate key/);
  });
});
