'use client';

import { Eye } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

/** No telemóvel, a pré-visualização abre numa janela (no computador fica ao lado do editor). */
export function PreviewSheet({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" className="lg:hidden" aria-label="Pré-visualizar">
          <Eye className="size-4" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogTitle>Pré-visualização</DialogTitle>
        <div className="space-y-3">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
