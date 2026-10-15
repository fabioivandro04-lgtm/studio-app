import { describe, expect, it } from 'vitest';
import { verifyCronAuth } from './auth';

const req = (h?: string) => new Request('https://app/api/cron/tick', { method: 'POST', headers: h ? { authorization: h } : {} });

describe('verifyCronAuth', () => {
  it('sem Authorization → false', () => expect(verifyCronAuth(req(), 's3gredo')).toBe(false));
  it('Bearer errado → false', () => expect(verifyCronAuth(req('Bearer outro'), 's3gredo')).toBe(false));
  it('Bearer com tamanho diferente → false', () => expect(verifyCronAuth(req('Bearer s3gredoX'), 's3gredo')).toBe(false));
  it('sem prefixo Bearer → false', () => expect(verifyCronAuth(req('s3gredo'), 's3gredo')).toBe(false));
  it('certo → true', () => expect(verifyCronAuth(req('Bearer s3gredo'), 's3gredo')).toBe(true));
  it('segredo vazio nunca autoriza', () => expect(verifyCronAuth(req('Bearer '), '')).toBe(false));
});
