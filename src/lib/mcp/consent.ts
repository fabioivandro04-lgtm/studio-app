import type { OAuthAuthorizationDetails, OAuthRedirect } from '@supabase/supabase-js';

export type ConsentState =
  | { kind: 'ask'; authorizationId: string; clientName: string; redirectHost: string }
  | { kind: 'redirect'; url: string }
  | { kind: 'error'; message: string };

/** Para onde o código de autorização pode voltar: claude.ai/claude.com (https) ou o próprio computador (Claude Code). */
function allowedRedirect(u: URL): boolean {
  if (['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) return u.protocol === 'http:' || u.protocol === 'https:';
  return u.protocol === 'https:' && ['claude.ai', 'claude.com'].includes(u.hostname);
}

/** Traduz a resposta de getAuthorizationDetails no que a página de consentimento mostra. */
export function consentState(r: { data: OAuthAuthorizationDetails | OAuthRedirect | null; error: { message: string } | null }): ConsentState {
  if (r.error || !r.data) return { kind: 'error', message: 'Este pedido de ligação expirou ou é inválido. Volte a ligar no Claude.' };
  if ('redirect_url' in r.data) return { kind: 'redirect', url: r.data.redirect_url };
  let url: URL | null = null;
  try {
    url = new URL(r.data.redirect_uri);
  } catch {}
  if (!url || !allowedRedirect(url)) {
    return { kind: 'error', message: `Este pedido não vem do Claude (${url?.host ?? 'endereço inválido'}). Por segurança, não foi aceite.` };
  }
  const host = url.host;
  return { kind: 'ask', authorizationId: r.data.authorization_id, clientName: r.data.client.name || 'Uma aplicação', redirectHost: host };
}
