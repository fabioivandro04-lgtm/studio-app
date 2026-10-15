'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { changeIdeaStatus, ideaToDraft } from '@/app/(app)/ideias/actions';
import { PlatformIcon } from '@/components/platform-icon';
import { Button } from '@/components/ui/button';
import { callSafely } from '@/lib/ai/call-safely';
import type { Platform, TargetFormat } from '@/lib/platforms/types';
import { FORMAT_LABEL } from '@/lib/posts/schema';

export interface IdeaCardData {
  id: string;
  title: string;
  hook: string;
  outline: string;
  caption: string;
  format: TargetFormat | null;
  platforms: Platform[];
  status: 'new' | 'used' | 'discarded';
  whenLabel: string | null;
  deadlineTitle: string | null;
  postId: string | null;
  brandName: string;
  brandColor: string;
}

export function IdeaCard({ idea }: { idea: IdeaCardData }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const toCalendar = () =>
    start(async () => {
      const r = await callSafely(() => ideaToDraft({ ideaId: idea.id }));
      if (r.ok) {
        toast.success('Rascunho criado. Falta só a foto ou o vídeo.');
        router.push(`/posts/${r.postId}`);
      } else toast.error(r.error);
    });
  const setStatus = (status: 'new' | 'discarded') =>
    start(async () => {
      const r = await callSafely(() => changeIdeaStatus({ ideaId: idea.id, status }));
      if (r.ok) router.refresh();
      else toast.error(r.error);
    });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText([idea.title, idea.hook, idea.outline].filter(Boolean).join('\n\n'));
      toast.success('Guião copiado.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  return (
    <li data-testid="idea-card" className="space-y-2 rounded-xl border border-l-4 bg-background p-3 text-sm" style={{ borderLeftColor: idea.brandColor }}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{idea.whenLabel ?? 'Sem data'}</span>
        {idea.format && <span>· {FORMAT_LABEL[idea.format]}</span>}
        <span className="flex gap-1">{idea.platforms.map((p) => <PlatformIcon key={p} platform={p} size="sm" />)}</span>
        {idea.deadlineTitle && <span className="rounded bg-brand-amber/25 px-1.5 text-brand-navy">⏰ {idea.deadlineTitle}</span>}
        <span className="ml-auto">{idea.brandName}</span>
      </div>
      <p className="font-medium">{idea.title}</p>
      {idea.hook && <p className="italic">“{idea.hook}”</p>}
      {idea.outline && <p className="whitespace-pre-wrap text-muted-foreground">{idea.outline}</p>}
      {idea.caption && (
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground">Legenda de rascunho</summary>
          <p className="mt-1 whitespace-pre-wrap">{idea.caption}</p>
        </details>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {idea.status === 'new' && (
          <>
            <Button type="button" size="sm" disabled={pending} onClick={toCalendar}>Pôr no calendário</Button>
            <Button type="button" size="sm" variant="outline" onClick={copy}>Copiar guião</Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setStatus('discarded')}>Descartar</Button>
          </>
        )}
        {idea.status === 'discarded' && (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setStatus('new')}>Recuperar</Button>
        )}
        {idea.status === 'used' && idea.postId && (
          <Link href={`/posts/${idea.postId}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">Abrir post</Link>
        )}
      </div>
    </li>
  );
}
