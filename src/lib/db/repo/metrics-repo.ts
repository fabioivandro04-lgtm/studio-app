import type { SupabaseClient } from '@supabase/supabase-js';
import type { MetricsRepo } from '@/lib/metrics/sync';
import { createTickRepo, listActiveAccounts } from './tick-repo';

/* eslint-disable @typescript-eslint/no-explicit-any */
function check(res: { data: unknown; error: { message: string } | null }, what: string): any {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data ?? [];
}

export function createMetricsRepo(db: SupabaseClient, tokenKey: string): MetricsRepo {
  const tick = createTickRepo(db, tokenKey);
  return {
    listActiveAccounts: () => listActiveAccounts(db),
    async listTargetsForMetrics(accountId, since) {
      const rows: any[] = check(
        await db
          .from('post_targets')
          .select('id, external_post_id, status, published_at, updated_at')
          .eq('social_account_id', accountId)
          .in('status', ['published', 'awaiting_user'])
          .not('external_post_id', 'is', null),
        'listTargetsForMetrics',
      );
      return rows
        .filter((r) => new Date(r.published_at ?? r.updated_at) >= since)
        .map((r) => ({ targetId: r.id, externalPostId: r.external_post_id, status: r.status }));
    },
    async listUnmatchedTikTok(accountId) {
      const rows: any[] = check(
        await db
          .from('post_targets')
          .select('id, progress, updated_at')
          .eq('social_account_id', accountId)
          .in('status', ['awaiting_user', 'published'])
          .is('external_post_id', null),
        'listUnmatchedTikTok',
      );
      return rows.map((r) => ({ targetId: r.id, uploadedAt: new Date(r.progress?.uploadedAt ?? r.updated_at) }));
    },
    async linkedExternalIds(accountId) {
      const rows: any[] = check(
        await db.from('post_targets').select('external_post_id').eq('social_account_id', accountId).not('external_post_id', 'is', null),
        'linkedExternalIds',
      );
      return new Set(rows.map((r) => r.external_post_id as string));
    },
    async upsertAccountMetrics(accountId, day, m) {
      check(
        await db.from('account_metrics').upsert(
          { social_account_id: accountId, collected_on: day, followers: m.followers, views: m.views, raw: m.raw ?? null },
          { onConflict: 'social_account_id,collected_on' },
        ),
        'account_metrics',
      );
    },
    async upsertPostMetrics(targetId, day, m) {
      check(
        await db.from('post_metrics').upsert(
          {
            post_target_id: targetId, collected_on: day, views: m.views, reach: m.reach, likes: m.likes, comments: m.comments,
            shares: m.shares, saves: m.saves, watch_time_s: m.watchTimeS, raw: m.raw ?? null,
            profile_visits: m.profileVisits ?? null, follows: m.follows ?? null,
          },
          { onConflict: 'post_target_id,collected_on' },
        ),
        'post_metrics',
      );
    },
    async markPublished(targetId, externalId, permalink) {
      const patch: Record<string, unknown> = { status: 'published', external_post_id: externalId, last_error: null };
      if (permalink) patch.permalink = permalink;
      const rows: any[] = check(
        await db.from('post_targets').update(patch).eq('id', targetId).select('post_id, published_at'),
        'markPublished',
      );
      if (rows[0] && !rows[0].published_at) {
        check(await db.from('post_targets').update({ published_at: new Date().toISOString() }).eq('id', targetId), 'published_at');
      }
      if (rows[0]) await tick.refreshPostStatus(rows[0].post_id);
    },
    markAccountNeedsReauth: tick.markAccountNeedsReauth,
    saveAccountTokens: tick.saveAccountTokens,
    log: tick.log,
  };
}
