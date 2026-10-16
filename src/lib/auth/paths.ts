const PUBLIC_EXACT = new Set(['/login', '/manifest.webmanifest', '/favicon.ico']);
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
