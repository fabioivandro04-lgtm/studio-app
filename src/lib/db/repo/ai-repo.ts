import type { SupabaseClient } from '@supabase/supabase-js';
import type { HistoryPoint } from '@/lib/ai/best-time';
import { monthStartUtc } from '@/lib/ai/budget';
import type { AiUsage } from '@/lib/ai/types';

const DEFAULT_MODEL = 'anthropic/claude-sonnet-5.5';
const DEFAULT_LIMIT = 5;

const num = (v: unknown): number | null => (v == null ? null : Number(v));

interface MetricRow {
  collected_on: string;
  reach: number | null; views: number | null; profile_visits: number | null; follows: number | null;
  shares: number | null; saves: number | null; comments: number | null;
}

/** Destino publicado → ponto do histórico com a métrica mais recente; null sem dados. */
export function toHistoryPoint(row: { published_at: string | null; post_metrics: MetricRow[] }): HistoryPoint | null {
  if (!row.published_at || row.post_metrics.length === 0) return null;
  const m = [...row.post_metrics].sort((a, b) => String(b.collected_on).localeCompare(String(a.collected_on)))[0];
  return {
    publishedAt: new Date(row.published_at),
    reach: num(m.reach), views: num(m.views), profileVisits: num(m.profile_visits), follows: num(m.follows),
    shares: num(m.shares), saves: num(m.saves), comments: num(m.comments),
  };
}

export async function loadAiSettings(db: SupabaseClient): Promise<{ model: string; limitUsd: number }> {
  const { data } = await db.from('app_settings').select('ai_model, ai_monthly_limit_usd').maybeSingle();
  return { model: data?.ai_model ?? DEFAULT_MODEL, limitUsd: data ? Number(data.ai_monthly_limit_usd) : DEFAULT_LIMIT };
}

export async function monthSpend(db: SupabaseClient, now: Date): Promise<{ usd: number; requests: number }> {
  const { data, error } = await db.from('ai_usage').select('cost_usd').gte('created_at', monthStartUtc(now));
  if (error) throw new Error(`ai_usage: ${error.message}`);
  return { usd: (data ?? []).reduce((s, r) => s + Number(r.cost_usd), 0), requests: data?.length ?? 0 };
}

export async function insertUsage(db: SupabaseClient, u: { brandId: string | null; kind: string; model: string; usage: AiUsage }): Promise<void> {
  const { error } = await db.from('ai_usage').insert({
    brand_id: u.brandId, kind: u.kind, model: u.model,
    input_tokens: u.usage.inputTokens, output_tokens: u.usage.outputTokens, cost_usd: u.usage.costUsd,
  });
  if (error) throw new Error(`ai_usage: ${error.message}`);
}

/** Histórico de resultados da marca e horas já ocupadas (posts agendados), para a melhor hora. */
export async function bestTimeInputs(
  db: SupabaseClient,
  brandId: string,
  excludePostId: string | null,
  now: Date = new Date(),
): Promise<{ history: HistoryPoint[]; busy: Date[] }> {
  const [published, scheduled] = await Promise.all([
    db
      .from('post_targets')
      .select('published_at, posts!inner(brand_id), post_metrics(collected_on, reach, views, profile_visits, follows, shares, saves, comments)')
      .eq('status', 'published')
      .eq('posts.brand_id', brandId)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(200),
    db
      .from('posts')
      .select('id, scheduled_at')
      .eq('brand_id', brandId)
      .in('status', ['scheduled', 'publishing'])
      .gte('scheduled_at', new Date(now.getTime() - 3 * 3_600_000).toISOString())
      .lte('scheduled_at', new Date(now.getTime() + 9 * 86_400_000).toISOString()),
  ]);
  const history = ((published.data ?? []) as unknown as { published_at: string; post_metrics: MetricRow[] }[])
    .map(toHistoryPoint)
    .filter((p): p is HistoryPoint => !!p);
  const busy = (scheduled.data ?? []).filter((p) => p.id !== excludePostId && p.scheduled_at).map((p) => new Date(p.scheduled_at));
  return { history, busy };
}
