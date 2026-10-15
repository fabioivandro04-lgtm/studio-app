'use client';

import { PenLine } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { callSafely } from '@/lib/ai/call-safely';
import { refineCaption } from '@/app/(app)/ai/actions';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { RefineAction } from '@/lib/ai/types';
import { PLATFORM_LABEL, type Platform } from '@/lib/platforms/types';

const ACTIONS: { action: RefineAction; label: string }[] = [
  { action: 'shorten', label: 'Encurtar' },
  { action: 'catchy', label: 'Mais chamativo' },
  { action: 'professional', label: 'Mais profissional' },
  { action: 'cta', label: 'Adicionar chamada para ação' },
  { action: 'english', label: 'Traduzir para inglês' },
];

/** Menu "Reescrever" junto à legenda: só substitui o texto quando a IA responde com sucesso. */
export function RefineMenu({ brandId, platform, text, onReplace }: { brandId: string; platform: Platform; text: string; onReplace(next: string): void }) {
  const [pending, start] = useTransition();
  const run = (action: RefineAction) =>
    start(async () => {
      const r = await callSafely(() => refineCaption({ brandId, platform, text, action }));
      if (r.ok) onReplace(r.text);
      else toast.error(r.error);
    });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" disabled={pending} aria-label={`Reescrever com IA — ${PLATFORM_LABEL[platform]}`}>
          <PenLine className="size-4" aria-hidden /> {pending ? 'A reescrever…' : 'Reescrever'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {ACTIONS.map((a) => (
          <DropdownMenuItem key={a.action} onSelect={() => run(a.action)}>
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
