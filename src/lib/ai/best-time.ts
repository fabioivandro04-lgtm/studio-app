import { localToUtc, utcToLocalParts } from '@/lib/time/zone';
import type { Goal } from './types';

export interface HistoryPoint {
  publishedAt: Date;
  reach: number | null;
  views: number | null;
  profileVisits: number | null;
  follows: number | null;
  shares: number | null;
  saves: number | null;
  comments: number | null;
}

export interface Slot {
  date: string;
  time: string;
  reason: string;
  source: 'history' | 'initial';
}

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MIN_HISTORY = 10;
const MIN_PER_BUCKET = 2;
const LEAD_MS = 3_600_000; // ≥ 1 h a partir de agora
const GAP_MS = 2 * 3_600_000; // ≥ 2 h de outros posts
const DAYS_AHEAD = 7;

const weekdays = (times: string[]) => ({ 1: times, 2: times, 3: times, 4: times, 5: times });
/** Horas locais de maior atividade do público (estudantes e jovens adultos de MZ/AO/CV). Chave: 0 = domingo. */
export const INITIAL_TIMES: Record<Goal, Record<number, string[]>> = {
  contacts: { ...weekdays(['12:30', '19:00', '20:30']), 6: ['11:00', '18:00'], 0: ['17:00', '19:00'] },
  reach: { ...weekdays(['12:30', '19:00', '20:30', '21:00']), 6: ['11:00', '18:00', '21:00'], 0: ['17:00', '19:00', '21:00'] },
};

const n = (v: number | null) => v ?? 0;

export function scorePoint(p: HistoryPoint, goal: Goal): number {
  if (goal === 'reach') return p.reach ?? p.views ?? 0;
  return n(p.profileVisits) + n(p.follows) * 3 + n(p.shares) * 2 + n(p.saves) * 2 + n(p.comments);
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

interface Candidate { date: string; time: string; at: Date; reason: string; source: Slot['source'] }

/** Próximos dias locais (hoje + 7) no fuso da marca. */
function nextLocalDates(now: Date, tz: string): string[] {
  const today = utcToLocalParts(now, tz).date;
  return Array.from({ length: DAYS_AHEAD + 1 }, (_, i) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function suggestSlots(o: { history: HistoryPoint[]; goal: Goal; tz: string; busy: Date[]; now: Date }): Slot[] {
  const dates = nextLocalDates(o.now, o.tz);
  const ok = (at: Date) =>
    at.getTime() >= o.now.getTime() + LEAD_MS && o.busy.every((b) => Math.abs(b.getTime() - at.getTime()) >= GAP_MS);
  const label = o.goal === 'contacts' ? 'contactos' : 'alcance';

  const ranked: Candidate[] = [];
  if (o.history.length >= MIN_HISTORY) {
    const scores = o.history.map((p) => scorePoint(p, o.goal));
    const overall = median(scores);
    const buckets = new Map<string, { weekday: number; hour: number; scores: number[] }>();
    o.history.forEach((p, i) => {
      const local = utcToLocalParts(p.publishedAt, o.tz);
      const weekday = weekdayOf(local.date);
      const hour = Number(local.time.slice(0, 2));
      const key = `${weekday}-${hour}`;
      const b = buckets.get(key) ?? { weekday, hour, scores: [] };
      b.scores.push(scores[i]);
      buckets.set(key, b);
    });
    const best = [...buckets.values()]
      .filter((b) => b.scores.length >= MIN_PER_BUCKET)
      .map((b) => ({ ...b, median: median(b.scores) }))
      .sort((a, b) => b.median - a.median || b.scores.length - a.scores.length);
    for (const b of best) {
      const time = `${String(b.hour).padStart(2, '0')}:00`;
      const ratio = overall > 0 ? b.median / overall : 0;
      const reason =
        ratio > 1.1
          ? `Os teus posts de ${WEEKDAYS[b.weekday]} às ${time} tiveram ${ratio.toLocaleString('pt-PT', { maximumFractionDigits: 1 })}× mais ${label}`
          : `Uma das horas com melhores resultados dos teus posts (${WEEKDAYS[b.weekday]} às ${time})`;
      for (const date of dates.filter((d) => weekdayOf(d) === b.weekday)) {
        ranked.push({ date, time, at: localToUtc(date, time, o.tz), reason, source: 'history' });
      }
    }
  }
  for (const date of dates) {
    for (const time of INITIAL_TIMES[o.goal][weekdayOf(date)] ?? []) {
      ranked.push({ date, time, at: localToUtc(date, time, o.tz), reason: 'Sugestão inicial: hora de maior atividade do público', source: 'initial' });
    }
  }

  const valid = ranked.filter((c) => ok(c.at));
  const picked: Candidate[] = [];
  const has = (c: Candidate) => picked.some((p) => p.date === c.date && p.time === c.time);
  for (const c of valid) if (picked.length < 3 && !has(c) && !picked.some((p) => p.date === c.date)) picked.push(c);
  for (const c of valid) if (picked.length < 3 && !has(c)) picked.push(c);
  return picked.map(({ date, time, reason, source }) => ({ date, time, reason, source }));
}
