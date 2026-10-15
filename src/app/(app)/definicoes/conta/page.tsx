import { createServerClient } from '@/lib/db/clients';
import { PasswordForm } from './password-form';

export const metadata = { title: 'A minha conta — Estúdio' };

export default async function ContaPage() {
  const db = await createServerClient();
  const { data } = await db.auth.getUser();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">A minha conta</h1>
      <p className="text-sm text-muted-foreground">Entrou como <strong>{data.user?.email}</strong>.</p>
      <PasswordForm />
    </div>
  );
}
