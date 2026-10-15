import type { AccountMetricsRow } from '@/lib/db/types';
import type { Platform } from '@/lib/platforms/types';

export interface MetricRow {
  targetId: string;
  platform: Platform;
  collectedOn: string;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  watchTimeS: number | null;
}

const KEYS = ['views', 'reach', 'likes', 'comments', 'shares', 'saves'] as const;
export type Totals = Record<(typeof KEYS)[number], number>;
const zero = (): Totals => ({ views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0 });

/**
 * As redes devolvem valores acumulados, por isso usa-se a última linha de cada destino no período
 * (nunca a soma dos dias). Nulos contam como 0.
 */
export function summarize(rows: MetricRow[], from: string, to: string) {
  const latestPerTarget = new Map<string, MetricRow>();
  for (const r of rows) {
    if (r.collectedOn < from || r.collectedOn > to) continue;
    const prev = latestPerTarget.get(r.targetId);
    if (!prev || r.collectedOn > prev.collectedOn) latestPerTarget.set(r.targetId, r);
  }
  const totals = zero();
  const byPlatform: Record<Platform, Totals> = { instagram: zero(), tiktok: zero(), youtube: zero() };
  for (const r of latestPerTarget.values()) {
    for (const k of KEYS) {
      totals[k] += r[k] ?? 0;
      byPlatform[r.platform][k] += r[k] ?? 0;
    }
  }
  return { totals, byPlatform, latestPerTarget };
}

export function followerSeries(rows: AccountMetricsRow[]): Array<{ day: string } & Record<string, number | string>> {
  const byDay = new Map<string, { day: string } & Record<string, number | string>>();
  for (const r of [...rows].sort((a, b) => a.collectedOn.localeCompare(b.collectedOn))) {
    if (r.followers == null) continue;
    const entry = byDay.get(r.collectedOn) ?? { day: r.collectedOn };
    entry[r.socialAccountId] = r.followers;
    byDay.set(r.collectedOn, entry);
  }
  return [...byDay.values()];
}

/** Soma, por conta, da diferença entre o último e o primeiro número de seguidores no período. */
export function followersGained(rows: AccountMetricsRow[]): number {
  const first = new Map<string, AccountMetricsRow>();
  const last = new Map<string, AccountMetricsRow>();
  for (const r of rows) {
    if (r.followers == null) continue;
    const f = first.get(r.socialAccountId);
    if (!f || r.collectedOn < f.collectedOn) first.set(r.socialAccountId, r);
    const l = last.get(r.socialAccountId);
    if (!l || r.collectedOn > l.collectedOn) last.set(r.socialAccountId, r);
  }
  let total = 0;
  for (const [id, l] of last) total += (l.followers ?? 0) - (first.get(id)?.followers ?? 0);
  return total;
}
