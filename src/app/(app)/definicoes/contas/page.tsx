import { createServerClient } from '@/lib/db/clients';
import { listBrands } from '@/lib/db/repo/brands-repo';
import { fromAccountRow } from '@/lib/db/types';
import { PLATFORM_LABEL, type Platform } from '@/lib/platforms/types';
import { formatInZone } from '@/lib/time/zone';
import { DisconnectButton } from './disconnect-button';

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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Contas ligadas</h1>
      {ligada && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Conta {PLATFORM_LABEL[ligada as Platform] ?? ''} ligada com sucesso.</p>}
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">{erro}</p>}
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
                <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{PLATFORM_LABEL[a.platform]}</span>
                  <span>@{a.handle.replace(/^@/, '')}</span>
                  <span className={a.status === 'active' ? 'text-emerald-700' : 'text-amber-700'}>· {STATUS_LABEL[a.status]}</span>
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
              <a key={p} href={`/api/oauth/${p}/start?brand=${b.id}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
                Ligar {PLATFORM_LABEL[p]}
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
