'use client';

import { Check, FolderInput, ImagePlus, MoreHorizontal, Tag, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { deleteMedia, tagMedia } from '@/app/(app)/biblioteca/actions';
import type { MediaItem } from '@/lib/db/repo/media-repo';
import { cn } from '@/lib/utils';
import { MediaThumb } from './media-thumb';
import { MediaViewer } from './media-viewer';

function UsageBadge({ item }: { item: MediaItem }) {
  if (item.usage === undefined) return null;
  return item.usage ? (
    <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">Usado {item.usage.count}×</span>
  ) : (
    <span className="rounded border border-dashed px-1.5 py-0.5 text-[11px] text-muted-foreground">Por usar</span>
  );
}

/** Grelha de mídia. Em modo de seleção (`selected` + `onToggle`) serve de seletor no criador de posts e na Biblioteca. */
export function MediaGrid({ items, selected, onToggle, onMove, tzByBrand, emptyText }: {
  items: MediaItem[];
  selected?: string[];
  onToggle?: (id: string) => void;
  /** Mostra "Mover para pasta" no menu de cada ficheiro. */
  onMove?: (item: MediaItem) => void;
  tzByBrand?: Record<string, string>;
  emptyText?: string;
}) {
  const [pending, start] = useTransition();
  const selecting = !!onToggle;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-10 text-center">
        <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <ImagePlus className="size-6" aria-hidden />
        </span>
        <p className="font-medium">Ainda sem ficheiros</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {emptyText ?? (selecting ? 'Carregue fotos ou vídeos na Biblioteca para os usar nos posts.' : 'Carregue aqui as fotos e vídeos que criou. Depois escolhe-os ao criar cada post.')}
        </p>
      </div>
    );
  }

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
                  <span className="absolute left-1 top-1 flex size-6 items-center justify-center rounded-full bg-brand-amber text-xs font-semibold text-[#0B1F45]">
                    {selected!.length > 1 ? order + 1 : <Check className="size-4" aria-hidden />}
                  </span>
                )}
              </button>
            ) : (
              <MediaViewer item={m} showCreatePost tz={tzByBrand?.[m.brandId]} />
            )}
            <p className="truncate text-xs" title={m.originalName ?? ''}>
              {m.originalName ?? m.storagePath.split('/').pop()}
            </p>
            <p className="text-xs text-muted-foreground">
              {m.mime === 'image/jpeg' ? 'JPEG' : m.mime.split('/')[1]?.toUpperCase()} · {(m.sizeBytes / 1024 / 1024).toFixed(1)} MB
              {m.width && m.height ? ` · ${m.width}×${m.height}` : ''}
            </p>
            {m.tags.length > 0 && <p className="truncate text-xs text-primary">{m.tags.map((t) => `#${t}`).join(' ')}</p>}
            <UsageBadge item={m} />
            {!selecting && (
              <div className="flex items-center gap-1">
                <Link href={`/posts/novo?midia=${m.id}`} className="flex min-h-8 items-center rounded-md px-2 text-xs font-medium text-primary hover:bg-accent">
                  Criar post
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" disabled={pending} aria-label="Mais ações" className="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent">
                      <MoreHorizontal className="size-4" aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onMove && (
                      <DropdownMenuItem onSelect={() => onMove(m)}>
                        <FolderInput className="size-4" aria-hidden /> Mover para pasta
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onSelect={() => {
                        const v = prompt('Etiquetas separadas por vírgulas (ex.: portugal, prazos)', m.tags.join(', '));
                        if (v == null) return;
                        start(async () => {
                          const r = await tagMedia(m.id, v.split(','));
                          if (!r.ok) toast.error(r.error);
                        });
                      }}
                    >
                      <Tag className="size-4" aria-hidden /> Etiquetas
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        if (!confirm('Apagar este ficheiro?')) return;
                        start(async () => {
                          const r = await deleteMedia(m.id);
                          if (r.ok) toast.success('Ficheiro apagado.');
                          else toast.error(r.error);
                        });
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden /> Apagar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
