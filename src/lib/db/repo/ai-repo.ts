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

/** Destino publicado → ponto do histórico com o último valor conhecido de cada métrica; null sem dados. */
export function toHistoryPoint(row: { published_at: string | null; post_metrics: MetricRow[] }): HistoryPoint | null {
  if (!row.published_at || row.post_metrics.length === 0) return null;
  const rows = [...row.post_metrics].sort((a, b) => String(b.collected_on).localeCompare(String(a.collected_on)));
  const latest = (k: keyof Omit<MetricRow, 'collected_on'>) => num(rows.find((r) => r[k] != null)?.[k] ?? null);
  return {
    publishedAt: new Date(row.published_at),
    reach: latest('reach'), views: latest('views'), profileVisits: latest('profile_visits'), follows: latest('follows'),
    shares: latest('shares'), saves: latest('saves'), comments: latest('comments'),
  };
}

const FIELDS = ['reach', 'views', 'profileVisits', 'follows', 'shares', 'saves', 'comments'] as const;

/** Um ponto por post (soma os destinos de várias redes); assim um post em 3 redes conta uma vez. */
export function toHistoryPoints(rows: { post_id: string; published_at: string | null; post_metrics: MetricRow[] }[]): HistoryPoint[] {
  const byPost = new Map<string, HistoryPoint>();
  for (const r of rows) {
    const p = toHistoryPoint(r);
    if (!p) continue;
    const prev = byPost.get(r.post_id);
    if (!prev) {
      byPost.set(r.post_id, p);
      continue;
    }
    const merged: HistoryPoint = { ...prev, publishedAt: p.publishedAt < prev.publishedAt ? p.publishedAt : prev.publishedAt };
    for (const f of FIELDS) merged[f] = prev[f] == null && p[f] == null ? null : (prev[f] ?? 0) + (p[f] ?? 0);
    byPost.set(r.post_id, merged);
  }
  return [...byPost.values()];
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
      .select('post_id, published_at, posts!inner(brand_id), post_metrics(collected_on, reach, views, profile_visits, follows, shares, saves, comments)')
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
  const history = toHistoryPoints((published.data ?? []) as unknown as { post_id: string; published_at: string; post_metrics: MetricRow[] }[]);
  const busy = (scheduled.data ?? []).filter((p) => p.id !== excludePostId && p.scheduled_at).map((p) => new Date(p.scheduled_at));
  return { history, busy };
}

/** Momentos ocupados da marca em [from, to): posts não cancelados com data (rascunhos incluídos) e, se pedido, ideias novas com data. */
export async function busyTimes(db: SupabaseClient, brandId: string, from: Date, to: Date, o: { excludePostId?: string | null; includeIdeas?: boolean } = {}): Promise<Date[]> {
  const [posts, ideas] = await Promise.all([
    db.from('posts').select('id, scheduled_at').eq('brand_id', brandId).neq('status', 'cancelled').gte('scheduled_at', from.toISOString()).lt('scheduled_at', to.toISOString()),
    o.includeIdeas
      ? db.from('ideas').select('suggested_at').eq('brand_id', brandId).eq('status', 'new').gte('suggested_at', from.toISOString()).lt('suggested_at', to.toISOString())
      : Promise.resolve({ data: [] as { suggested_at: string }[] }),
  ]);
  return [
    ...(posts.data ?? []).filter((p) => p.id !== o.excludePostId && p.scheduled_at).map((p) => new Date(p.scheduled_at as string)),
    ...(ideas.data ?? []).map((i) => new Date(i.suggested_at)),
  ];
}
