'use client';

import { AlertTriangle, Bot } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { scheduleDrafts } from '@/app/(app)/caixa/actions';
import { deletePost } from '@/app/(app)/posts/actions';
import { PlatformIcon } from '@/components/platform-icon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { callSafely } from '@/lib/ai/call-safely';
import type { ClaudeDraft } from '@/lib/caixa/drafts-repo';
import { formatDayPt } from '@/lib/ui/datetime';

export type ClaudeDraftView = ClaudeDraft & { thumbUrl: string | null };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Secção "Do Claude" da Caixa: rever, agendar (um ou vários) e apagar rascunhos criados pelo Claude. */
export function ClaudeDrafts({ drafts }: { drafts: ClaudeDraftView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const ready = drafts.filter((d) => d.warnings.length === 0);

  const schedule = (ids: string[]) =>
    start(async () => {
      const r = await callSafely(() => scheduleDrafts(ids));
      if (!r.ok) return void toast.error(r.error);
      if (!r.scheduled.length) toast.error(r.skipped.length ? `Nenhum rascunho pronto para agendar. ${r.skipped[0].reason}` : 'Nenhum rascunho pronto para agendar.');
      else toast.success(`${plural(r.scheduled.length, 'post agendado', 'posts agendados')}${r.skipped.length ? `; ${plural(r.skipped.length, 'ficou', 'ficaram')} de fora: ${r.skipped[0].reason}` : '.'}`);
      setSel(new Set());
      router.refresh();
    });

  const remove = (id: string) => {
    if (!confirm('Apagar este rascunho do Estúdio?')) return;
    start(async () => {
      const r = await callSafely(() => deletePost(id));
      if (r.ok) {
        toast.success('Rascunho apagado.');
        router.refresh();
      } else toast.error(r.error);
    });
  };

  const toggle = (id: string, on: boolean) => setSel((s) => {
    const n = new Set(s);
    if (on) n.add(id);
    else n.delete(id);
    return n;
  });

  return (
    <section className="space-y-3" aria-label="Do Claude">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-medium"><Bot className="size-4" aria-hidden />Do Claude ({drafts.length})</h2>
        <div className="flex items-center gap-2">
          {ready.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setSel(sel.size === ready.length ? new Set() : new Set(ready.map((d) => d.id)))}>
              {sel.size === ready.length ? 'Limpar seleção' : 'Escolher os prontos'}
            </Button>
          )}
          <Button type="button" size="sm" disabled={pending || sel.size === 0} onClick={() => schedule([...sel])}>
            Agendar selecionados ({sel.size})
          </Button>
        </div>
      </div>
      <ul className="space-y-2">
        {drafts.map((d) => (
          <li key={d.id} data-testid="claude-draft" className="flex gap-3 rounded-xl border bg-card p-3 shadow-xs">
            <Checkbox className="mt-1" aria-label={`Escolher ${d.title}`} checked={sel.has(d.id)} disabled={d.warnings.length > 0} onCheckedChange={(v) => toggle(d.id, v === true)} />
            {d.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.thumbUrl} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">Vídeo</div>
            )}
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: d.brandColor }} aria-hidden />
                <span className="font-medium">{d.title}</span>
              </p>
              <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                {d.date ? `${formatDayPt(d.date)} às ${d.time}` : 'Sem data'}
                {d.platforms.map((p) => <PlatformIcon key={p} platform={p} size="sm" />)}
              </p>
              {d.caption && <p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{d.caption}</p>}
              {d.warnings.map((w) => (
                <p key={w} className="flex items-start gap-1 text-xs text-destructive"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />{w}</p>
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" size="sm" disabled={pending || d.warnings.length > 0} title={d.warnings[0]} onClick={() => schedule([d.id])}>Agendar</Button>
                <Button asChild type="button" size="sm" variant="outline"><Link href={`/posts/${d.id}`}>Abrir</Link></Button>
                <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => remove(d.id)}>Apagar</Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
