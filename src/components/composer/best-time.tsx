'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { callSafely } from '@/lib/ai/call-safely';
import { bestTimes, nextSlot } from '@/app/(app)/ai/actions';
import type { Slot } from '@/lib/ai/best-time';
import { Button } from '@/components/ui/button';

const label = (s: Pick<Slot, 'date' | 'time'>) => {
  const d = new Intl.DateTimeFormat('pt-PT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${s.date}T12:00:00Z`));
  return `${d} · ${s.time}`;
};

/** Botão "🕐 Melhor hora": 3 sugestões que preenchem a data e a hora. */
export function BestTime({ brandId, postId, hasSlots, onPick }: { brandId: string; postId: string | null; hasSlots: boolean; onPick(date: string, time: string): void }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [pending, start] = useTransition();
  const load = () =>
    start(async () => {
      const r = await callSafely(() => bestTimes({ brandId, excludePostId: postId }));
      if (r.ok) setSlots(r.slots);
      else toast.error(r.error);
    });
  const fill = () =>
    start(async () => {
      const r = await callSafely(() => nextSlot({ brandId, excludePostId: postId }));
      if (!r.ok) toast.error(r.error);
      else if (!r.slot) toast.error('Não há horários fixos livres nas próximas 4 semanas.');
      else {
        onPick(r.slot.date, r.slot.time);
        toast.success(`Marcado para ${label(r.slot)}.`);
      }
    });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {hasSlots && (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={fill}>
            <span aria-hidden>📅</span> Próximo horário livre
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={load}>
          {pending ? 'A calcular…' : '🕐 Melhor hora'}
        </Button>
      </div>
      {slots && slots.length === 0 && <p className="text-sm text-muted-foreground">Sem horários livres nos próximos 7 dias.</p>}
      {slots && slots.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {slots.map((s) => (
            <li key={`${s.date}${s.time}`}>
              <button
                type="button"
                data-testid="best-time-slot"
                data-date={s.date}
                data-time={s.time}
                onClick={() => onPick(s.date, s.time)}
                className="max-w-64 rounded-lg border bg-background px-3 py-1.5 text-left text-sm hover:border-brand-navy"
              >
                <span className="block font-medium first-letter:uppercase">{label(s)}</span>
                <span className="block text-xs text-muted-foreground">
                  {s.source === 'initial' ? 'sugestão inicial' : s.reason}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
