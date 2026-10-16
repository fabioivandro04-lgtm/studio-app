import { describe, expect, it } from 'vitest';
import { verifyMcpToken } from './auth';

const OWNER = '00000000-0000-0000-0000-00000000000a';
const deps = (claims: Record<string, unknown> | null, owner = true) => ({
  getClaims: async (t: string) => (t === 'bom' ? claims : null),
  isOwner: async (_t: string, sub: string) => owner && sub === OWNER,
});
const req = new Request('https://app/api/mcp', { method: 'POST' });

describe('verifyMcpToken', () => {
  it('sem token ou token inválido → undefined', async () => {
    expect(await verifyMcpToken(req, undefined, deps({ sub: OWNER, client_id: 'c' }))).toBeUndefined();
    expect(await verifyMcpToken(req, 'mau', deps({ sub: OWNER, client_id: 'c' }))).toBeUndefined();
  });
  it('token de sessão da app (sem client_id) → undefined', async () => {
    expect(await verifyMcpToken(req, 'bom', deps({ sub: OWNER }))).toBeUndefined();
  });
  it('utilizador que não é o dono → undefined', async () => {
    expect(await verifyMcpToken(req, 'bom', deps({ sub: OWNER, client_id: 'c' }, false))).toBeUndefined();
  });
  it('token OAuth do dono → AuthInfo', async () => {
    expect(await verifyMcpToken(req, 'bom', deps({ sub: OWNER, client_id: 'c', exp: 2000000000 }))).toEqual({
      token: 'bom', clientId: 'c', scopes: [], expiresAt: 2000000000, extra: { userId: OWNER },
    });
  });
});
