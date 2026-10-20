import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listAdAccounts, loadAdInsights } from '@/lib/ads/repo';
import type { AdStats } from '@/lib/ads/types';

const fmt = new Intl.NumberFormat('pt-PT');
const money = (v: number, currency: string) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(v);
const per = (spend: number, n: number, currency: string) => (n > 0 ? money(spend / n, currency) : '—');

function kpis(s: AdStats, currency: string) {
  return [
    { label: 'Gasto', value: money(s.spend, currency) },
    { label: 'Alcance', value: fmt.format(s.reach) },
    { label: 'Cliques na ligação', value: fmt.format(s.linkClicks) },
    { label: 'Custo por clique', value: per(s.spend, s.linkClicks, currency) },
    { label: 'Conversas iniciadas', value: fmt.format(s.conversations) },
    { label: 'Contactos (leads)', value: fmt.format(s.leads) },
  ];
}

/** Resultados dos anúncios da Meta no período (lidos na hora; não entram nos totais dos posts). */
export async function AdsSection({ db, brandId, from, to }: { db: SupabaseClient; brandId: string | null; from: string; to: string }) {
  const accounts = await listAdAccounts(db, brandId);
  if (accounts.length === 0) {
    return (
      <section aria-label="Anúncios" className="rounded-xl border bg-card p-4 text-sm shadow-xs">
        <h2 className="font-medium">Anúncios</h2>
        <p className="mt-1 text-muted-foreground">
          Ligue a conta de anúncios da Meta em <Link className="underline" href="/definicoes/contas">Definições → Contas ligadas</Link> para ver aqui o gasto e os resultados de cada campanha.
        </p>
      </section>
    );
  }
  const results = await Promise.all(accounts.map((a) => loadAdInsights(db, a.id, from, to)));

  return (
    <section aria-label="Anúncios" className="space-y-4">
      <h2 className="font-medium">Anúncios</h2>
      {accounts.map((a, i) => {
        const r = results[i];
        return (
          <div key={a.id} className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
            <p className="text-sm font-medium">{a.name}</p>
            {!r.ok ? (
              <p role="alert" className="text-sm text-destructive">{r.error}</p>
            ) : r.insights.campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem anúncios a correr neste período.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {kpis(r.insights.totals, a.currency).map((k) => (
                    <div key={k.label} className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">{k.label}</p>
                      <p className="text-lg font-semibold tabular-nums">{k.value}</p>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-muted-foreground">
                      <tr><th className="py-1">Campanha</th><th>Gasto</th><th>Alcance</th><th>Cliques</th><th>Custo/clique</th><th>Conversas</th><th>Leads</th></tr>
                    </thead>
                    <tbody>
                      {r.insights.campaigns.map((c) => (
                        <tr key={c.id} className="border-t">
                          <td className="py-1.5">{c.name}</td>
                          <td className="tabular-nums">{money(c.spend, a.currency)}</td>
                          <td className="tabular-nums">{fmt.format(c.reach)}</td>
                          <td className="tabular-nums">{fmt.format(c.linkClicks)}</td>
                          <td className="tabular-nums">{per(c.spend, c.linkClicks, a.currency)}</td>
                          <td className="tabular-nums">{fmt.format(c.conversations)}</td>
                          <td className="tabular-nums">{fmt.format(c.leads)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
