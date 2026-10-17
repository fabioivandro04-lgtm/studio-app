'use client';

import { Folder, FolderPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ensureFolder, moveMedia } from '@/app/(app)/biblioteca/actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { callSafely } from '@/lib/ai/call-safely';

export type FolderOption = { id: string; name: string };

/** Janela "Mover para pasta": pastas da marca, nova pasta ou tirar da pasta. */
export function MoveToFolder({ open, onOpenChange, ids, brandId, folders, currentFolderId, onDone }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ids: string[];
  brandId: string;
  folders: FolderOption[];
  currentFolderId?: string | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [pending, start] = useTransition();
  const n = ids.length;

  const move = (folderId: string | null, label: string) =>
    start(async () => {
      const r = await callSafely(() => moveMedia({ ids, folderId }));
      if (!r.ok) return void toast.error(r.error);
      toast.success(folderId ? `${n === 1 ? 'Ficheiro movido' : `${n} ficheiros movidos`} para «${label}».` : 'Tirado da pasta.');
      onOpenChange(false);
      onDone?.();
      router.refresh();
    });

  const createAndMove = () =>
    start(async () => {
      const f = await callSafely(() => ensureFolder({ brandId, name }));
      if (!f.ok) return void toast.error(f.error);
      const r = await callSafely(() => moveMedia({ ids, folderId: f.id }));
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${n === 1 ? 'Ficheiro movido' : `${n} ficheiros movidos`} para «${name.trim()}».`);
      setName('');
      onOpenChange(false);
      onDone?.();
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mover para pasta</DialogTitle>
          <DialogDescription>{n === 1 ? '1 ficheiro' : `${n} ficheiros`}. Cada ficheiro fica só numa pasta.</DialogDescription>
        </DialogHeader>
        {folders.length > 0 && (
          <ul className="max-h-64 space-y-1 overflow-y-auto" aria-label="Pastas">
            {folders.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  disabled={pending || f.id === currentFolderId}
                  onClick={() => move(f.id, f.name)}
                  className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm hover:bg-accent disabled:opacity-50"
                >
                  <Folder className="size-4 text-muted-foreground" aria-hidden />
                  <span className="truncate">{f.name}</span>
                  {f.id === currentFolderId && <span className="ml-auto text-xs text-muted-foreground">Atual</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="space-y-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) createAndMove();
          }}
        >
          <Label htmlFor="move-new-folder">Nova pasta</Label>
          <div className="flex gap-2">
            <Input id="move-new-folder" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Nome da pasta" />
            <Button type="submit" disabled={pending || !name.trim()}>
              <FolderPlus className="size-4" aria-hidden /> Criar e mover
            </Button>
          </div>
        </form>
        {currentFolderId !== undefined && currentFolderId !== null && (
          <Button variant="outline" disabled={pending} onClick={() => move(null, '')}>Tirar da pasta</Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
