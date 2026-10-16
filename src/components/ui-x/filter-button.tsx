'use client';

import { SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** Botão "Filtros (N)" que abre os filtros num painel. */
export function FilterButton({ count, children }: { count: number; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-10 gap-2 bg-card">
          <SlidersHorizontal className="size-4" aria-hidden />
          Filtros{count > 0 ? ` (${count})` : ''}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-3">{children}</PopoverContent>
    </Popover>
  );
}
