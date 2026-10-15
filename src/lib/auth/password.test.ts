import { describe, expect, it } from 'vitest';
import { PasswordChange } from './password';

describe('PasswordChange', () => {
  it('aceita palavra-passe longa e confirmada', () => {
    expect(PasswordChange.safeParse({ password: 'umaboapalavra', confirm: 'umaboapalavra' }).success).toBe(true);
  });

  it('recusa palavra-passe curta', () => {
    const r = PasswordChange.safeParse({ password: 'curta', confirm: 'curta' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/10 caracteres/);
  });

  it('recusa confirmação diferente', () => {
    const r = PasswordChange.safeParse({ password: 'umaboapalavra', confirm: 'outracoisa12' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/não são iguais/);
  });
});
