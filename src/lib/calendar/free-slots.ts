import { freeSlotsInRange, type PostingSlot } from '@/lib/schedule/slots';

/** Horários fixos ainda livres (futuros e sem post a menos de 1 h), agrupados por dia. */
export function freeSlotsByDay(o: { slots: PostingSlot[]; tz: string; days: string[]; busy: Date[]; now: Date }): Record<string, string[]> {
  if (o.slots.length === 0 || o.days.length === 0) return {};
  const out: Record<string, string[]> = {};
  for (const s of freeSlotsInRange({ slots: o.slots, tz: o.tz, busy: o.busy, now: o.now, from: o.days[0], to: o.days[o.days.length - 1] })) {
    (out[s.date] ??= []).push(s.time);
  }
  return out;
}
