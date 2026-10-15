import Link from 'next/link';
import { MediaGrid } from '@/components/media/media-grid';
import { MediaUploader } from '@/components/media/media-uploader';
import { createServerClient } from '@/lib/db/clients';
import { listBrands, selectedBrandId } from '@/lib/db/repo/brands-repo';
import { listMedia } from '@/lib/db/repo/media-repo';
import { cn } from '@/lib/utils';

export default async function BibliotecaPage({ searchParams }: { searchParams: Promise<{ tipo?: string; etiqueta?: string }> }) {
  const { tipo, etiqueta } = await searchParams;
  const db = await createServerClient();
  const brands = await listBrands(db);
  const brandId = await selectedBrandId(brands);
  const kind = tipo === 'video' || tipo === 'image' ? tipo : null;
  const items = await listMedia(db, { brandId, kind, tag: etiqueta ?? null });
  const allTags = [...new Set((await listMedia(db, { brandId, limit: 500 })).flatMap((m) => m.tags))].sort();

  const filter = (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ tipo, etiqueta, ...params }).filter(([, v]) => v) as [string, string][]);
    return `/biblioteca${q.size ? `?${q}` : ''}`;
  };
  const chip = (active: boolean) => cn('rounded-md border px-3 py-1 text-sm', active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Biblioteca</h1>
        <MediaUploader brands={brands.map(({ id, name }) => ({ id, name }))} defaultBrandId={brandId} />
      </div>
      <nav aria-label="Filtros" className="flex flex-wrap gap-2">
        <Link href={filter({ tipo: undefined })} className={chip(!kind)}>Tudo</Link>
        <Link href={filter({ tipo: 'image' })} className={chip(kind === 'image')}>Imagens</Link>
        <Link href={filter({ tipo: 'video' })} className={chip(kind === 'video')}>Vídeos</Link>
        {allTags.map((t) => (
          <Link key={t} href={filter({ etiqueta: etiqueta === t ? undefined : t })} className={chip(etiqueta === t)}>
            #{t}
          </Link>
        ))}
      </nav>
      <MediaGrid items={items} />
    </div>
  );
}
