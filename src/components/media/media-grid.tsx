'use client';

import { Check, Tag, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { deleteMedia, tagMedia } from '@/app/(app)/biblioteca/actions';
import type { MediaItem } from '@/lib/db/repo/media-repo';
import { cn } from '@/lib/utils';
import { MediaThumb } from './media-thumb';

/** Grelha de mídia. Em modo de seleção (`selected` + `onToggle`) serve de seletor no criador de posts. */
export function MediaGrid({ items, selected, onToggle }: { items: MediaItem[]; selected?: string[]; onToggle?: (id: string) => void }) {
  const [pending, start] = useTransition();
  const selecting = !!onToggle;

  if (items.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Sem ficheiros.</p>;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((m) => {
        const order = selected?.indexOf(m.id) ?? -1;
        return (
          <li key={m.id} className="space-y-1" data-testid="media-item">
            {selecting ? (
              <button
                type="button"
                onClick={() => onToggle!(m.id)}
                aria-pressed={order >= 0}
                aria-label={`Selecionar ${m.originalName ?? m.kind}`}
                className={cn('relative block w-full rounded-lg ring-offset-2', order >= 0 && 'ring-2 ring-brand-amber')}
              >
                <MediaThumb item={m} />
                {order >= 0 && (
                  <span className="absolute left-1 top-1 flex size-6 items-center justify-center rounded-full bg-brand-amber text-xs font-semibold text-brand-navy">
                    {selected!.length > 1 ? order + 1 : <Check className="size-4" aria-hidden />}
                  </span>
                )}
              </button>
            ) : (
              <MediaThumb item={m} />
            )}
            <p className="truncate text-xs" title={m.originalName ?? ''}>
              {m.originalName ?? m.storagePath.split('/').pop()}
            </p>
            <p className="text-xs text-muted-foreground">
              {m.mime === 'image/jpeg' ? 'JPEG' : m.mime.split('/')[1]?.toUpperCase()} · {(m.sizeBytes / 1024 / 1024).toFixed(1)} MB
              {m.width && m.height ? ` · ${m.width}×${m.height}` : ''}
            </p>
            {m.tags.length > 0 && <p className="truncate text-xs text-brand-navy">{m.tags.map((t) => `#${t}`).join(' ')}</p>}
            {!selecting && (
              <div className="flex gap-1">
                <Link href={`/posts/novo?midia=${m.id}`} className="rounded px-1.5 py-0.5 text-xs underline hover:bg-accent">
                  Criar post
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  aria-label="Etiquetas"
                  className="rounded p-1 hover:bg-accent"
                  onClick={() => {
                    const v = prompt('Etiquetas separadas por vírgulas (ex.: portugal, prazos)', m.tags.join(', '));
                    if (v == null) return;
                    start(async () => {
                      const r = await tagMedia(m.id, v.split(','));
                      if (!r.ok) toast.error(r.error);
                    });
                  }}
                >
                  <Tag className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  aria-label="Apagar"
                  className="rounded p-1 hover:bg-accent"
                  onClick={() => {
                    if (!confirm('Apagar este ficheiro?')) return;
                    start(async () => {
                      const r = await deleteMedia(m.id);
                      if (r.ok) toast.success('Ficheiro apagado.');
                      else toast.error(r.error);
                    });
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
