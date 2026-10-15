import { z } from 'zod';
import { localToUtc, utcToLocalParts } from '@/lib/time/zone';

/** Horário fixo de publicação de uma marca. weekday: 0 = domingo … 6 = sábado. */
export type PostingSlot = { weekday: number; time: string };

const HOUR = 3_600_000;
const DAY = 86_400_000;

export const PostingSlots = z
  .array(
    z.object({
      weekday: z.number().int().min(0, 'Dia da semana inválido.').max(6, 'Dia da semana inválido.'),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida.'),
    }),
  )
  .max(21, 'No máximo 21 horários.')
  .refine((xs) => new Set(xs.map((s) => `${s.weekday} ${s.time}`)).size === xs.length, 'Horário repetido.');

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** Cada dia de from a to (inclusive) com os horários desse dia da semana, por ordem. */
export function slotDates(o: { slots: PostingSlot[]; from: string; to: string }): { date: string; time: string }[] {
  const out: { date: string; time: string }[] = [];
  for (let d = o.from; d <= o.to; d = addDays(d, 1)) {
    const times = o.slots.filter((s) => s.weekday === weekday(d)).map((s) => s.time).sort();
    for (const time of [...new Set(times)]) out.push({ date: d, time });
  }
  return out;
}

/** Há um post a menos de 1 h deste momento. */
export function isTaken(at: Date, busy: Date[]): boolean {
  return busy.some((b) => Math.abs(b.getTime() - at.getTime()) < HOUR);
}

export function freeSlotsInRange(o: { slots: PostingSlot[]; tz: string; busy: Date[]; now: Date; from: string; to: string }): { date: string; time: string }[] {
  return slotDates(o).filter((s) => {
    const at = localToUtc(s.date, s.time, o.tz);
    return at.getTime() >= o.now.getTime() + HOUR && !isTaken(at, o.busy);
  });
}

/** Primeiro horário fixo livre a partir de hoje (no fuso da marca), até horizonDays dias. */
export function nextFreeSlot(o: { slots: PostingSlot[]; tz: string; busy: Date[]; now: Date; horizonDays?: number }): { date: string; time: string } | null {
  if (o.slots.length === 0) return null;
  const today = utcToLocalParts(o.now, o.tz).date;
  return freeSlotsInRange({ ...o, from: today, to: addDays(today, o.horizonDays ?? 28) })[0] ?? null;
}
