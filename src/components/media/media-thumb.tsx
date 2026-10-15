import { Film, ImageIcon } from 'lucide-react';

export function formatDuration(s: number | null): string {
  if (s == null) return '';
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Miniatura de uma mídia (imagem, ou fotograma do vídeo com a duração). */
export function MediaThumb({ item, className = '' }: { item: { kind: 'image' | 'video'; previewUrl: string | null; durationS: number | null; originalName: string | null }; className?: string }) {
  return (
    <div className={`relative aspect-square overflow-hidden rounded-lg bg-muted ${className}`}>
      {item.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.previewUrl} alt={item.originalName ?? ''} className="size-full object-cover" loading="lazy" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          {item.kind === 'video' ? <Film className="size-6" aria-hidden /> : <ImageIcon className="size-6" aria-hidden />}
        </div>
      )}
      {item.kind === 'video' && (
        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 text-xs text-white" data-testid="duration">
          {formatDuration(item.durationS)}
        </span>
      )}
    </div>
  );
}
