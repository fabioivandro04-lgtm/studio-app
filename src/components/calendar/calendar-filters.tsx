import Link from 'next/link';
import { PlatformIcon } from '@/components/platform-icon';
import { POST_STATUS_LABEL } from '@/lib/calendar/status';
import { FILTER_PLATFORMS, FILTER_STATUSES, filterHref, type CalendarFilters } from '@/lib/calendar/filters';
import { PLATFORM_LABEL } from '@/lib/platforms/types';
import { cn } from '@/lib/utils';

const chip = (on: boolean) =>
  cn('flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent');

/** Filtros por rede e estado (ficam na URL). */
export function CalendarFilterBar({ base, filters }: { base: { vista?: string; data?: string }; filters: CalendarFilters }) {
  const any = filters.platforms.length + filters.statuses.length > 0;
  return (
    <nav aria-label="Filtros" className="flex flex-wrap items-center gap-1.5">
      {FILTER_PLATFORMS.map((p) => (
        <Link key={p} href={filterHref(base, filters, 'rede', p)} aria-pressed={filters.platforms.includes(p)} className={chip(filters.platforms.includes(p))}>
          <PlatformIcon platform={p} size="sm" /> {PLATFORM_LABEL[p]}
        </Link>
      ))}
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      {FILTER_STATUSES.map((s) => (
        <Link key={s} href={filterHref(base, filters, 'estado', s)} aria-pressed={filters.statuses.includes(s)} className={chip(filters.statuses.includes(s))}>
          {POST_STATUS_LABEL[s]}
        </Link>
      ))}
      {any && (
        <Link href={filterHref(base, { platforms: [], statuses: [] }, 'rede', '')} className="ml-1 text-xs text-muted-foreground underline">
          Limpar filtros
        </Link>
      )}
    </nav>
  );
}
