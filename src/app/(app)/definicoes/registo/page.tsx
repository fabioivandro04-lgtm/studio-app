import Link from 'next/link';
import { createServerClient } from '@/lib/db/clients';
import { listBrands, selectedBrandId } from '@/lib/db/repo/brands-repo';
import { fromActivityRow } from '@/lib/db/types';
import { formatInZone } from '@/lib/time/zone';
import { cn } from '@/lib/utils';

const LEVELS = { info: 'Info', warn: 'Aviso', error: 'Erro' } as const;
const LEVEL_CLASS = { info: 'bg-[var(--st-draft-bg)] text-[var(--st-draft-fg)]', warn: 'bg-[var(--st-action-bg)] text-[var(--st-action-fg)]', error: 'bg-[var(--st-failed-bg)] text-[var(--st-failed-fg)]' } as const;

export default async function RegistoPage({ searchParams }: { searchParams: Promise<{ nivel?: string }> }) {
  const { nivel } = await searchParams;
  const level = nivel && nivel in LEVELS ? (nivel as keyof typeof LEVELS) : null;
  const db = await createServerClient();
  const brands = await listBrands(db);
  const brandId = await selectedBrandId(brands);
  let q = db.from('activity_log').select('*').order('created_at', { ascending: false }).limit(200);
  if (brandId) q = q.eq('brand_id', brandId);
  if (level) q = q.eq('level', level);
  const { data } = await q;
  const entries = (data ?? []).map(fromActivityRow);
  const tz = brands.find((b) => b.id === brandId)?.timezone ?? brands[0]?.timezone ?? 'Africa/Maputo';

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Registo de atividade</h1>
      <nav aria-label="Nível" className="flex gap-2 text-sm">
        <Link href="/definicoes/registo" className={cn('rounded-md border px-3 py-1', !level && 'bg-primary text-primary-foreground')}>Tudo</Link>
        {(Object.keys(LEVELS) as (keyof typeof LEVELS)[]).map((l) => (
          <Link key={l} href={`/definicoes/registo?nivel=${l}`} className={cn('rounded-md border px-3 py-1', level === l && 'bg-primary text-primary-foreground')}>{LEVELS[l]}</Link>
        ))}
      </nav>
      <ul className="divide-y rounded-xl border">
        {entries.length === 0 && <li className="p-4 text-sm text-muted-foreground">Sem eventos.</li>}
        {entries.map((e) => (
          <li key={e.id} className="space-y-1 px-4 py-2 text-sm" data-testid="log-entry">
            <p className="flex flex-wrap items-center gap-2">
              <span className={cn('rounded px-1.5 text-xs', LEVEL_CLASS[e.level])}>{LEVELS[e.level]}</span>
              <span className="text-xs text-muted-foreground">{formatInZone(e.createdAt, tz, 'd MMM HH:mm')} · {e.source}</span>
            </p>
            <p>{e.message}</p>
            {e.context != null && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Detalhes</summary>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(e.context, null, 2)}</pre>
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
