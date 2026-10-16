'use server';

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/db/clients';

/** Permitir/Recusar o pedido OAuth do Claude; o Supabase devolve o URL de volta ao cliente. */
export async function decideAuthorization(formData: FormData): Promise<void> {
  const id = String(formData.get('authorization_id') ?? '');
  const approve = formData.get('decision') === 'approve';
  if (!id) redirect('/oauth/autorizar');
  const db = await createServerClient();
  const { data, error } = approve
    ? await db.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true })
    : await db.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true });
  if (error || !data?.redirect_url) redirect(`/oauth/autorizar?erro=1`);
  redirect(data.redirect_url);
}
