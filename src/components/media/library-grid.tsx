'use client';

import { CheckSquare, FolderInput, X } from 'lucide-react';
import { useState } from 'react';
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

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const stop = () => {
    setSelecting(false);
    setSelected([]);
  };
  const moveSelected = () => {
    const chosen = items.filter((m) => selected.includes(m.id));
    const brands = new Set(chosen.map((m) => m.brandId));
    if (brands.size !== 1) return void toast.error('Escolha ficheiros de uma só marca.');
    const folders = new Set(chosen.map((m) => m.folderId));
    setMoving({ ids: selected, brandId: chosen[0].brandId, folderId: folders.size === 1 ? chosen[0].folderId : null });
  };

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {selecting ? (
            <>
              <span className="text-sm font-medium" role="status">{selected.length} selecionados</span>
              <Button size="sm" disabled={!selected.length} onClick={moveSelected}>
                <FolderInput className="size-4" aria-hidden /> Mover para pasta…
              </Button>
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
