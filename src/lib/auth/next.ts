const FALLBACK = '/calendario';
const ORIGIN = 'https://estudio.invalid';

/** Destino depois do login: só caminhos internos (evita redirecionamentos abertos como "/\\evil.com"). */
export function safeNext(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || /[\\\u0000-\u001f]/.test(value)) return FALLBACK;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return FALLBACK;
  }
  if (/[\\\u0000-\u001f]/.test(decoded)) return FALLBACK;
  const url = new URL(value, ORIGIN);
  if (url.origin !== ORIGIN) return FALLBACK;
  return `${url.pathname}${url.search}`;
}
