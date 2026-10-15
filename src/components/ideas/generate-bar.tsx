'use client';

import { CalendarClock, CalendarRange, Clapperboard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { generateDeadlineIdeas, generateShortsIdeas, planNextWeek } from '@/app/(app)/ideias/actions';
import { Button } from '@/components/ui/button';
import { callSafely } from '@/lib/ai/call-safely';

export interface DeadlineOption { id: string; title: string; dueDate: string }

const fmt = (d: string) => d.split('-').reverse().join('/');

/** Os três botões de geração de ideias (só com uma marca escolhida). */
export function GenerateBar({ brandId, deadlines }: { brandId: string | null; deadlines: DeadlineOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picking, setPicking] = useState(false);
  const [deadlineId, setDeadlineId] = useState(deadlines[0]?.id ?? '');

  const run = (fn: () => Promise<{ ok: true; count: number } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await callSafely(fn);
      if (r.ok) {
        toast.success(r.count === 1 ? '1 ideia criada.' : `${r.count} ideias criadas.`);
        setPicking(false);
        router.refresh();
      } else toast.error(r.error);
    });

  if (!brandId) {
    return <p className="rounded-lg bg-highlight px-3 py-2 text-sm text-highlight-foreground">Escolha uma marca no topo para gerar ideias.</p>;
  }

  return (
    <section aria-label="Gerar ideias" className="space-y-3 rounded-lg border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={() => setPicking((v) => !v)}><CalendarClock className="size-4" aria-hidden /> Ideias para um prazo</Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => generateShortsIdeas({ brandId }))}><Clapperboard className="size-4" aria-hidden /> Vídeos curtos</Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => planNextWeek({ brandId }))}><CalendarRange className="size-4" aria-hidden /> Planear a próxima semana</Button>
      </div>
      {picking && (
        deadlines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Não há prazos futuros nesta marca. Adicione-os em <a className="underline" href="/definicoes/prazos">Definições → Prazos</a>.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="deadline-pick" className="text-sm">Prazo</label>
            <select id="deadline-pick" value={deadlineId} onChange={(e) => setDeadlineId(e.target.value)} className="h-9 max-w-full rounded-md border bg-background px-2 text-sm">
              {deadlines.map((d) => <option key={d.id} value={d.id}>{fmt(d.dueDate)} · {d.title}</option>)}
            </select>
            <Button type="button" size="sm" disabled={pending || !deadlineId} onClick={() => run(() => generateDeadlineIdeas({ brandId, deadlineId }))}>Gerar</Button>
          </div>
        )
      )}
      {pending && <p role="status" className="animate-pulse text-sm text-muted-foreground">A pensar…</p>}
    </section>
  );
}
