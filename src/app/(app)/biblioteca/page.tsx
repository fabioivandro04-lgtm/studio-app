import Link from 'next/link';
import { FolderGrid } from '@/components/media/folder-grid';
import { FolderHeader } from '@/components/media/folder-header';
import { LibraryGrid } from '@/components/media/library-grid';
import { MediaUploader } from '@/components/media/media-uploader';
import type { FolderOption } from '@/components/media/move-to-folder';
import { Button } from '@/components/ui/button';
import { createServerClient } from '@/lib/db/clients';
import { listBrands, selectedBrandId } from '@/lib/db/repo/brands-repo';
import { getFolder, listFolders, mediaUsage } from '@/lib/db/repo/folders-repo';
import { listMedia } from '@/lib/db/repo/media-repo';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui-x/page-header';

type Search = { tipo?: string; etiqueta?: string; pasta?: string; uso?: string };

export default async function BibliotecaPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { tipo, etiqueta, pasta, uso } = await searchParams;
  const db = await createServerClient();
  const brands = await listBrands(db);
  const selected = await selectedBrandId(brands);
  const folder = pasta && pasta !== 'sem' ? await getFolder(db, pasta) : null;

  if (pasta && pasta !== 'sem' && !folder) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed px-6 py-10 text-center">
        <p className="font-medium">Pasta não encontrada</p>
        <p className="text-sm text-muted-foreground">Pode ter sido apagada. Os ficheiros dela estão em Sem pasta.</p>
        <Button asChild variant="outline" size="sm"><Link href="/biblioteca">Voltar à Biblioteca</Link></Button>
      </div>
    );
  }

  // Dentro de uma pasta, a marca é a da pasta.
  const brandId = folder?.brandId ?? selected;
  const kind = tipo === 'video' || tipo === 'image' ? tipo : null;
  const unused = uso === 'nao';
  const folderFilter = folder ? folder.id : pasta === 'sem' ? 'none' : null;
  const optsQuery = db.from('media_folders').select('id, name, brand_id').order('name');
  const [listed, all, overview, { data: opts }] = await Promise.all([
    listMedia(db, { brandId, kind, tag: etiqueta ?? null, folderId: folderFilter, oldestFirst: !!folder }),
    listMedia(db, { brandId, limit: 500 }),
    pasta ? null : listFolders(db, brandId),
    brandId ? optsQuery.eq('brand_id', brandId) : optsQuery,
  ]);
  const usage = await mediaUsage(db, listed.map((m) => m.id));
  const items = listed.map((m) => ({ ...m, usage: usage.get(m.id) ?? null })).filter((m) => !unused || !m.usage);
  const allTags = [...new Set(all.flatMap((m) => m.tags))].sort();

  const optionsByBrand: Record<string, FolderOption[]> = {};
  for (const o of opts ?? []) (optionsByBrand[o.brand_id as string] ??= []).push({ id: o.id as string, name: o.name as string });
  const tzByBrand = Object.fromEntries(brands.map((b) => [b.id, b.timezone]));

  const filter = (params: Partial<Search>) => {
    const q = new URLSearchParams(Object.entries({ tipo, etiqueta, pasta, uso, ...params }).filter(([, v]) => v) as [string, string][]);
    return `/biblioteca${q.size ? `?${q}` : ''}`;
  };
  const chip = (active: boolean) => cn('rounded-md border px-3 py-1 text-sm', active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent');
  const uploaderBrands = (folder ? brands.filter((b) => b.id === folder.brandId) : brands).map(({ id, name }) => ({ id, name }));

  return (
    <div className="space-y-5">
      {folder ? (
        <>
          <FolderHeader folder={folder} mediaIds={items.map((m) => m.id)} />
          <MediaUploader brands={uploaderBrands} defaultBrandId={folder.brandId} folderId={folder.id} />
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageHeader title={pasta === 'sem' ? 'Sem pasta' : 'Biblioteca'} description={pasta === 'sem' ? 'Ficheiros que ainda não estão em nenhuma pasta.' : undefined} />
          <MediaUploader brands={uploaderBrands} defaultBrandId={brandId} />
        </div>
      )}
      {pasta === 'sem' && <Link href="/biblioteca" className="text-sm text-muted-foreground hover:text-foreground">← Biblioteca</Link>}
      {overview && (
        <FolderGrid
          folders={overview.folders}
          looseCount={overview.looseCount}
          brandId={brandId}
          brandColor={brandId ? undefined : Object.fromEntries(brands.map((b) => [b.id, b.color]))}
        />
      )}
      <section aria-label="Ficheiros" className="space-y-3">
        {!pasta && <h2 className="text-base font-semibold">Todos os ficheiros</h2>}
        <nav aria-label="Filtros" className="flex flex-wrap gap-2">
          <Link href={filter({ tipo: undefined, uso: undefined })} className={chip(!kind && !unused)}>Tudo</Link>
          <Link href={filter({ tipo: 'image' })} className={chip(kind === 'image')}>Imagens</Link>
          <Link href={filter({ tipo: 'video' })} className={chip(kind === 'video')}>Vídeos</Link>
          <Link href={filter({ uso: unused ? undefined : 'nao' })} className={chip(unused)}>Por usar</Link>
          {allTags.map((t) => (
            <Link key={t} href={filter({ etiqueta: etiqueta === t ? undefined : t })} className={chip(etiqueta === t)}>
              #{t}
            </Link>
          ))}
        </nav>
        <LibraryGrid
          items={items}
          foldersByBrand={optionsByBrand}
          tzByBrand={tzByBrand}
          currentFolderId={folder ? folder.id : pasta === 'sem' ? null : undefined}
          emptyText={folder ? 'Esta pasta está vazia. Envie ficheiros aqui ou mova-os da Biblioteca.' : unused ? 'Todos os ficheiros já foram usados.' : undefined}
        />
      </section>
    </div>
  );
}
