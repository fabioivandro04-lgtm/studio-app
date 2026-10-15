'use client';

import Link from 'next/link';
import { useState } from 'react';
import { mediaFileUrl } from '@/app/(app)/biblioteca/actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { callSafely } from '@/lib/ai/call-safely';
import type { MediaItem } from '@/lib/db/repo/media-repo';
import { formatDuration, MediaThumb } from './media-thumb';

/** Miniatura que abre a foto em grande ou o vídeo com leitor. O ficheiro só é pedido ao abrir. */
export function MediaViewer({ item, showCreatePost = false, className = '' }: { item: MediaItem; showCreatePost?: boolean; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const name = item.originalName ?? item.storagePath.split('/').pop() ?? '';
  const open = async (o: boolean) => {
    if (!o || url) return;
    setError(null);
    const r = await callSafely(() => mediaFileUrl(item.id));
    if (r.ok) setUrl(r.url);
    else setError(r.error);
  };
  const details = [
    `${(item.sizeBytes / 1024 / 1024).toFixed(1)} MB`,
    item.width && item.height ? `${item.width}×${item.height}` : null,
    item.kind === 'video' && item.durationS != null ? formatDuration(item.durationS) : null,
  ].filter(Boolean).join(' · ');
  return (
    <Dialog onOpenChange={open}>
      <DialogTrigger asChild>
        <button type="button" aria-label={`${item.kind === 'video' ? 'Ver vídeo' : 'Ver foto'} ${name}`} className={`block w-full rounded-lg focus-visible:ring-2 focus-visible:ring-brand-navy ${className}`}>
          <MediaThumb item={item} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[95dvh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{name}</DialogTitle>
          <DialogDescription>{details}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-48 items-center justify-center rounded-lg bg-black">
          {error ? (
            <p role="alert" className="p-6 text-sm text-white">{error}</p>
          ) : !url ? (
            <p role="status" className="p-6 text-sm text-white/80">A abrir…</p>
          ) : item.kind === 'video' ? (
            <video src={url} controls playsInline preload="metadata" poster={item.previewUrl ?? undefined} className="max-h-[75dvh] w-full" data-testid="media-video" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={name} className="max-h-[75dvh] w-auto object-contain" data-testid="media-image" />
          )}
        </div>
        {showCreatePost && (
          <div className="flex justify-end">
            <Button asChild size="sm"><Link href={`/posts/novo?midia=${item.id}`}>Criar post</Link></Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
