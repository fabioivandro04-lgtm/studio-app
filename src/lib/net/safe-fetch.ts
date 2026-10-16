import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface SafeFetchDeps {
  lookup(host: string): Promise<{ address: string; family: number }[]>;
  fetch: typeof fetch;
}

const defaultDeps: SafeFetchDeps = { lookup: (h) => dnsLookup(h, { all: true }), fetch };

class LinkError extends Error {}

function v4Private(a: string): boolean {
  const [x, y] = a.split('.').map(Number);
  return x === 0 || x === 10 || x === 127 || (x === 100 && y >= 64 && y <= 127) || (x === 169 && y === 254) || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168) || x >= 224;
}

/** Loopback, privado, link-local, CGNAT, multicast e ULA (inclui IPv4 mapeado em IPv6). */
export function isPrivateAddress(addr: string): boolean {
  const a = addr.toLowerCase().replace(/^\[|\]$/g, '');
  if (isIP(a) === 4) return v4Private(a);
  const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return v4Private(mapped[1]);
  return a === '::' || a === '::1' || /^f[cd]/.test(a) || /^fe[89ab]/.test(a) || /^ff/.test(a);
}

async function assertPublic(url: URL, deps: SafeFetchDeps): Promise<void> {
  if (url.protocol !== 'https:') throw new LinkError('Use um link https.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addrs = isIP(host) ? [{ address: host, family: isIP(host) }] : await deps.lookup(host).catch(() => []);
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new LinkError('Link não permitido.');
}

/**
 * Descarrega um URL público https, validando o destino de cada redirecionamento (≤ 3) e parando acima de `maxBytes`.
 * Erros com mensagem pt-PT para o utilizador.
 */
export async function safeFetch(raw: string, maxBytes: number, deps: SafeFetchDeps = defaultDeps): Promise<{ bytes: Uint8Array; mime: string; name: string }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new LinkError('Link inválido.');
  }
  for (let hop = 0; hop <= 3; hop++) {
    await assertPublic(url, deps);
    const res = await deps.fetch(url.toString(), { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url);
      continue;
    }
    if (!res.ok) throw new LinkError(`O link respondeu com erro ${res.status}.`);
    const tooBig = () => new LinkError(`O ficheiro passa o limite de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
    if (Number(res.headers.get('content-length') ?? 0) > maxBytes) throw tooBig();
    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = res.body?.getReader();
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw tooBig();
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      bytes.set(c, off);
      off += c.byteLength;
    }
    const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const name = decodeURIComponent(url.pathname.split('/').pop() || 'ficheiro');
    return { bytes, mime, name };
  }
  throw new LinkError('Demasiados redirecionamentos.');
}

export { LinkError };
