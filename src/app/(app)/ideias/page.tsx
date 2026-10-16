import { Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { GenerateBar } from '@/components/ideas/generate-bar';
import { IdeaCard, type IdeaCardData } from '@/components/ideas/idea-card';
import { PickBrand } from '@/components/ideas/pick-brand';
import { PageHeader } from '@/components/ui-x/page-header';
import { createServerClient } from '@/lib/db/clients';
import { listBrands, selectedBrandId } from '@/lib/db/repo/brands-repo';
import { countIdeas, listIdeas, upcomingDeadlines, type IdeaStatus } from '@/lib/db/repo/ideas-repo';
import { formatInZone, utcToLocalParts } from '@/lib/time/zone';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Ideias — Estúdio' };
// A geração de ideias (server actions desta página) pode demorar até ~45 s.
export const maxDuration = 60;

const TABS: { key: IdeaStatus; label: string; param: string }[] = [
  { key: 'new', label: 'Novas', param: 'novas' },
  { key: 'used', label: 'Usadas', param: 'usadas' },
  { key: 'discarded', label: 'Descartadas', param: 'descartadas' },
];

export default async function IdeiasPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  const tab = TABS.find((t) => t.param === estado) ?? TABS[0];
  const db = await createServerClient();
  const brands = await listBrands(db);
  const brandId = await selectedBrandId(brands);
  const brand = brands.find((b) => b.id === brandId) ?? null;
  const [ideas, counts, deadlines] = await Promise.all([
    listIdeas(db, brandId, tab.key),
    countIdeas(db, brandId),
    brand ? upcomingDeadlines(db, brand.id, utcToLocalParts(new Date(), brand.timezone).date, '9999-12-31') : Promise.resolve([]),
  ]);

  const cards: IdeaCardData[] = ideas.map((i) => {
    const b = brands.find((x) => x.id === i.brandId);
    const tz = b?.timezone ?? 'Africa/Maputo';
    const when = i.suggestedAt ? formatInZone(i.suggestedAt, tz, "EEE, d MMM 'às' HH:mm") : null;
    return {
      id: i.id, title: i.title, hook: i.hook, outline: i.outline, caption: i.caption, format: i.format, platforms: i.platforms,
      status: i.status, whenLabel: when ? when.charAt(0).toUpperCase() + when.slice(1) : null, deadlineTitle: i.deadlineTitle,
      postId: i.postId, brandName: b?.name ?? '', brandColor: b?.color ?? '#999999',
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader title="Ideias" description="A IA propõe temas, ganchos e guiões. Escolha as que quer e ponha-as no calendário." />
      {brand ? (
        <GenerateBar key={brand.id} brandId={brand.id} deadlines={deadlines.map(({ id, title, dueDate }) => ({ id, title, dueDate }))} />
      ) : (
        <PickBrand brands={brands.map((b) => ({ id: b.id, name: b.name, color: b.color }))} />
      )}
      <nav aria-label="Estado" className="flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/ideias?estado=${t.param}`}
            aria-current={t.key === tab.key ? 'page' : undefined}
            className={cn('flex min-h-9 items-center rounded-md border px-3 text-sm', t.key === tab.key ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent')}
          >
            {t.label} ({counts[t.key]})
          </Link>
        ))}
      </nav>
      {cards.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title={tab.key === 'new' ? 'Ainda sem ideias' : tab.key === 'used' ? 'Nenhuma ideia usada' : 'Nenhuma ideia descartada'}
          text={tab.key === 'new' ? 'Use os botões acima: ideias para um prazo, vídeos curtos ou o plano da próxima semana.' : undefined}
        />
      ) : (
        <ul className="space-y-3">{cards.map((c) => <IdeaCard key={c.id} idea={c} />)}</ul>
      )}
    </div>
  );
}
