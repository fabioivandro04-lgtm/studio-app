'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { reschedule } from '@/app/(app)/calendario/actions';
import { Button } from '@/components/ui/button';
import { callSafely } from '@/lib/ai/call-safely';

const dayLabel = (d: string) => new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));

/** "Mover" no telemóvel: escolhe outro dia (a hora mantém-se). */
export function MovePost({ postId, day, title }: { postId: string; day: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(day);
  const [pending, start] = useTransition();
  const move = () =>
    start(async () => {
      const r = await callSafely(() => reschedule(postId, date));
      if (r.ok) {
        toast.success(`Post movido para ${dayLabel(date)}.`);
        setOpen(false);
        router.refresh();
      } else toast.error(r.error ?? 'Não foi possível mover o post.');
    });
  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} aria-label={`Mover ${title}`}>
        Mover
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2">
      <input
        type="date"
        aria-label="Novo dia"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="h-9 rounded-md border bg-background px-2 text-sm"
      />
      <Button type="button" size="sm" disabled={pending || !date || date === day} onClick={move}>
        {pending ? 'A mover…' : 'Mover para este dia'}
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { setOpen(false); setDate(day); }}>
        Cancelar
      </Button>
    </div>
  );
}
