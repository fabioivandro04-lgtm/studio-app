'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ALL_BRANDS, BRAND_COOKIE } from '@/lib/db/repo/brand-cookie';
import { cn } from '@/lib/utils';

type B = { id: string; name: string; color: string };

const Dot = ({ color }: { color: string | null }) =>
  color ? <span className="size-2.5 shrink-0 rounded-full ring-1 ring-border" style={{ background: color }} aria-hidden /> : <span className="size-2.5 shrink-0 rounded-full border border-dashed border-muted-foreground" aria-hidden />;

function setBrandCookie(v: string) {
  document.cookie = `${BRAND_COOKIE}=${v}; path=/; max-age=31536000; samesite=lax`;
}

/** Seletor de marca do cabeçalho: bolinha da cor + nome; "Todas as marcas" no topo. */
export function BrandSwitcher({ brands, selected }: { brands: B[]; selected: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const current = brands.find((b) => b.id === selected) ?? null;
  const pick = (v: string) => {
    setBrandCookie(v);
    setOpen(false);
    start(() => router.refresh());
  };
  const items: { value: string; label: string; color: string | null }[] = [
    { value: ALL_BRANDS, label: 'Todas as marcas', color: null },
    ...brands.map((b) => ({ value: b.id, label: b.name, color: b.color })),
  ];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Marca"
          disabled={pending}
          className="flex h-10 max-w-52 items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium hover:bg-accent disabled:opacity-60"
        >
          <Dot color={current?.color ?? null} />
          <span className="truncate">{current?.name ?? 'Todas as marcas'}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1">
        <ul role="listbox" aria-label="Marcas">
          {items.map((it) => {
            const active = (selected ?? ALL_BRANDS) === it.value;
            return (
              <li key={it.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(it.value)}
                  className={cn('flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-accent', active && 'font-medium')}
                >
                  <Dot color={it.color} />
                  <span className="flex-1 truncate">{it.label}</span>
                  {active && <Check className="size-4 text-primary" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
