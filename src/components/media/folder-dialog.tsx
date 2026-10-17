'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createFolder, updateFolder } from '@/app/(app)/biblioteca/actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { callSafely } from '@/lib/ai/call-safely';

/** Criar pasta (com `brandId`) ou editar a pasta `folder`. */
export function FolderDialog({ brandId, folder, trigger }: {
  brandId?: string;
  folder?: { id: string; name: string; notes: string };
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(folder?.name ?? '');
  const [notes, setNotes] = useState(folder?.notes ?? '');
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      if (folder) {
        const r = await callSafely(() => updateFolder({ id: folder.id, name, notes }));
        if (!r.ok) return void toast.error(r.error);
        setOpen(false);
        toast.success('Pasta guardada.');
        router.refresh();
        return;
      }
      const r = await callSafely(() => createFolder({ brandId: brandId!, name, notes }));
      if (!r.ok) return void toast.error(r.error);
      setOpen(false);
      setName('');
      setNotes('');
      router.push(`/biblioteca?pasta=${r.id}`);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{folder ? 'Editar pasta' : 'Nova pasta'}</DialogTitle>
          <DialogDescription>Junte os ficheiros do mesmo tema, por exemplo as fotos de um carrossel.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="folder-name">Nome</Label>
            <Input id="folder-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Prazos Portugal 2027" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="folder-notes">Tema e abordagem</Label>
            <Textarea id="folder-notes" value={notes} maxLength={2000} rows={4} onChange={(e) => setNotes(e.target.value)} placeholder="Do que trata, para quem e como foi abordado." />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim()}>{folder ? 'Guardar' : 'Criar pasta'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
