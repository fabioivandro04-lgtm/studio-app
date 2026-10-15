'use client';

import { BarChart3, CalendarDays, Images, Inbox, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/calendario', label: 'Calendário', icon: CalendarDays },
  { href: '/biblioteca', label: 'Biblioteca', icon: Images },
  { href: '/pendentes', label: 'Pendentes', icon: Inbox },
  { href: '/metricas', label: 'Métricas', icon: BarChart3 },
  { href: '/definicoes', label: 'Definições', icon: Settings },
] as const;

export function AppNav({ pendingCount = 0 }: { pendingCount?: number }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background md:static md:w-56 md:flex-col md:border-r md:border-t-0 md:p-3"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-xs md:flex-none md:flex-row md:gap-3 md:rounded-lg md:px-3 md:text-sm',
              active ? 'text-brand-navy md:bg-accent font-medium' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-5 md:size-4" aria-hidden />
            <span>{label}</span>
            {href === '/pendentes' && pendingCount > 0 && (
              <span className="absolute right-[22%] top-1 rounded-full bg-brand-amber px-1.5 text-[10px] font-semibold text-brand-navy md:static md:ml-auto">
                {pendingCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
