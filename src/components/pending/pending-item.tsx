'use client';

import { Copy, ExternalLink } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { associatePost, listCandidates, markDone, retryTarget } from '@/app/(app)/pendentes/actions';
import { Button } from '@/components/ui/button';
import { openUrl } from '@/lib/pending/links';
import { PLATFORM_LABEL, type Platform, type RecentPost } from '@/lib/platforms/types';

export interface PendingItemData {
  id: string;
  status: 'awaiting_user' | 'failed';
  platform: Platform;
  handle: string;
  brandName: string;
  brandColor: string;
  title: string;
  caption: string;
  when: string;
  lastError: string | null;
  externalPostId: string | null;
  thumbUrl: string | null;
}

export function PendingItem({ item }: { item: PendingItemData }) {
  const [pending, start] = useTransition();
  const [candidates, setCandidates] = useState<RecentPost[] | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(msg);
      else toast.error(r.error);
    });
  const url = openUrl(item);

  return (
    <li className="space-y-2 rounded-xl border p-3" data-testid="pending-item" aria-label={`${PLATFORM_LABEL[item.platform]} ${item.title}`}>
      <div className="flex gap-3">
        {item.thumbUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
        )}
        <div className="min-w-0 flex-1 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: item.brandColor }} aria-hidden />
            <span className="font-medium">{item.title || 'Sem título'}</span>
            <span className="text-muted-foreground">· {PLATFORM_LABEL[item.platform]} @{item.handle.replace(/^@/, '')} · {item.when}</span>
          </p>
          {item.status === 'awaiting_user' ? (
            <p className="mt-1 font-medium text-warning">Aguarda 1 toque</p>
          ) : (
            <p className="mt-1 text-destructive">Falhou: {item.lastError ?? 'erro desconhecido'}</p>
          )}
          {item.caption && <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{item.caption}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {item.status === 'awaiting_user' && (
          <>
            {url && (
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm hover:bg-accent">
                <ExternalLink className="size-3.5" aria-hidden /> {item.platform === 'tiktok' ? 'Abrir TikTok' : 'Abrir no YouTube Studio'}
              </a>
            )}
            {item.platform === 'tiktok' && item.caption && (
              <Button type="button" size="sm" variant="outline" onClick={async () => {
                await navigator.clipboard.writeText(item.caption);
                toast.success('Legenda copiada.');
              }}>
                <Copy className="size-3.5" aria-hidden /> Copiar legenda
              </Button>
            )}
            <Button type="button" size="sm" disabled={pending} onClick={() => run(() => markDone(item.id), 'Marcado como publicado.')}>
              Marcar como feito
            </Button>
            {item.platform === 'tiktok' && (
              <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => {
                const r = await listCandidates(item.id);
                if (r.ok) setCandidates(r.posts);
                else toast.error(r.error);
              })}>
                Associar vídeo
              </Button>
            )}
          </>
        )}
        {item.status === 'failed' && (
          <Button type="button" size="sm" disabled={pending} onClick={() => run(() => retryTarget(item.id), 'Vai ser tentado de novo no próximo minuto.')}>
            Tentar de novo
          </Button>
        )}
      </div>

      {candidates && (
        <div className="rounded-lg bg-muted p-2">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum vídeo recente encontrado. Publique primeiro no TikTok.</p>
          ) : (
            <ul className="space-y-1" aria-label="Vídeos recentes">
              {candidates.map((c) => (
                <li key={c.externalId} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">{c.title || c.externalId} · {new Date(c.createdAt).toLocaleString('pt-PT')}</span>
                  <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => associatePost(item.id, c.externalId, c.permalink), 'Vídeo associado.')}>
                    Associar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
