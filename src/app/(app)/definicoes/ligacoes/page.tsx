import { createServerClient } from '@/lib/db/clients';
import { listBrands } from '@/lib/db/repo/brands-repo';
import { serverEnv } from '@/lib/env';
import { formatInZone } from '@/lib/time/zone';
import { RevokeButton } from './revoke-button';

export const metadata = { title: 'Ligações do Claude — Estúdio' };

export default async function LigacoesPage() {
  const db = await createServerClient();
  const [{ data: grants, error }, brands] = await Promise.all([db.auth.oauth.listGrants(), listBrands(db)]);
  const tz = brands[0]?.timezone ?? 'Africa/Maputo';
  const url = `${serverEnv().APP_URL}/api/mcp`;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Ligações do Claude</h1>
        <p className="mt-1 text-sm text-muted-foreground">O Claude pode ler o Estúdio e criar rascunhos. Nunca agenda, publica nem apaga.</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">Não foi possível ler as ligações.</p>}
      <ul className="divide-y rounded-xl border">
        {(grants ?? []).length === 0 && !error && (
          <li className="space-y-2 p-4 text-sm">
            <p className="font-medium">Ainda não ligou o Claude.</p>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>No claude.ai: Definições → Conectores → Adicionar conector personalizado, com o endereço abaixo.</li>
              <li>No Claude Code: <code className="rounded bg-muted px-1">claude mcp add --transport http estudio {url}</code></li>
              <li>Na primeira utilização, entre no Estúdio e toque em Permitir.</li>
            </ol>
            <p className="break-all rounded bg-muted px-2 py-1 font-mono text-xs">{url}</p>
          </li>
        )}
        {(grants ?? []).map((g) => (
          <li key={g.client.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex-1">
              <span className="block font-medium">{g.client.name || 'Aplicação'}</span>
              <span className="block text-sm text-muted-foreground">Ligado em {formatInZone(new Date(g.granted_at), tz, "d MMM yyyy 'às' HH:mm")}</span>
            </span>
            <RevokeButton clientId={g.client.id} name={g.client.name || 'esta aplicação'} />
          </li>
        ))}
      </ul>
    </div>
  );
}
