'use server';

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/db/clients';
import { consentState } from '@/lib/mcp/consent';

/** Permitir/Recusar o pedido OAuth do Claude; o Supabase devolve o URL de volta ao cliente. */
export async function decideAuthorization(formData: FormData): Promise<void> {
  const id = String(formData.get('authorization_id') ?? '');
  const approve = formData.get('decision') === 'approve';
  if (!id) redirect('/oauth/autorizar');
  const db = await createServerClient();
  if (approve) {
    // Volta a verificar aqui (não só na página): dono, pedido válido e regresso permitido.
    const { data: owner } = await db.from('app_owner').select('user_id').limit(1).maybeSingle();
    const state = consentState(await db.auth.oauth.getAuthorizationDetails(id));
    if (!owner || state.kind !== 'ask') redirect('/oauth/autorizar?erro=1');
  }
  const { data, error } = approve
    ? await db.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true })
    : await db.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true });
  if (error || !data?.redirect_url) redirect(`/oauth/autorizar?erro=1`);
  redirect(data.redirect_url);
}
