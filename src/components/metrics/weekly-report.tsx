'use client';

import { RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { weeklyReport, type ReportResult } from '@/app/(app)/metricas/actions';
import { Button } from '@/components/ui/button';
import { callSafely } from '@/lib/ai/call-safely';

type Ready = Extract<ReportResult, { ok: true }>;
const fmtDay = (ymd: string) => ymd.split('-').reverse().slice(0, 2).join('/');

/** Resumo da semana escrito pela IA. O da semana passada aparece sozinho na primeira visita da semana. */
export function WeeklyReportCard({ brandId, initial }: { brandId: string; initial: Ready | null }) {
  const [data, setData] = useState<Ready | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const asked = useRef(false);

  const load = (regenerate: boolean) =>
    start(async () => {
      const r = await callSafely(() => weeklyReport({ brandId, regenerate }));
      if (r.ok) {
        setData(r);
        setError(null);
      } else if (regenerate) toast.error(r.error);
      else setError(r.error);
    });

  useEffect(() => {
    if (!initial && !asked.current) {
      asked.current = true;
      load(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const list = (title: string, items: string[]) =>
    items.length > 0 && (
      <div>
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">{items.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
    );

  return (
    <section aria-label="Resumo da semana" className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-medium">
          <Sparkles className="size-4 text-muted-foreground" aria-hidden /> Resumo da semana
          {data && <span className="text-sm font-normal text-muted-foreground">{fmtDay(data.weekStart)} a {fmtDay(data.weekEnd)}</span>}
        </h2>
        {data && (
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => load(true)}>
            <RefreshCw className={pending ? 'size-3.5 animate-spin' : 'size-3.5'} aria-hidden /> Escrever de novo
          </Button>
        )}
      </div>
      {!data && pending && <p role="status" className="animate-pulse text-sm text-muted-foreground">A IA está a escrever o resumo da semana passada…</p>}
      {!data && error && (
        <div className="space-y-2 text-sm">
          <p className="text-destructive">{error}</p>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => load(false)}>Tentar de novo</Button>
        </div>
      )}
      {data && (
        <div className="space-y-3">
          <p className="text-sm font-medium">{data.report.headline}</p>
          {list('O que correu bem', data.report.good)}
          {list('O que melhorar', data.report.improve)}
          {list('Para esta semana', data.report.nextWeek)}
        </div>
      )}
    </section>
  );
}
