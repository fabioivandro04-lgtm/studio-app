'use client';

import { BarChart3, CalendarDays, Images, Inbox, Lightbulb, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/calendario', label: 'Calendário', icon: CalendarDays },
  { href: '/ideias', label: 'Ideias', icon: Lightbulb },
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
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card pb-[env(safe-area-inset-bottom)] md:sticky md:top-0 md:h-dvh md:w-60 md:flex-col md:gap-0.5 md:border-r md:border-t-0 md:bg-sidebar md:px-3 md:py-4"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            prefetch
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[11px] transition-colors md:flex-none md:flex-row md:gap-3 md:rounded-md md:px-3 md:py-2 md:text-sm',
              active
                ? 'font-semibold text-primary before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full before:bg-primary md:bg-sidebar-accent md:text-sidebar-accent-foreground md:before:hidden'
                : 'text-muted-foreground hover:text-foreground md:hover:bg-sidebar-accent/60',
            )}
          >
            <Icon className="size-5 md:size-4" aria-hidden />
            <span>{label}</span>
            {href === '/pendentes' && pendingCount > 0 && (
              <span className="absolute right-[22%] top-1 rounded-full bg-brand-amber px-1.5 text-[10px] font-semibold text-[#0B1F45] md:static md:ml-auto">
                {pendingCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
