import { Plus } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Horário fixo livre: um toque abre o editor com esse dia e hora. */
export function FreeSlot({ day, time, large = false }: { day: string; time: string; large?: boolean }) {
  return (
    <Link
      href={`/posts/novo?data=${day}&hora=${time}`}
      prefetch={false}
      data-testid="free-slot"
      aria-label={`Criar post em ${day} às ${time} (horário livre)`}
      className={cn(
        'flex items-center gap-1 rounded-md border border-dashed border-input text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-accent-foreground',
        large ? 'px-2.5 py-2 text-sm' : 'px-1.5 py-1 text-[11px]',
      )}
    >
      <Plus className={large ? 'size-4' : 'size-3'} aria-hidden />
      <span className="tabular-nums">{time}</span>
    </Link>
  );
}
