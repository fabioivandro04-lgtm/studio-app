import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { CalendarView, type CalendarDeadline, type CalendarPost } from '@/components/calendar/calendar-view';
import { buildMonthGrid, buildWeek, shiftDate } from '@/lib/calendar/grid';
import { createServerClient } from '@/lib/db/clients';
import { listBrands, selectedBrandId } from '@/lib/db/repo/brands-repo';
import { FORMAT_PLATFORM, type Platform, type TargetFormat } from '@/lib/platforms/types';
import { formatInZone, localToUtc, utcToLocalParts } from '@/lib/time/zone';
import { cn } from '@/lib/utils';

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ vista?: string; data?: string }> }) {
  const sp = await searchParams;
  const view = sp.vista === 'semana' ? 'semana' : 'mes';
  const db = await createServerClient();
  const brands = await listBrands(db);
  const brandId = await selectedBrandId(brands);
  const displayTz = brands.find((b) => b.id === brandId)?.timezone ?? brands[0]?.timezone ?? 'Africa/Maputo';
  const today = utcToLocalParts(new Date(), displayTz).date;
  const date = sp.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : today;

  const weeks = view === 'mes' ? buildMonthGrid(Number(date.slice(0, 4)), Number(date.slice(5, 7))) : [buildWeek(date)];
  const first = weeks[0][0];
  const last = weeks.at(-1)!.at(-1)!;
  const from = localToUtc(first, '00:00', displayTz);
  const to = new Date(localToUtc(last, '00:00', displayTz).getTime() + 86_400_000 + 14 * 3_600_000); // margem para outros fusos

  let pq = db
    .from('posts')
    .select('id, brand_id, internal_title, scheduled_at, status, post_targets(format), post_media(position, media_assets(storage_path, thumbnail_path, kind))')
    .gte('scheduled_at', new Date(from.getTime() - 14 * 3_600_000).toISOString())
    .lt('scheduled_at', to.toISOString());
  if (brandId) pq = pq.eq('brand_id', brandId);
  let dq = db.from('deadlines').select('id, brand_id, title, due_date').gte('due_date', first).lte('due_date', last);
  if (brandId) dq = dq.eq('brand_id', brandId);
  const [{ data: rows }, { data: dls }] = await Promise.all([pq, dq]);

  type Row = {
    id: string; brand_id: string; internal_title: string; scheduled_at: string; status: CalendarPost['status'];
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

  const posts: CalendarPost[] = (rows as Row[] | null ?? []).map((r, i) => {
    const b = brands.find((x) => x.id === r.brand_id)!;
    const local = utcToLocalParts(new Date(r.scheduled_at), b.timezone);
    return {
      id: r.id, day: local.date, time: local.time, title: r.internal_title, status: r.status,
      brandColor: b.color, brandName: b.name,
      platforms: [...new Set(r.post_targets.map((t) => FORMAT_PLATFORM[t.format]))] as Platform[],
      thumbUrl: thumbPaths[i] ? (signed.get(thumbPaths[i]!) ?? null) : null,
      movable: r.status === 'draft' || r.status === 'scheduled',
    };
  });
  const deadlines: CalendarDeadline[] = (dls ?? []).map((d) => ({
    id: d.id, day: String(d.due_date).slice(0, 10), title: d.title, brandColor: brands.find((b) => b.id === d.brand_id)?.color ?? '#F0A93B',
  }));

  const nav = (n: number) => `/calendario?vista=${view}&data=${shiftDate(date, view, n)}`;
  const heading = view === 'mes' ? formatInZone(localToUtc(date, '12:00', displayTz), displayTz, "MMMM 'de' yyyy") : `Semana de ${formatInZone(localToUtc(first, '12:00', displayTz), displayTz, "d 'de' MMMM")}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Link href={nav(-1)} className="rounded-md p-2 hover:bg-accent" aria-label="Anterior"><ChevronLeft className="size-4" /></Link>
          <h1 className="min-w-44 text-center text-lg font-semibold capitalize">{heading}</h1>
          <Link href={nav(1)} className="rounded-md p-2 hover:bg-accent" aria-label="Seguinte"><ChevronRight className="size-4" /></Link>
          <Link href={`/calendario?vista=${view}`} className="ml-1 rounded-md border px-2 py-1 text-sm hover:bg-accent">Hoje</Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border text-sm" role="tablist" aria-label="Vista">
            {(['semana', 'mes'] as const).map((v) => (
              <Link key={v} role="tab" aria-selected={view === v} href={`/calendario?vista=${v}&data=${date}`} className={cn('px-3 py-1', view === v && 'bg-brand-navy text-white')}>
                {v === 'semana' ? 'Semana' : 'Mês'}
              </Link>
            ))}
          </div>
          <Link href="/posts/novo" className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"><Plus className="size-4" /> Novo post</Link>
        </div>
      </div>
      <CalendarView weeks={weeks} month={view === 'mes' ? Number(date.slice(5, 7)) : null} today={today} posts={posts} deadlines={deadlines} />
    </div>
  );
}
