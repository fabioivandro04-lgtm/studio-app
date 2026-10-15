import { describe, expect, it } from 'vitest';
import { BrandInput, TIMEZONES } from './schema';

describe('BrandInput', () => {
  it('padrão de fuso é Africa/Maputo', () => {
    expect(BrandInput.parse({ name: 'Unidreamity', color: '#0B1F45' }).timezone).toBe('Africa/Maputo');
  });
  it('rejeita nome vazio e cor inválida com mensagens em português', () => {
    const r = BrandInput.safeParse({ name: ' ', color: 'azul' });
    expect(r.success).toBe(false);
    const msgs = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(msgs).toContain('Dê um nome à marca.');
    expect(msgs).toContain('Escolha uma cor válida.');
  });
  it('rejeita fuso fora da lista', () => {
    expect(BrandInput.safeParse({ name: 'X', color: '#000000', timezone: 'Marte/Base' }).success).toBe(false);
  });
  it('inclui os fusos dos mercados da Unidreamity', () => {
    expect(TIMEZONES.map((t) => t.id)).toEqual(expect.arrayContaining(['Africa/Maputo', 'Africa/Luanda', 'Atlantic/Cape_Verde', 'Europe/Lisbon']));
  });
});
