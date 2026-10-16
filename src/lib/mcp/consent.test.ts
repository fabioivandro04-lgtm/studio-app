import { describe, expect, it } from 'vitest';
import { consentState } from './consent';

const details = { authorization_id: 'a1', redirect_uri: 'https://claude.ai/api/mcp/auth_callback', scope: 'email', user: { id: 'u', email: 'x' }, client: { id: 'c1', name: 'Claude', uri: '', logo_uri: '' } };

describe('consentState', () => {
  it('pede consentimento com o nome do cliente', () => {
    expect(consentState({ data: details, error: null })).toEqual({ kind: 'ask', authorizationId: 'a1', clientName: 'Claude', redirectHost: 'claude.ai' });
  });
  it('já consentido → redireciona', () => {
    expect(consentState({ data: { redirect_url: 'https://claude.ai/cb?code=1' }, error: null })).toEqual({ kind: 'redirect', url: 'https://claude.ai/cb?code=1' });
  });
  it('erro ou pedido expirado → mensagem', () => {
    expect(consentState({ data: null, error: { message: 'not found' } })).toEqual({ kind: 'error', message: 'Este pedido de ligação expirou ou é inválido. Volte a ligar no Claude.' });
  });
  it('só aceita regressar ao claude.ai/claude.com ou ao computador (Claude Code)', () => {
    const at = (redirect_uri: string) => consentState({ data: { ...details, redirect_uri }, error: null });
    expect(at('https://claude.com/api/mcp/auth_callback')).toMatchObject({ kind: 'ask' });
    expect(at('http://localhost:53682/callback')).toMatchObject({ kind: 'ask', redirectHost: 'localhost:53682' });
    expect(at('http://127.0.0.1:9000/cb')).toMatchObject({ kind: 'ask' });
    expect(at('https://claude.ai.evil.com/cb')).toEqual({ kind: 'error', message: 'Este pedido não vem do Claude (claude.ai.evil.com). Por segurança, não foi aceite.' });
    expect(at('http://claude.ai/cb')).toMatchObject({ kind: 'error' });
  });
  it('cliente sem nome → "Uma aplicação"', () => {
    expect(consentState({ data: { ...details, client: { ...details.client, name: '' } }, error: null })).toMatchObject({ clientName: 'Uma aplicação' });
  });
});
