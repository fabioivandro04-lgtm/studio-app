/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import { bestBuckets } from '@/lib/ai/best-time';
import { bestTimeInputs } from '@/lib/db/repo/ai-repo';
import { fromAccountMetricsRow, type Brand } from '@/lib/db/types';
import { followersGained, type MetricRow } from '@/lib/metrics/summary';
import type { Platform } from '@/lib/platforms/types';
import { metricsReport, type MetricsReport } from './insights';

/** Métricas da marca nos últimos `days` dias (as mesmas contas da página Métricas). */
export async function loadMetrics(db: SupabaseClient, brand: Brand, days: number, now: Date): Promise<MetricsReport> {
  const from = new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  const [{ data: pm, error }, { data: am }, { data: accts }, inputs] = await Promise.all([
    db.from('post_metrics')
      .select('post_target_id, collected_on, views, reach, likes, comments, shares, saves, watch_time_s, post_targets!inner(permalink, social_accounts!inner(platform, brand_id), posts!inner(internal_title, brand_id))')
      .gte('collected_on', from),
    db.from('account_metrics').select('social_account_id, collected_on, followers, views').gte('collected_on', from),
    db.from('social_accounts').select('id, brand_id').eq('brand_id', brand.id),
    bestTimeInputs(db, brand.id, null, now),
  ]);
  if (error) throw new Error(`post_metrics: ${error.message}`);
  const mine = ((pm ?? []) as any[]).filter((r) => r.post_targets?.posts?.brand_id === brand.id);
  const rows: MetricRow[] = mine.map((r) => ({
    targetId: r.post_target_id, platform: r.post_targets.social_accounts.platform as Platform, collectedOn: String(r.collected_on).slice(0, 10),
    views: r.views == null ? null : Number(r.views), reach: r.reach == null ? null : Number(r.reach), likes: r.likes == null ? null : Number(r.likes),
    comments: r.comments == null ? null : Number(r.comments), shares: r.shares == null ? null : Number(r.shares), saves: r.saves == null ? null : Number(r.saves),
    watchTimeS: r.watch_time_s == null ? null : Number(r.watch_time_s),
  }));
  const info = new Map(mine.map((r) => [r.post_target_id as string, { title: r.post_targets.posts.internal_title as string, link: (r.post_targets.permalink as string) ?? null }]));
  const ids = new Set((accts ?? []).map((a) => a.id));
  const accountRows = (am ?? []).map(fromAccountMetricsRow).filter((r) => ids.has(r.socialAccountId));
  return metricsReport({ rows, info, from, to, followersGained: followersGained(accountRows), best: bestBuckets(inputs.history, brand.goal, brand.timezone).best });
}
