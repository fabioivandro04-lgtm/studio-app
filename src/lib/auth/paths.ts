// /api/mcp valida o seu próprio token (OAuth do Claude); a metadata OAuth tem de ser pública.
const PUBLIC_EXACT = new Set(['/login', '/manifest.webmanifest', '/favicon.ico', '/api/mcp', '/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/api/mcp']);
const PUBLIC_PREFIXES = ['/auth/', '/legal/', '/api/cron/', '/icons/', '/_next/'];
const OAUTH_CALLBACK = /^\/api\/oauth\/[a-z]+\/callback$/;
// Ficheiros de verificação de site do TikTok for Developers (na raiz ou junto às páginas legais).
const TIKTOK_VERIFICATION = /^(\/legal(\/[a-z]+)?)?\/tiktok[A-Za-z0-9]+\.txt$/;

/** Caminhos acessíveis sem sessão. Tudo o resto exige o login do dono. */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return OAUTH_CALLBACK.test(pathname) || TIKTOK_VERIFICATION.test(pathname);
}

/** Destino a guardar em ?next= quando falta sessão (com a query, ex.: o authorization_id do OAuth). */
export function loginNext(pathname: string, search: string): string | null {
  return pathname === '/' ? null : `${pathname}${search}`;
}
