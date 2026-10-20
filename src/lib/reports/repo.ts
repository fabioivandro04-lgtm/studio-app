import type { SupabaseClient } from '@supabase/supabase-js';
import { listAdAccounts, loadAdInsights } from '@/lib/ads/repo';
import type { WeekFacts, WeeklyReport } from '@/lib/ai/report-prompts';
import type { Brand } from '@/lib/db/types';
import { fromAccountMetricsRow } from '@/lib/db/types';
import { followersGained } from '@/lib/metrics/summary';
import type { Platform } from '@/lib/platforms/types';
import { formatInZone, localToUtc } from '@/lib/time/zone';
import { buildWeekFacts, shiftDays, type PublishedTarget } from './week';

export interface StoredReport {
  weekStart: string;
  facts: WeekFacts;
  report: WeeklyReport;
  createdAt: Date;
}

export async function loadReport(db: SupabaseClient, brandId: string, weekStart: string): Promise<StoredReport | null> {
  const { data } = await db.from('weekly_reports').select('week_start, facts, report, created_at').eq('brand_id', brandId).eq('week_start', weekStart).maybeSingle();
  return data ? { weekStart: data.week_start, facts: data.facts, report: data.report, createdAt: new Date(data.created_at) } : null;
}

export async function saveReport(db: SupabaseClient, brandId: string, facts: WeekFacts, report: WeeklyReport): Promise<void> {
  const { error } = await db.from('weekly_reports').upsert(
    { brand_id: brandId, week_start: facts.weekStart, facts, report, created_at: new Date().toISOString() },
    { onConflict: 'brand_id,week_start' },
  );
  if (error) throw new Error(`weekly_reports: ${error.message}`);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const latest = (rows: any[]) => [...rows].sort((a, b) => String(b.collected_on).localeCompare(String(a.collected_on)))[0] ?? {};

/** Lê os números da semana (e da anterior, para comparar) da base de dados e dos anúncios. */
export async function collectWeekFacts(db: SupabaseClient, brand: Brand, weekStart: string, weekEnd: string): Promise<WeekFacts> {
  const tz = brand.timezone;
  const from = localToUtc(shiftDays(weekStart, -7), '00:00', tz).toISOString();
  const to = localToUtc(shiftDays(weekEnd, 1), '00:00', tz).toISOString();
  const nextTo = localToUtc(shiftDays(weekEnd, 8), '00:00', tz).toISOString();

  const [{ data: published }, { data: am }, { count: scheduled }, adAccounts] = await Promise.all([
    db.from('post_targets')
      .select('published_at, posts!inner(brand_id, internal_title), social_accounts!inner(platform), post_metrics(collected_on, views, reach, likes, comments, shares, saves)')
      .eq('posts.brand_id', brand.id)
      .gte('published_at', from)
      .lt('published_at', to),
    db.from('account_metrics')
      .select('social_account_id, collected_on, followers, views, social_accounts!inner(brand_id)')
      .eq('social_accounts.brand_id', brand.id)
      .gte('collected_on', weekStart)
      .lte('collected_on', weekEnd),
    db.from('posts').select('id', { count: 'exact', head: true }).eq('brand_id', brand.id).eq('status', 'scheduled').gte('scheduled_at', to).lt('scheduled_at', nextTo),
    listAdAccounts(db, brand.id),
  ]);

  const targets: PublishedTarget[] = ((published ?? []) as any[]).map((r) => {
    const m = latest(r.post_metrics ?? []);
    return {
      title: r.posts.internal_title ?? '', platform: r.social_accounts.platform as Platform,
      publishedOn: formatInZone(new Date(r.published_at), tz, 'yyyy-MM-dd'),
      views: m.views ?? null, reach: m.reach ?? null, likes: m.likes ?? null, comments: m.comments ?? null, shares: m.shares ?? null, saves: m.saves ?? null,
    };
  });
  const accountRows = (am ?? []).map(fromAccountMetricsRow);
  const ads = await Promise.all(adAccounts.map(async (a) => {
    const r = await loadAdInsights(db, a.id, weekStart, weekEnd);
    return r.ok ? [{ ...r.insights.totals, currency: a.currency }] : [];
  }));

  return buildWeekFacts({
    weekStart, weekEnd, targets,
    followersGained: accountRows.some((r) => r.followers != null) ? followersGained(accountRows) : null,
    ads: ads.flat(),
    scheduledNextWeek: scheduled ?? 0,
  });
}
