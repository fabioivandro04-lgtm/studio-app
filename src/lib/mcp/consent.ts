import type { OAuthAuthorizationDetails, OAuthRedirect } from '@supabase/supabase-js';

export type ConsentState =
  | { kind: 'ask'; authorizationId: string; clientName: string; redirectHost: string }
  | { kind: 'redirect'; url: string }
  | { kind: 'error'; message: string };

/** Traduz a resposta de getAuthorizationDetails no que a página de consentimento mostra. */
export function consentState(r: { data: OAuthAuthorizationDetails | OAuthRedirect | null; error: { message: string } | null }): ConsentState {
  if (r.error || !r.data) return { kind: 'error', message: 'Este pedido de ligação expirou ou é inválido. Volte a ligar no Claude.' };
  if ('redirect_url' in r.data) return { kind: 'redirect', url: r.data.redirect_url };
  let host = '';
  try {
    host = new URL(r.data.redirect_uri).host;
  } catch {}
  return { kind: 'ask', authorizationId: r.data.authorization_id, clientName: r.data.client.name || 'Uma aplicação', redirectHost: host };
}
