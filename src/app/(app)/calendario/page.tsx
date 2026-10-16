import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { CalendarFilterBar } from '@/components/calendar/calendar-filters';
import { CalendarList } from '@/components/calendar/calendar-list';
import { InstagramGrid } from '@/components/calendar/instagram-grid';
import { CalendarView, type CalendarDeadline, type CalendarPost } from '@/components/calendar/calendar-view';
import { applyFilters, parseFilters } from '@/lib/calendar/filters';
import { freeSlotsByDay } from '@/lib/calendar/free-slots';
import { SetupChecklist } from '@/components/setup-checklist';
import { buildMonthGrid, buildWeek, shiftDate } from '@/lib/calendar/grid';
import { createServerClient } from '@/lib/db/clients';
import { listBrands, selectedBrandId } from '@/lib/db/repo/brands-repo';
import { FORMAT_PLATFORM, type Platform, type TargetFormat } from '@/lib/platforms/types';
import { formatInZone, localToUtc, utcToLocalParts } from '@/lib/time/zone';
import { cn } from '@/lib/utils';
import { cookies } from 'next/headers';
import { SETUP_COOKIE } from '@/components/setup-compact';
import { FilterButton } from '@/components/ui-x/filter-button';

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ vista?: string; data?: string; rede?: string; estado?: string }> }) {
  const sp = await searchParams;
  const view = sp.vista === 'semana' ? 'semana' : sp.vista === 'lista' ? 'lista' : sp.vista === 'grelha' ? 'grelha' : 'mes';
  const filters = parseFilters(sp);
  const db = await createServerClient();
  const brands = await listBrands(db);
  const brandId = await selectedBrandId(brands);
  const displayTz = brands.find((b) => b.id === brandId)?.timezone ?? brands[0]?.timezone ?? 'Africa/Maputo';
  const today = utcToLocalParts(new Date(), displayTz).date;
  const viewTabs = (current: string, d: string, extra = '') => (
    <div className="flex h-10 rounded-md border bg-card p-0.5 text-sm" role="tablist" aria-label="Vista">
      {(['lista', 'semana', 'mes', 'grelha'] as const).map((v) => (
        <Link key={v} role="tab" aria-selected={current === v} href={`/calendario?vista=${v}&data=${d}${v === 'grelha' ? '' : extra}`} className={cn('flex items-center rounded px-2.5 sm:px-3', current === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
          {v === 'semana' ? 'Semana' : v === 'mes' ? 'Mês' : v === 'lista' ? 'Lista' : 'Grelha'}
        </Link>
      ))}
    </div>
  );
  if (view === 'grelha') {
    const brand = brands.find((b) => b.id === brandId);
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">Grelha do Instagram</h1>
          {viewTabs('grelha', today)}
        </div>
        {brand ? <InstagramGrid brand={brand} /> : <p className="rounded-lg bg-highlight px-3 py-2 text-sm text-highlight-foreground">Escolha uma marca no topo para ver a grelha do Instagram.</p>}
      </div>
    );
  }
  const date = sp.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : today;

  const listDays = Array.from({ length: 30 }, (_, i) => new Date(Date.parse(`${date}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));
  const weeks = view === 'mes' ? buildMonthGrid(Number(date.slice(0, 4)), Number(date.slice(5, 7))) : view === 'lista' ? [listDays] : [buildWeek(date)];
  const first = weeks[0][0];
  const last = weeks.at(-1)!.at(-1)!;
  const from = localToUtc(first, '00:00', displayTz);
  const to = new Date(localToUtc(last, '00:00', displayTz).getTime() + 86_400_000 + 14 * 3_600_000); // margem para outros fusos

  let pq = db
    .from('posts')
    .select('id, brand_id, internal_title, scheduled_at, status, origin, post_targets(format), post_media(position, media_assets(storage_path, thumbnail_path, kind))')
    .gte('scheduled_at', new Date(from.getTime() - 14 * 3_600_000).toISOString())
    .lt('scheduled_at', to.toISOString());
  if (brandId) pq = pq.eq('brand_id', brandId);
  let dq = db.from('deadlines').select('id, brand_id, title, due_date').gte('due_date', first).lte('due_date', last);
  if (brandId) dq = dq.eq('brand_id', brandId);
  const head = { count: 'exact' as const, head: true };
  const [{ data: rows }, { data: dls }, accounts, media, allPosts] = await Promise.all([
    pq,
    dq,
    db.from('social_accounts').select('id', head).eq('status', 'active'),
    db.from('media_assets').select('id', head),
    db.from('posts').select('id', head),
  ]);
  const progress = { brands: brands.length, accounts: accounts.count ?? 0, media: media.count ?? 0, posts: allPosts.count ?? 0 };

  type Row = {
    id: string; brand_id: string; internal_title: string; scheduled_at: string; status: CalendarPost['status']; origin: string | null;
    post_targets: { format: TargetFormat }[];
    post_media: { position: number; media_assets: { storage_path: string; thumbnail_path: string | null; kind: string } | null }[];
  };
  const thumbPaths = (rows as Row[] | null ?? []).map((r) => {
    const m = [...r.post_media].sort((a, b) => a.position - b.position)[0]?.media_assets;
    return m ? (m.thumbnail_path ?? (m.kind === 'image' ? m.storage_path : null)) : null;
  });
  const signed = new Map<string, string>();
  const wanted = thumbPaths.filter((p): p is string => !!p);
  if (wanted.length) {
    const { data } = await db.storage.from('media').createSignedUrls(wanted, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }

  const loaded: CalendarPost[] = (rows as Row[] | null ?? []).map((r, i) => {
    const b = brands.find((x) => x.id === r.brand_id)!;
    const local = utcToLocalParts(new Date(r.scheduled_at), b.timezone);
    return {
      id: r.id, day: local.date, time: local.time, title: r.internal_title, status: r.status,
      brandColor: b.color, brandName: b.name,
      platforms: [...new Set(r.post_targets.map((t) => FORMAT_PLATFORM[t.format]))] as Platform[],
      thumbUrl: thumbPaths[i] ? (signed.get(thumbPaths[i]!) ?? null) : null,
      movable: r.status === 'draft' || r.status === 'scheduled',
      byClaude: r.origin === 'claude',
    };
  });
  const posts = applyFilters(loaded, filters);
  // Horários fixos livres (só com uma marca escolhida: cada marca tem os seus).
  const selectedBrand = brands.find((b) => b.id === brandId);
  const busy = (rows as Row[] | null ?? []).filter((r) => r.status !== 'cancelled').map((r) => new Date(r.scheduled_at));
  const freeSlots = selectedBrand ? freeSlotsByDay({ slots: selectedBrand.postingSlots, tz: selectedBrand.timezone, days: weeks.flat(), busy, now: new Date() }) : {};
  const deadlines: CalendarDeadline[] = (dls ?? []).map((d) => ({
    id: d.id, day: String(d.due_date).slice(0, 10), title: d.title, brandColor: brands.find((b) => b.id === d.brand_id)?.color ?? '#F0A93B',
  }));

  const keep = (filters.platforms.length ? `&rede=${filters.platforms.join(',')}` : '') + (filters.statuses.length ? `&estado=${filters.statuses.join(',')}` : '');
  const nav = (n: number) => `/calendario?vista=${view}&data=${shiftDate(date, view === 'lista' ? 'mes' : view, n)}${keep}`;
  const rawHeading = view === 'mes' ? formatInZone(localToUtc(date, '12:00', displayTz), displayTz, "MMMM 'de' yyyy") : view === 'lista' ? `A partir de ${formatInZone(localToUtc(first, '12:00', displayTz), displayTz, "d 'de' MMMM")}` : `Semana de ${formatInZone(localToUtc(first, '12:00', displayTz), displayTz, "d 'de' MMMM")}`;
  const heading = rawHeading.charAt(0).toUpperCase() + rawHeading.slice(1);

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <SetupChecklist progress={progress} dismissed={(await cookies()).get(SETUP_COOKIE)?.value === '1'} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Link href={nav(-1)} className="rounded-md p-2 hover:bg-accent" aria-label="Anterior"><ChevronLeft className="size-4" /></Link>
          <h1 className="min-w-40 text-center text-lg font-semibold">{heading}</h1>
          <Link href={nav(1)} className="rounded-md p-2 hover:bg-accent" aria-label="Seguinte"><ChevronRight className="size-4" /></Link>
          <Link href={`/calendario?vista=${view}${keep}`} className="ml-1 rounded-md border px-2 py-1 text-sm hover:bg-accent">Hoje</Link>
        </div>
        <div className="flex items-center gap-2">
          {viewTabs(view, date, keep)}
          <FilterButton count={filters.platforms.length + filters.statuses.length}>
            <CalendarFilterBar base={{ vista: view, data: sp.data }} filters={filters} />
          </FilterButton>
          <Link href="/posts/novo" className="hidden h-10 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 md:flex"><Plus className="size-4" aria-hidden /> Novo post</Link>
        </div>
      </div>
      <Link href="/posts/novo" aria-label="Novo post" className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden">
        <Plus className="size-6" aria-hidden />
      </Link>
      {view === 'lista' ? (
        <CalendarList days={listDays} today={today} posts={posts} deadlines={deadlines} freeSlots={freeSlots} />
      ) : (
        <CalendarView weeks={weeks} month={view === 'mes' ? Number(date.slice(5, 7)) : null} today={today} posts={posts} deadlines={deadlines} freeSlots={freeSlots} />
      )}
    </div>
  );
}
