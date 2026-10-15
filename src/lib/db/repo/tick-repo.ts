import type { SupabaseClient } from '@supabase/supabase-js';
import { encryptToken } from '@/lib/crypto/tokens';
import type { MediaInfo, TokenSet } from '@/lib/platforms/types';
import type { ClaimedTarget, LogEntry, TargetPatch, TickRepo } from '@/lib/publishing/tick';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export function toMediaInfo(m: Row): MediaInfo {
  return {
    id: m.id, kind: m.kind, mime: m.mime, sizeBytes: Number(m.size_bytes), width: m.width ?? null,
    height: m.height ?? null, durationS: m.duration_s == null ? null : Number(m.duration_s), storagePath: m.storage_path,
  };
}

export function toClaimedTarget(t: Row, post: Row, account: Row, postMedia: Row[]): ClaimedTarget {
  const media = [...postMedia].sort((a, b) => a.position - b.position).map((pm) => toMediaInfo(pm.media));
  return {
    brandId: post.brand_id,
    target: {
      id: t.id, postId: t.post_id, platform: account.platform, status: t.status, attempts: t.attempts,
      format: t.format, caption: t.caption, title: t.title ?? null, options: t.options ?? {}, progress: t.progress ?? {}, media,
    },
    account: {
      id: account.id, externalId: account.external_id, accessTokenEnc: account.access_token_enc,
      refreshTokenEnc: account.refresh_token_enc ?? null,
      tokenExpiresAt: account.token_expires_at ? new Date(account.token_expires_at) : null,
    },
  };
}

const iso = (d: Date | null | undefined) => (d == null ? d : d.toISOString());

export function targetPatchToRow(p: TargetPatch): Row {
  const map: Array<[keyof TargetPatch, string, (v: any) => any]> = [
    ['status', 'status', (v) => v],
    ['progress', 'progress', (v) => v],
    ['attempts', 'attempts', (v) => v],
    ['nextAttemptAt', 'next_attempt_at', iso],
    ['externalPostId', 'external_post_id', (v) => v],
    ['permalink', 'permalink', (v) => v],
    ['lastError', 'last_error', (v) => v],
    ['publishedAt', 'published_at', iso],
    ['lockedUntil', 'locked_until', iso],
  ];
  const row: Row = {};
  for (const [k, col, f] of map) if (k in p) row[col] = f(p[k]);
  return row;
}

function check(res: { data: unknown; error: { message: string } | null }, what: string): any {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data ?? [];
}

export function tokenColumns(tokens: TokenSet, key: string): Row {
  return {
    access_token_enc: encryptToken(tokens.accessToken, key),
    refresh_token_enc: tokens.refreshToken ? encryptToken(tokens.refreshToken, key) : null,
    token_expires_at: iso(tokens.expiresAt),
    refresh_expires_at: iso(tokens.refreshExpiresAt),
    token_updated_at: new Date().toISOString(),
    scopes: tokens.scopes,
  };
}

/** Repositório do motor de publicação. Usa o cliente de serviço. */
export function createTickRepo(db: SupabaseClient, tokenKey: string): TickRepo {
  return {
    async claimDueTargets(limit) {
      const targets: Row[] = check(await db.rpc('claim_due_targets', { p_limit: limit }), 'claim_due_targets');
      if (targets.length === 0) return [];
      const postIds = [...new Set(targets.map((t) => t.post_id))];
      const accountIds = [...new Set(targets.map((t) => t.social_account_id))];
      const posts: Row[] = check(await db.from('posts').select('id, brand_id').in('id', postIds), 'posts');
      const accounts: Row[] = check(
        await db.from('social_accounts').select('id, platform, external_id, access_token_enc, refresh_token_enc, token_expires_at').in('id', accountIds),
        'social_accounts',
      );
      const pm: Row[] = check(
        await db.from('post_media').select('post_id, position, media:media_assets(id, kind, mime, size_bytes, width, height, duration_s, storage_path)').in('post_id', postIds),
        'post_media',
      );
      return targets.map((t) =>
        toClaimedTarget(
          t,
          posts.find((p) => p.id === t.post_id)!,
          accounts.find((a) => a.id === t.social_account_id)!,
          pm.filter((m) => m.post_id === t.post_id),
        ),
      );
    },
    async saveTarget(id, patch) {
      check(await db.from('post_targets').update(targetPatchToRow(patch)).eq('id', id), 'saveTarget');
    },
    async refreshPostStatus(postId) {
      check(await db.rpc('refresh_post_status', { p_post_id: postId }), 'refresh_post_status');
    },
    async markAccountNeedsReauth(accountId, message) {
      check(await db.from('social_accounts').update({ status: 'needs_reauth', status_message: message }).eq('id', accountId), 'needs_reauth');
    },
    async saveAccountTokens(accountId, tokens) {
      check(
        await db.from('social_accounts').update({ ...tokenColumns(tokens, tokenKey), status: 'active', status_message: null }).eq('id', accountId),
        'saveAccountTokens',
      );
    },
    async usageToday(accountId, kind) {
      const day = new Date().toISOString().slice(0, 10);
      const rows: Row[] = check(
        await db.from('api_usage').select('count').eq('social_account_id', accountId).eq('kind', kind).eq('day', day),
        'api_usage',
      );
      return rows.length ? Number(rows[0].count) : 0;
    },
    async recordUsage(accountId, kind, units) {
      check(await db.rpc('record_api_usage', { p_account: accountId, p_kind: kind, p_units: units }), 'record_api_usage');
    },
    async log(e: LogEntry) {
      const res = await db.from('activity_log').insert({
        brand_id: e.brandId ?? null, level: e.level, source: e.source, message: e.message, context: e.context ?? null,
      });
      if (res.error) console.error('[log]', res.error.message, e);
    },
  };
}

/** Contas ativas com tokens, para os jobs diários (tokens e métricas). */
export async function listActiveAccounts(db: SupabaseClient) {
  const rows: Row[] = check(
    await db
      .from('social_accounts')
      .select('id, brand_id, platform, external_id, access_token_enc, refresh_token_enc, token_expires_at, token_updated_at')
      .eq('status', 'active'),
    'social_accounts',
  );
  return rows.map((a) => ({
    id: a.id as string,
    brandId: a.brand_id as string,
    platform: a.platform,
    externalId: a.external_id as string,
    accessTokenEnc: a.access_token_enc as string,
    refreshTokenEnc: (a.refresh_token_enc ?? null) as string | null,
    tokenExpiresAt: a.token_expires_at ? new Date(a.token_expires_at) : null,
    tokenUpdatedAt: new Date(a.token_updated_at),
  }));
}
