const PUBLIC_EXACT = new Set(['/login', '/manifest.webmanifest', '/favicon.ico']);
const PUBLIC_PREFIXES = ['/auth/', '/legal/', '/api/cron/', '/icons/', '/_next/'];
const OAUTH_CALLBACK = /^\/api\/oauth\/[a-z]+\/callback$/;

/** Caminhos acessíveis sem sessão. Tudo o resto exige o login do dono. */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return OAUTH_CALLBACK.test(pathname);
}
