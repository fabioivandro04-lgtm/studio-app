import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { AdsSection } from '@/components/metrics/ads-section';
import { FollowersChart } from '@/components/metrics/followers-chart';
import { PlatformIcon } from '@/components/platform-icon';
import { createServerClient } from '@/lib/db/clients';
import { listBrands, selectedBrandId } from '@/lib/db/repo/brands-repo';
import { fromAccountMetricsRow } from '@/lib/db/types';
import { followerSeries, followersGained, summarize, type MetricRow } from '@/lib/metrics/summary';
import { PLATFORM_LABEL, type Platform } from '@/lib/platforms/types';
import { PageHeader } from '@/components/ui-x/page-header';
import { hasPostMetrics, showFollowersChart } from '@/lib/ui/metrics-empty';
import { cn } from '@/lib/utils';

const PERIODS = [7, 30, 90] as const;
const fmt = new Intl.NumberFormat('pt-PT');

function periodRange(days: number, now: Date) {
  return { from: new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function MetricasPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias } = await searchParams;
  const days = PERIODS.includes(Number(dias) as 7) ? Number(dias) : 30;
  const { from, to } = periodRange(days, new Date());

  const db = await createServerClient();
  const brands = await listBrands(db);
  const brandId = await selectedBrandId(brands);

  const [{ data: pm }, { data: am }, { data: accts }] = await Promise.all([
    db.from('post_metrics')
      .select('post_target_id, collected_on, views, reach, likes, comments, shares, saves, watch_time_s, post_targets!inner(permalink, social_accounts!inner(platform, handle, brand_id), posts!inner(internal_title, brand_id))')
      .gte('collected_on', from),
    db.from('account_metrics').select('social_account_id, collected_on, followers, views').gte('collected_on', from),
    db.from('social_accounts').select('id, brand_id, platform, handle').neq('status', 'disabled'),
  ]);

  const accounts = (accts ?? []).filter((a) => !brandId || a.brand_id === brandId);
  const accountIds = new Set(accounts.map((a) => a.id));
  const metricRows = ((pm ?? []) as any[]).filter((r) => !brandId || r.post_targets.posts.brand_id === brandId);
  const rows: MetricRow[] = metricRows.map((r) => ({
    targetId: r.post_target_id, platform: r.post_targets.social_accounts.platform as Platform, collectedOn: String(r.collected_on).slice(0, 10),
    views: r.views, reach: r.reach, likes: r.likes, comments: r.comments, shares: r.shares, saves: r.saves, watchTimeS: r.watch_time_s,
  }));
  const info = new Map(metricRows.map((r) => [r.post_target_id, { title: r.post_targets.posts.internal_title as string, permalink: r.post_targets.permalink as string | null, handle: r.post_targets.social_accounts.handle as string }]));
  const { totals, byPlatform, latestPerTarget } = summarize(rows, from, to);
  const accountRows = (am ?? []).map(fromAccountMetricsRow).filter((r) => accountIds.has(r.socialAccountId));
  const series = accounts.map((a) => ({ key: a.id, label: `${PLATFORM_LABEL[a.platform as Platform]} @${a.handle.replace(/^@/, '')}` }));
  const perPost = [...latestPerTarget.values()].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));

  const kpis = [
    { label: 'Visualizações', value: totals.views },
    { label: 'Alcance', value: totals.reach },
    { label: 'Gostos', value: totals.likes },
    { label: 'Guardados', value: totals.saves },
    { label: 'Partilhas', value: totals.shares },
    { label: 'Seguidores ganhos', value: followersGained(accountRows) },
  ];

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Métricas" description="Resultados das suas redes, recolhidos 1 vez por dia." />
        <EmptyState
          icon={BarChart3}
          title="Ainda sem redes ligadas"
          text="Ligue o Instagram, TikTok ou YouTube. A app recolhe as visualizações, gostos e seguidores 1 vez por dia."
          action={{ href: '/definicoes/contas', label: 'Ligar uma rede' }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Métricas" description="Resultados das suas redes, recolhidos 1 vez por dia." actions={
        <nav aria-label="Período" className="flex h-10 rounded-md border bg-card p-0.5 text-sm">
            {PERIODS.map((p) => (
              <Link key={p} href={`/metricas?dias=${p}`} aria-current={days === p ? 'page' : undefined} className={cn('flex items-center rounded px-3', days === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>
                {p} dias
              </Link>
            ))}
          </nav>
      } />

      {!hasPostMetrics(rows) && (
        <div className="rounded-xl border bg-card p-4 text-sm shadow-xs" data-testid="metrics-empty">
          <p className="font-medium">Ainda sem números dos seus posts.</p>
          <p className="mt-1 text-muted-foreground">Os números aparecem 1 dia depois do primeiro post publicado e atualizam-se todos os dias.</p>
        </div>
      )}
      {hasPostMetrics(rows) && <>
      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border p-3" data-testid="kpi">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-2xl font-semibold tabular-nums">{fmt.format(k.value)}</p>
          </div>
        ))}
      </section>

      <section aria-label="Por rede" className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(byPlatform) as Platform[]).map((p) => (
          <div key={p} className="rounded-xl border p-3 text-sm">
            <p className="flex items-center gap-2 font-medium"><PlatformIcon platform={p} size="sm" />{PLATFORM_LABEL[p]}</p>
            <p className="text-muted-foreground">{fmt.format(byPlatform[p].views)} visualizações · {fmt.format(byPlatform[p].likes)} gostos</p>
          </div>
        ))}
      </section>
      </>}

      <section aria-label="Seguidores" className="space-y-2 rounded-xl border bg-card p-4 shadow-xs">
        <h2 className="font-medium">Seguidores</h2>
        {showFollowersChart(followerSeries(accountRows)) ? (
          <FollowersChart data={followerSeries(accountRows)} series={series} />
        ) : (
          <p className="text-sm text-muted-foreground">O gráfico aparece a partir do segundo dia de dados. Por agora: {series.map((x) => {
            const last = [...followerSeries(accountRows)].pop();
            return `${x.label}: ${last && last[x.key] != null ? fmt.format(Number(last[x.key])) : '—'}`;
          }).join(' · ')}.</p>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Ver tabela</summary>
          <table className="mt-2 w-full text-left">
            <thead><tr className="text-muted-foreground"><th className="py-1">Dia</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
            <tbody>
              {followerSeries(accountRows).map((r) => (
                <tr key={String(r.day)} className="border-t"><td className="py-1">{String(r.day)}</td>{series.map((s) => <td key={s.key} className="tabular-nums">{r[s.key] != null ? fmt.format(Number(r[s.key])) : '—'}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section aria-label="Melhores posts" className="space-y-2">
        <h2 className="font-medium">Melhores posts</h2>
        {perPost.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda sem métricas de posts neste período.</p>
        ) : (
          <ol className="space-y-1" data-testid="top-posts">
            {perPost.slice(0, 5).map((r, i) => {
              const p = info.get(r.targetId)!;
              return (
                <li key={r.targetId} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <span className="w-5 font-semibold text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate">{p.title || 'Sem título'} <span className="text-muted-foreground">· {PLATFORM_LABEL[r.platform]} @{p.handle.replace(/^@/, '')}</span></span>
                  <span className="tabular-nums">{fmt.format(r.views ?? 0)} vis.</span>
                  {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" className="underline">abrir</a>}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {perPost.length > 0 && (
        <section aria-label="Todos os posts" className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr><th className="py-1">Post</th><th>Rede</th><th>Visualizações</th><th>Alcance</th><th>Gostos</th><th>Comentários</th><th>Partilhas</th><th>Guardados</th></tr>
            </thead>
            <tbody>
              {perPost.map((r) => (
                <tr key={r.targetId} className="border-t">
                  <td className="py-1.5">{info.get(r.targetId)?.title || 'Sem título'}</td>
                  <td>{PLATFORM_LABEL[r.platform]}</td>
                  {(['views', 'reach', 'likes', 'comments', 'shares', 'saves'] as const).map((k) => (
                    <td key={k} className="tabular-nums">{r[k] == null ? '—' : fmt.format(r[k]!)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <AdsSection db={db} brandId={brandId} from={from} to={to} />
    </div>
  );
}
