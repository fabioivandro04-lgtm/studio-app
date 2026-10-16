'use client';

import { ImageIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { mediaFileUrl } from '@/app/(app)/biblioteca/actions';
import { formatDuration } from '@/components/media/media-thumb';
import { Button } from '@/components/ui/button';
import { callSafely } from '@/lib/ai/call-safely';
import type { MediaItem } from '@/lib/db/repo/media-repo';

const label = (ms: number) => formatDuration(ms / 1000);

/** Capa do Reel: escolher o momento do vídeo cujo fotograma o Instagram mostra como capa. */
export function CoverPicker({ media, valueMs, disabled, onChange }: { media: MediaItem; valueMs: number | null; disabled?: boolean; onChange(ms: number | null): void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(valueMs ?? 0);
  const [durationMs, setDurationMs] = useState((media.durationS ?? 0) * 1000);
  const video = useRef<HTMLVideoElement>(null);

  const start = async () => {
    setOpen(true);
    if (url) return;
    const r = await callSafely(() => mediaFileUrl(media.id));
    if (r.ok) setUrl(r.url);
    else setError(r.error);
  };
  const seek = (ms: number) => {
    setPos(ms);
    if (video.current) video.current.currentTime = ms / 1000;
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
        <span>Capa: {valueMs == null ? 'início do vídeo' : `fotograma aos ${label(valueMs)}`}</span>
        {!disabled && <Button type="button" size="sm" variant="outline" onClick={start}>Escolher capa</Button>}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border p-3" role="group" aria-label="Capa do Reel">
      <p className="text-sm font-medium">Capa do Reel</p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      ) : !url ? (
        <p role="status" className="text-sm text-muted-foreground">A abrir o vídeo…</p>
      ) : (
        <>
          <video
            ref={video}
            src={url}
            muted
            playsInline
            preload="auto"
            poster={media.previewUrl ?? undefined}
            onLoadedMetadata={(e) => {
              setDurationMs(Math.floor(e.currentTarget.duration * 1000));
              e.currentTarget.currentTime = pos / 1000;
            }}
            className="mx-auto max-h-72 rounded bg-black"
            data-testid="cover-video"
          />
          <input
            type="range"
            min={0}
            max={Math.max(durationMs, 0)}
            step={100}
            value={pos}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Momento da capa"
            className="w-full accent-[var(--primary)]"
          />
          <p className="text-xs text-muted-foreground">Momento: {label(pos)}</p>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={!url} onClick={() => { onChange(pos); setOpen(false); }}>Usar este momento</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { onChange(null); setOpen(false); }}>Usar o início</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
      </div>
    </div>
  );
}
