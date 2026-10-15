'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { bestTimes } from '@/app/(app)/ai/actions';
import type { Slot } from '@/lib/ai/best-time';
import { Button } from '@/components/ui/button';

const label = (s: Slot) => {
  const d = new Intl.DateTimeFormat('pt-PT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${s.date}T12:00:00Z`));
  return `${d} · ${s.time}`;
};

/** Botão "🕐 Melhor hora": 3 sugestões que preenchem a data e a hora. */
export function BestTime({ brandId, postId, onPick }: { brandId: string; postId: string | null; onPick(date: string, time: string): void }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [pending, start] = useTransition();
  const load = () =>
    start(async () => {
      const r = await bestTimes({ brandId, excludePostId: postId });
      if (r.ok) setSlots(r.slots);
      else toast.error(r.error);
    });
  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={load}>
        {pending ? 'A calcular…' : '🕐 Melhor hora'}
      </Button>
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
