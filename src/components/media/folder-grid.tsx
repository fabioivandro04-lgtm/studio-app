import { Folder, FolderOpen, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { FolderCard } from '@/lib/db/repo/folders-repo';
import { FolderDialog } from './folder-dialog';

/** Cartões das pastas + "Sem pasta". `brandColor` só com "Todas as marcas". */
export function FolderGrid({ folders, looseCount, brandId, brandColor }: {
  folders: FolderCard[];
  looseCount: number;
  brandId: string | null;
  brandColor?: Record<string, string>;
}) {
  return (
    <section aria-labelledby="pastas-title" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="pastas-title" className="text-base font-semibold">Pastas</h2>
        {brandId ? (
          <FolderDialog brandId={brandId} trigger={<Button size="sm" variant="outline"><Plus className="size-4" aria-hidden /> Nova pasta</Button>} />
        ) : (
          <span className="text-xs text-muted-foreground">Escolha uma marca para criar pastas.</span>
        )}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {folders.map((f) => (
          <li key={f.id}>
            <Link href={`/biblioteca?pasta=${f.id}`} className="block rounded-xl border bg-card p-2 hover:border-primary/40" data-testid="folder-card">
              <div className="grid aspect-square grid-cols-2 gap-1 overflow-hidden rounded-lg bg-muted">
                {f.previews.length ? (
                  f.previews.map((u) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={u} src={u} alt="" className={f.previews.length === 1 ? 'col-span-2 row-span-2 size-full object-cover' : 'size-full object-cover'} />
                  ))
                ) : (
                  <span className="col-span-2 row-span-2 flex items-center justify-center text-muted-foreground">
                    <Folder className="size-8" aria-hidden />
                  </span>
                )}
              </div>
              <p className="mt-2 flex items-center gap-1.5 truncate text-sm font-medium">
                {brandColor && <span className="size-2.5 shrink-0 rounded-full" style={{ background: brandColor[f.brandId] }} aria-hidden />}
                <span className="truncate">{f.name}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {f.count === 1 ? '1 ficheiro' : `${f.count} ficheiros`} · {f.usedIn ? `Usada em ${f.usedIn} ${f.usedIn === 1 ? 'post' : 'posts'}` : 'Por usar'}
              </p>
            </Link>
          </li>
        ))}
        <li>
          <Link href="/biblioteca?pasta=sem" className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center hover:border-primary/40" data-testid="folder-loose">
            <FolderOpen className="size-8 text-muted-foreground" aria-hidden />
            <p className="mt-2 text-sm font-medium">Sem pasta ({looseCount})</p>
            <p className="text-xs text-muted-foreground">Ficheiros soltos por arrumar</p>
          </Link>
        </li>
      </ul>
    </section>
  );
}
