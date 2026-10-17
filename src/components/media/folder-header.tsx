'use client';

import { ArrowLeft, Pencil, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { deleteFolder } from '@/app/(app)/biblioteca/actions';
import { Button } from '@/components/ui/button';
import { callSafely } from '@/lib/ai/call-safely';
import { FolderDialog } from './folder-dialog';

/** Cabeçalho de uma pasta aberta: nome, tema, criar post, editar, apagar. */
export function FolderHeader({ folder, mediaIds }: { folder: { id: string; name: string; notes: string }; mediaIds: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const remove = () => {
    if (!confirm('Apagar a pasta? Os ficheiros passam para Sem pasta. Nada é apagado.')) return;
    start(async () => {
      const r = await callSafely(() => deleteFolder(folder.id));
      if (!r.ok) return void toast.error(r.error);
      toast.success('Pasta apagada. Os ficheiros estão em Sem pasta.');
      router.push('/biblioteca');
    });
  };
  return (
    <div className="space-y-3">
      <Link href="/biblioteca" className="inline-flex min-h-8 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Biblioteca
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold">{folder.name}</h1>
          <p className="max-w-2xl whitespace-pre-line text-sm text-muted-foreground">{folder.notes || 'Sem tema e abordagem. Use "Editar" para descrever esta pasta.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mediaIds.length > 0 && (
            <Button asChild size="sm">
              <Link href={`/posts/novo?midia=${mediaIds.join(',')}`}><Send className="size-4" aria-hidden /> Criar post com estes ficheiros</Link>
            </Button>
          )}
          <FolderDialog folder={folder} trigger={<Button size="sm" variant="outline"><Pencil className="size-4" aria-hidden /> Editar</Button>} />
          <Button size="sm" variant="outline" className="text-destructive" disabled={pending} onClick={remove}>
            <Trash2 className="size-4" aria-hidden /> Apagar pasta
          </Button>
        </div>
      </div>
    </div>
  );
}
