import { freeSlotsInRange, type PostingSlot } from '@/lib/schedule/slots';
import { localToUtc, utcToLocalParts } from '@/lib/time/zone';
import { bestBuckets, INITIAL_TIMES, weekdayOf, type HistoryPoint } from './best-time';
import type { Goal } from './types';

export const DEADLINE_OFFSETS = [-28, -21, -14, -7, 0];
const LEAD_MS = 3_600_000;
const GAP_MS = 2 * 3_600_000;
const TARGET_MIN = 19 * 60;

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Datas da sequência até ao prazo (só a partir de hoje); [] se o prazo já passou. */
export function deadlineDates(dueDate: string, today: string): string[] {
  if (dueDate < today) return [];
  return DEADLINE_OFFSETS.map((o) => addDays(dueDate, o)).filter((d) => d >= today);
}

/** Segunda a domingo da próxima semana (a segunda estritamente depois de hoje), no fuso da marca. */
export function nextWeekRange(now: Date, tz: string): { start: string; end: string } {
  const today = utcToLocalParts(now, tz).date;
  const wd = weekdayOf(today); // 0 = domingo
  const start = addDays(today, wd === 0 ? 1 : 8 - wd);
  return { start, end: addDays(start, 6) };
}

/** Espalha n posts pela semana: dia floor(i*7/n) a contar da segunda. */
export function spreadWeek(start: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(start, Math.floor((i * 7) / n)));
}

export function missingForWeek(postsPerWeek: number, alreadyPlanned: number): number {
  return Math.max(0, postsPerWeek - alreadyPlanned);
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Hora para um dia: melhor faixa do histórico nesse dia, senão a hora inicial mais perto das 19:00; evita ocupados. */
export function timeForDate(o: { date: string; goal: Goal; tz: string; history: HistoryPoint[]; busy: Date[]; now: Date; slots?: PostingSlot[] }): string {
  const wd = weekdayOf(o.date);
  // Horários fixos da marca primeiro: o livre desse dia mais próximo das 19:00.
  const fixed = freeSlotsInRange({ slots: o.slots ?? [], tz: o.tz, busy: o.busy, now: o.now, from: o.date, to: o.date })
    .map((s) => s.time)
    .sort((a, b) => Math.abs(toMin(a) - TARGET_MIN) - Math.abs(toMin(b) - TARGET_MIN));
  if (fixed.length) return fixed[0];
  const fromHistory = bestBuckets(o.history, o.goal, o.tz)
    .best.filter((b) => b.weekday === wd)
    .map((b) => `${String(b.hour).padStart(2, '0')}:00`);
  const initial = [...(INITIAL_TIMES[o.goal][wd] ?? ['19:00'])].sort((a, b) => Math.abs(toMin(a) - TARGET_MIN) - Math.abs(toMin(b) - TARGET_MIN));
  const candidates = [...new Set([...fromHistory, ...initial])];
  const ok = (t: string) => {
    const at = localToUtc(o.date, t, o.tz).getTime();
    return at >= o.now.getTime() + LEAD_MS && o.busy.every((b) => Math.abs(b.getTime() - at) >= GAP_MS);
  };
  return candidates.find(ok) ?? candidates[0];
}

/** Máximo de ideias por pedido à IA (mais do que isto não cabe no tempo de resposta). */
export const IDEAS_PER_RUN = 10;

/** Dias para as ideias em falta na semana; se faltarem mais de 10, as primeiras 10 (o resto num novo pedido). */
export function weekPlanDays(start: string, missing: number): string[] {
  return spreadWeek(start, missing).slice(0, IDEAS_PER_RUN);
}
