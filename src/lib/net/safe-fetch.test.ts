import { describe, expect, it } from 'vitest';
import { checkedLookup, isPrivateAddress, safeFetch } from './safe-fetch';

const publicDns = async () => [{ address: '93.184.216.34', family: 4 }];
const ok = (body: string, headers: Record<string, string> = {}) => new Response(body, { status: 200, headers: { 'content-type': 'image/jpeg', ...headers } });

describe('isPrivateAddress', () => {
  it.each(['127.0.0.1', '10.0.0.1', '172.16.5.4', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '64:ff9b::a9fe:a9fe', '2002:7f00:1::', '::127.0.0.1', '198.18.0.1', '0:0:0:0:0:ffff:7f00:0001'])('%s é privado', (a) => expect(isPrivateAddress(a)).toBe(true));
  it.each(['93.184.216.34', '8.8.8.8', '2606:4700::1111'])('%s é público', (a) => expect(isPrivateAddress(a)).toBe(false));
});

describe('safeFetch', () => {
  it('só https', async () => {
    await expect(safeFetch('http://x.com/a.jpg', 100, { lookup: publicDns, fetch: async () => ok('x') })).rejects.toThrow('Use um link https.');
  });
  it('recusa hosts que resolvem para endereços privados', async () => {
    await expect(safeFetch('https://localhost/a.jpg', 100, { lookup: async () => [{ address: '127.0.0.1', family: 4 }], fetch: async () => ok('x') })).rejects.toThrow('Link não permitido.');
    await expect(safeFetch('https://169.254.169.254/x', 100, { lookup: publicDns, fetch: async () => ok('x') })).rejects.toThrow('Link não permitido.');
    await expect(safeFetch('https://[::1]/x', 100, { lookup: publicDns, fetch: async () => ok('x') })).rejects.toThrow('Link não permitido.');
  });
  it('valida cada redirecionamento', async () => {
    const fetch = async (u: string | URL | Request) => (String(u).includes('evil') ? ok('x') : new Response(null, { status: 302, headers: { location: 'https://evil.internal/x' } }));
    const lookup = async (h: string) => (h === 'evil.internal' ? [{ address: '10.0.0.5', family: 4 }] : [{ address: '93.184.216.34', family: 4 }]);
    await expect(safeFetch('https://ok.com/a', 100, { lookup, fetch })).rejects.toThrow('Link não permitido.');
  });
  it('acima do limite → erro', async () => {
    await expect(safeFetch('https://ok.com/a.jpg', 3, { lookup: publicDns, fetch: async () => ok('12345') })).rejects.toThrow('O ficheiro passa o limite');
  });
  it('sucesso: bytes, tipo e nome', async () => {
    const r = await safeFetch('https://ok.com/fotos/a%20b.jpg?x=1', 100, { lookup: publicDns, fetch: async () => ok('abc') });
    expect(r).toEqual({ bytes: new TextEncoder().encode('abc'), mime: 'image/jpeg', name: 'a b.jpg' });
  });
});

describe('IPv6 mapeado no URL', () => {
  it('https://[::ffff:127.0.0.1]/ (o URL normaliza para ::ffff:7f00:1) é recusado', async () => {
    await expect(safeFetch('https://[::ffff:127.0.0.1]/x', 100, { lookup: publicDns, fetch: async () => ok('x') })).rejects.toThrow('Link não permitido.');
  });
});

describe('checkedLookup (ligação presa ao endereço validado)', () => {
  it('recusa quando o DNS devolve um endereço privado no momento da ligação', async () => {
    const lookup = checkedLookup(async () => [{ address: '10.0.0.1', family: 4 }]);
    await expect(new Promise((res, rej) => lookup('rebind.test', {}, (e, a) => (e ? rej(e) : res(a))))).rejects.toThrow('Link não permitido.');
  });
  it('devolve o endereço público', async () => {
    const lookup = checkedLookup(publicDns);
    await expect(new Promise((res, rej) => lookup('ok.test', {}, (e, a, f) => (e ? rej(e) : res([a, f]))))).resolves.toEqual(['93.184.216.34', 4]);
  });
});
