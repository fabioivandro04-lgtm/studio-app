import { clientEnv } from '@/lib/env';
import { LoginForm } from './login-form';

export const metadata = { title: 'Entrar — Estúdio' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const { next = '/calendario', erro } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand-navy px-4">
      <div className="w-full max-w-sm rounded-2xl bg-background p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-primary">Estúdio</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">Organizar, agendar, publicar e medir.</p>
        {erro && <p role="alert" className="mb-4 text-sm text-destructive">{erro}</p>}
        <LoginForm next={next} passwordEnabled={clientEnv.enablePasswordLogin} />
      </div>
    </main>
  );
}
