'use client';

import { CheckSquare, FolderInput, FolderMinus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { moveMedia } from '@/app/(app)/biblioteca/actions';
import { callSafely } from '@/lib/ai/call-safely';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { MediaItem } from '@/lib/db/repo/media-repo';
import { MediaGrid } from './media-grid';
import { MoveToFolder, type FolderOption } from './move-to-folder';

/** Ficheiros da Biblioteca com "Selecionar" e "Mover para pasta". */
export function LibraryGrid({ items, foldersByBrand, tzByBrand, currentFolderId, emptyText }: {
  items: MediaItem[];
  foldersByBrand: Record<string, FolderOption[]>;
  tzByBrand: Record<string, string>;
  /** Pasta aberta (null = "Sem pasta"; undefined = vista geral). */
  currentFolderId?: string | null;
  emptyText?: string;
}) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [moving, setMoving] = useState<{ ids: string[]; brandId: string; folderId: string | null } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  // Só conta o que está à vista (a seleção sobrevive a mudar de filtro).
  const chosen = items.filter((m) => selected.includes(m.id));
  const inFolder = chosen.filter((m) => m.folderId);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const stop = () => {
    setSelecting(false);
    setSelected([]);
  };
  const takeOut = () =>
    start(async () => {
      const r = await callSafely(() => moveMedia({ ids: inFolder.map((m) => m.id), folderId: null }));
      if (!r.ok) return void toast.error(r.error);
      toast.success(inFolder.length === 1 ? 'Ficheiro tirado da pasta.' : `${inFolder.length} ficheiros tirados da pasta.`);
      stop();
      router.refresh();
    });
  const moveSelected = () => {
    const brands = new Set(chosen.map((m) => m.brandId));
    if (brands.size !== 1) return void toast.error('Escolha ficheiros de uma só marca.');
    const folders = new Set(chosen.map((m) => m.folderId));
    setMoving({ ids: chosen.map((m) => m.id), brandId: chosen[0].brandId, folderId: folders.size === 1 ? chosen[0].folderId : null });
  };

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {selecting ? (
            <>
              <span className="text-sm font-medium" role="status">{chosen.length} selecionados</span>
              <Button size="sm" disabled={!chosen.length || pending} onClick={moveSelected}>
                <FolderInput className="size-4" aria-hidden /> Mover para pasta…
              </Button>
              {inFolder.length > 0 && (
                <Button size="sm" variant="outline" disabled={pending} onClick={takeOut}>
                  <FolderMinus className="size-4" aria-hidden /> Tirar da pasta
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={stop}>
                <X className="size-4" aria-hidden /> Cancelar
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setSelecting(true)}>
              <CheckSquare className="size-4" aria-hidden /> Selecionar
            </Button>
          )}
        </div>
      )}
      <MediaGrid
        items={items}
        selected={selecting ? selected : undefined}
        onToggle={selecting ? toggle : undefined}
        onMove={(m) => setMoving({ ids: [m.id], brandId: m.brandId, folderId: m.folderId })}
        tzByBrand={tzByBrand}
        emptyText={emptyText}
      />
      {moving && (
        <MoveToFolder
          open
          onOpenChange={(o) => !o && setMoving(null)}
          ids={moving.ids}
          brandId={moving.brandId}
          folders={foldersByBrand[moving.brandId] ?? []}
          currentFolderId={currentFolderId === undefined ? moving.folderId : currentFolderId}
          onDone={stop}
        />
      )}
    </div>
  );
}
