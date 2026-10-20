import { Megaphone } from 'lucide-react';
import { PlatformIcon } from '@/components/platform-icon';
import { listAdAccounts } from '@/lib/ads/repo';
import { createServerClient } from '@/lib/db/clients';
import { listBrands } from '@/lib/db/repo/brands-repo';
import { fromAccountRow } from '@/lib/db/types';
import { PLATFORM_LABEL, type Platform } from '@/lib/platforms/types';
import { formatInZone } from '@/lib/time/zone';
import { DisconnectButton } from './disconnect-button';
import { PageHeader } from '@/components/ui-x/page-header';

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube'];
const STATUS_LABEL = { active: 'Ligada', needs_reauth: 'Volte a ligar', disabled: 'Desligada' } as const;

export default async function ContasPage({ searchParams }: { searchParams: Promise<{ ligada?: string; erro?: string }> }) {
  const { ligada, erro } = await searchParams;
  const db = await createServerClient();
  const brands = await listBrands(db);
  const { data } = await db
    .from('social_accounts')
    .select('id, brand_id, platform, external_id, handle, display_name, avatar_url, token_expires_at, status, status_message')
    .order('created_at');
  const accounts = (data ?? []).map(fromAccountRow);
  const adAccounts = await listAdAccounts(db, null);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <PageHeader title="Contas ligadas" />
        <p className="mt-1 text-sm text-muted-foreground">Ligue as redes de cada marca. A app só publica nas contas que ligar aqui.</p>
      </div>
      {ligada && (
        <p role="status" className="rounded-lg bg-[var(--st-published-bg)] px-3 py-2 text-sm text-[var(--st-published-fg)]">
          {ligada === 'anuncios' ? 'Anúncios da Meta ligados com sucesso.' : `Conta ${PLATFORM_LABEL[ligada as Platform] ?? ''} ligada com sucesso.`}
        </p>
      )}
      {erro && <p role="alert" className="rounded-lg bg-[var(--st-failed-bg)] px-3 py-2 text-sm text-[var(--st-failed-fg)]">{erro}</p>}
      {brands.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Crie primeiro uma marca em <a className="underline" href="/definicoes/marcas">Definições → Marcas</a>.
        </p>
      )}
      {brands.map((b) => (
        <section key={b.id} className="rounded-xl border p-4" aria-label={`Contas de ${b.name}`}>
          <h2 className="mb-3 flex items-center gap-2 font-medium">
            <span className="size-3 rounded-full" style={{ background: b.color }} aria-hidden />
            {b.name}
          </h2>
          <ul className="mb-4 space-y-2">
            {accounts
              .filter((a) => a.brandId === b.id && a.status !== 'disabled')
              .map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <PlatformIcon platform={a.platform} />
                  <span className="font-medium">{PLATFORM_LABEL[a.platform]}</span>
                  <span>@{a.handle.replace(/^@/, '')}</span>
                  <span className={a.status === 'active' ? 'text-success' : 'text-warning'}>· {STATUS_LABEL[a.status]}</span>
                  {a.tokenExpiresAt && a.status === 'active' && (
                    <span className="text-muted-foreground">· acesso válido até {formatInZone(a.tokenExpiresAt, b.timezone, 'd MMM yyyy')}</span>
                  )}
                  <span className="ml-auto flex gap-2">
                    {a.status === 'needs_reauth' && (
                      <a className="underline" href={`/api/oauth/${a.platform}/start?conta=${a.id}`}>
                        Voltar a ligar
                      </a>
                    )}
                    <DisconnectButton id={a.id} />
                  </span>
                </li>
              ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <a key={p} href={`/api/oauth/${p}/start?brand=${b.id}`} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent">
                <PlatformIcon platform={p} size="sm" />
                Ligar {PLATFORM_LABEL[p]}
              </a>
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t pt-4" aria-label={`Anúncios de ${b.name}`}>
            <p className="text-sm font-medium">Anúncios da Meta <span className="font-normal text-muted-foreground">· só para ver os resultados nas Métricas</span></p>
            {adAccounts.filter((a) => a.brandId === b.id).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <Megaphone className="size-4 text-muted-foreground" aria-hidden />
                <span className="font-medium">{a.name}</span>
                <span className="text-muted-foreground">· {a.currency}</span>
                {a.tokenExpiresAt && (
                  <span className={a.tokenExpiresAt < new Date() ? 'text-warning' : 'text-muted-foreground'}>
                    · {a.tokenExpiresAt < new Date() ? 'acesso expirou, volte a ligar' : `acesso válido até ${formatInZone(a.tokenExpiresAt, b.timezone, 'd MMM yyyy')}`}
                  </span>
                )}
                <span className="ml-auto"><DisconnectButton id={a.id} kind="ads" /></span>
              </div>
            ))}
            <a href={`/api/oauth/meta-ads/start?brand=${b.id}`} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent">
              <Megaphone className="size-4" aria-hidden />
              {adAccounts.some((a) => a.brandId === b.id) ? 'Voltar a ligar anúncios' : 'Ligar anúncios da Meta'}
            </a>
          </div>
        </section>
      ))}
    </div>
  );
}
