import { execFileSync, spawnSync } from 'node:child_process';
import { chownSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';

const BIN = '/usr/lib/postgresql/16/bin';
const ROOT = path.resolve(__dirname, '..');

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Row = Record<string, any>;
export type Sql = (q: string, params?: unknown[]) => Promise<Row[]>;

export interface TestDb {
  sql: Sql;
  asUser(uid: string | null, o?: { clientId?: string }): { sql: Sql };
  connect(): Promise<pg.Client>;
  stop(): Promise<void>;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

function asPostgres(cmd: string, args: string[]) {
  const isRoot = process.getuid?.() === 0;
  const r = isRoot
    ? spawnSync('runuser', ['-u', 'postgres', '--', cmd, ...args], { encoding: 'utf8' })
    : spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} falhou: ${r.stderr || r.stdout}`);
}

export async function startTestDb(): Promise<TestDb> {
  const dir = mkdtempSync(path.join(tmpdir(), 'estudio-pg-'));
  if (process.getuid?.() === 0) execFileSync('chown', ['postgres', dir]);
  else chownSync(dir, process.getuid!(), process.getgid!());
  const data = path.join(dir, 'data');
  const port = await freePort();
  asPostgres(`${BIN}/initdb`, ['-D', data, '-A', 'trust', '-U', 'postgres']);
  asPostgres(`${BIN}/pg_ctl`, ['-D', data, '-w', '-l', path.join(dir, 'log'), '-o', `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1 -c fsync=off`, 'start']);

  const config = { host: '127.0.0.1', port, user: 'postgres', database: 'postgres' };
  const admin = new pg.Client(config);
  await admin.connect();
  await admin.query(readFileSync(path.join(ROOT, 'tests/bootstrap.sql'), 'utf8'));
  const migrations = readdirSync(path.join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
  for (const f of migrations) {
    try {
      await admin.query(readFileSync(path.join(ROOT, 'migrations', f), 'utf8'));
    } catch (e) {
      throw new Error(`Migração ${f}: ${(e as Error).message}`);
    }
  }

  const sql: Sql = async (q, params) => (await admin.query(q, params as unknown[])).rows;

  const asUser = (uid: string | null, o: { clientId?: string } = {}) => ({
    sql: (async (q, params) => {
      await admin.query('begin');
      try {
        await admin.query(uid ? 'set local role authenticated' : 'set local role anon');
        await admin.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? '']);
        const claims = uid ? { sub: uid, role: 'authenticated', ...(o.clientId ? { client_id: o.clientId } : {}) } : {};
        await admin.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
        const res = await admin.query(q, params as unknown[]);
        await admin.query('commit');
        return res.rows;
      } catch (e) {
        await admin.query('rollback');
        throw e;
      }
    }) as Sql,
  });

  const clients: pg.Client[] = [];
  const connect = async () => {
    const c = new pg.Client(config);
    await c.connect();
    clients.push(c);
    return c;
  };

  const stop = async () => {
    for (const c of clients) await c.end().catch(() => {});
    await admin.end().catch(() => {});
    asPostgres(`${BIN}/pg_ctl`, ['-D', data, '-m', 'immediate', 'stop']);
    rmSync(dir, { recursive: true, force: true });
  };

  return { sql, asUser, connect, stop };
}

/** Cria dados mínimos: dono, marca, conta, mídia, post e destino. */
export async function seed(db: TestDb, opts: { platform?: 'instagram' | 'tiktok' | 'youtube' } = {}) {
  const ownerId = '00000000-0000-0000-0000-00000000000a';
  const strangerId = '00000000-0000-0000-0000-00000000000b';
  await db.sql(`insert into auth.users(id,email) values ($1,'dono@x.pt'),($2,'outro@x.pt') on conflict do nothing`, [ownerId, strangerId]);
  await db.sql(`insert into app_owner(user_id) values ($1) on conflict do nothing`, [ownerId]);
  const [brand] = await db.sql(`insert into brands(name,color) values('Unidreamity','#0B1F45') returning *`);
  const platform = opts.platform ?? 'instagram';
  const [account] = await db.sql(
    `insert into social_accounts(brand_id,platform,external_id,handle,display_name,access_token_enc,status)
     values ($1,$2,'ext1','@uni','Uni','v1.x.y','active') returning *`,
    [brand.id, platform],
  );
  const [media] = await db.sql(
    `insert into media_assets(brand_id,storage_path,kind,mime,size_bytes,width,height)
     values ($1,'b/1.jpg','image','image/jpeg',1000,1080,1350) returning *`,
    [brand.id],
  );
  return { ownerId, strangerId, brand, account, media };
}
