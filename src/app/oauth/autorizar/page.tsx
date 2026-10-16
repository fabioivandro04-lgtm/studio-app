import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createServerClient } from '@/lib/db/clients';
import { consentState } from '@/lib/mcp/consent';
import { decideAuthorization } from './actions';

export const metadata = { title: 'Ligar o Claude — Estúdio' };
export const dynamic = 'force-dynamic';

const CAN = [
  'Ver o calendário, os horários fixos e o estado das publicações',
  'Ver métricas, Ideias, Prazos, a Biblioteca e a voz das marcas',
  'Carregar ficheiros para a Biblioteca',
  'Criar e editar rascunhos de posts, ideias e prazos',
];
const CANNOT = ['Agendar ou publicar', 'Apagar seja o que for', 'Mexer em Definições, contas ligadas ou chaves'];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold text-primary">Estúdio</p>
        {children}
      </div>
    </main>
  );
}

export default async function AutorizarPage({ searchParams }: { searchParams: Promise<{ authorization_id?: string; erro?: string }> }) {
  const { authorization_id: id, erro } = await searchParams;
  if (erro || !id) {
    return (
      <Shell>
        <h1 className="mt-2 text-lg font-semibold">Pedido inválido</h1>
        <p className="mt-2 text-sm text-muted-foreground">Este pedido de ligação expirou ou é inválido. Volte a ligar no Claude.</p>
      </Shell>
    );
  }

  const db = await createServerClient();
  const { data: owner } = await db.from('app_owner').select('user_id').limit(1).maybeSingle();
  if (!owner) {
    return (
      <Shell>
        <h1 className="mt-2 text-lg font-semibold">Sem acesso</h1>
        <p className="mt-2 text-sm text-muted-foreground">Esta conta não tem acesso.</p>
      </Shell>
    );
  }

  const state = consentState(await db.auth.oauth.getAuthorizationDetails(id));
  if (state.kind === 'redirect') redirect(state.url);
  if (state.kind === 'error') {
    return (
      <Shell>
        <h1 className="mt-2 text-lg font-semibold">Pedido inválido</h1>
        <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="mt-2 text-lg font-semibold">O {state.clientName} quer aceder ao seu Estúdio</h1>
      {state.redirectHost && <p className="mt-1 text-xs text-muted-foreground">Pedido de {state.redirectHost}</p>}
      <h2 className="mt-5 text-sm font-medium">Poderá</h2>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{CAN.map((c) => <li key={c}>{c}</li>)}</ul>
      <h2 className="mt-4 text-sm font-medium">Nunca poderá</h2>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{CANNOT.map((c) => <li key={c}>{c}</li>)}</ul>
      <p className="mt-4 text-xs text-muted-foreground">Pode cortar este acesso em Definições → Ligações do Claude.</p>
      <form action={decideAuthorization} className="mt-6 flex gap-2">
        <input type="hidden" name="authorization_id" value={state.authorizationId} />
        <Button type="submit" name="decision" value="approve" className="flex-1">Permitir</Button>
        <Button type="submit" name="decision" value="deny" variant="outline" className="flex-1">Recusar</Button>
      </form>
    </Shell>
  );
}
