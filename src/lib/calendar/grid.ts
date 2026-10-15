import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { utcToLocalParts } from '@/lib/time/zone';

const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const WEEK = { weekStartsOn: 1 as const };

/** Semanas (segunda a domingo) que cobrem o mês; inclui dias dos meses vizinhos. */
export function buildMonthGrid(year: number, month: number): string[][] {
  const first = new Date(year, month - 1, 1);
  let day = startOfWeek(startOfMonth(first), WEEK);
  const last = endOfWeek(endOfMonth(first), WEEK);
  const weeks: string[][] = [];
  while (day <= last) {
    const w: string[] = [];
    for (let i = 0; i < 7; i++) {
      w.push(iso(day));
      day = addDays(day, 1);
    }
    weeks.push(w);
  }
  return weeks;
}

export function buildWeek(anyDate: string): string[] {
  const start = startOfWeek(parseISO(anyDate), WEEK);
  return Array.from({ length: 7 }, (_, i) => iso(addDays(start, i)));
}

export function groupByLocalDay<T extends { at: Date }>(items: T[], tz: string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const it of items) (out[utcToLocalParts(it.at, tz).date] ??= []).push(it);
  return out;
}

export function shiftDate(date: string, view: 'semana' | 'mes', n: number): string {
  const d = parseISO(date);
  return iso(view === 'semana' ? addWeeks(d, n) : addMonths(d, n));
}
