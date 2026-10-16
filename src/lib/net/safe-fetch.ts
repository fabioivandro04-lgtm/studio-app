import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP, type LookupFunction } from 'node:net';
import { Agent, fetch as undiciFetch } from 'undici';

export interface SafeFetchDeps {
  lookup(host: string): Promise<{ address: string; family: number }[]>;
  fetch: typeof fetch;
}

class LinkError extends Error {}

const dnsAll = (h: string) => dnsLookup(h, { all: true });

/**
 * lookup para a ligação TCP: volta a validar o endereço no momento de ligar (evita DNS rebinding entre a
 * verificação e o pedido).
 */
export function checkedLookup(resolve: SafeFetchDeps['lookup']): LookupFunction {
  return (hostname, options, cb) => {
    resolve(hostname)
      .then((addrs) => {
        if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new LinkError('Link não permitido.');
        if ((options as { all?: boolean })?.all) (cb as (e: null, a: { address: string; family: number }[]) => void)(null, addrs);
        else cb(null, addrs[0].address, addrs[0].family);
      })
      .catch((e) => cb(e as NodeJS.ErrnoException, '', 0));
  };
}

const pinned = new Agent({ connect: { lookup: checkedLookup(dnsAll) } });
const defaultDeps: SafeFetchDeps = {
  lookup: dnsAll,
  fetch: ((url: string, init?: RequestInit) => undiciFetch(url, { ...(init as object), dispatcher: pinned })) as unknown as typeof fetch,
};

function v4Private(a: string): boolean {
  const [x, y] = a.split('.').map(Number);
  return (
    x === 0 || x === 10 || x === 127 || (x === 100 && y >= 64 && y <= 127) || (x === 169 && y === 254) || (x === 172 && y >= 16 && y <= 31) ||
    (x === 192 && y === 168) || (x === 198 && (y === 18 || y === 19)) || x >= 224
  );
}

/** IPv6 em 8 grupos de 16 bits (aceita "::" e IPv4 no fim); null se inválido. */
function v6Groups(a: string): number[] | null {
  let s = a;
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const [p, q, r, t] = v4[1].split('.').map(Number);
    s = `${s.slice(0, -v4[1].length)}${((p << 8) | q).toString(16)}:${((r << 8) | t).toString(16)}`;
  }
  const [head, tail, extra] = s.split('::');
  if (extra !== undefined) return null;
  const h = head ? head.split(':') : [];
  const t = tail !== undefined ? (tail ? tail.split(':') : []) : [];
  const fill = tail !== undefined ? 8 - h.length - t.length : 0;
  if (fill < 0) return null;
  const all = [...h, ...Array(fill).fill('0'), ...t].map((g) => parseInt(g, 16));
  return all.length === 8 && all.every((g) => g >= 0 && g <= 0xffff) ? all : null;
}

const v4From = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;

/** Loopback, privado, link-local, CGNAT, benchmark, multicast, ULA e IPv4 embutido em IPv6 (mapeado, compatível, NAT64, 6to4). */
export function isPrivateAddress(addr: string): boolean {
  const a = addr.toLowerCase().replace(/^\[|\]$/g, '');
  if (isIP(a) === 4) return v4Private(a);
  const g = v6Groups(a);
  if (!g) return true;
  const zeros = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (zeros(8) || (zeros(7) && g[7] === 1)) return true;
  if (zeros(5) && g[5] === 0xffff) return v4Private(v4From(g[6], g[7]));
  if (zeros(6)) return v4Private(v4From(g[6], g[7]));
  if (g[0] === 0x64 && g[1] === 0xff9b) return v4Private(v4From(g[6], g[7]));
  if (g[0] === 0x2002) return v4Private(v4From(g[1], g[2]));
  return (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xff00) === 0xff00;
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
      await res.body?.cancel().catch(() => {});
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
