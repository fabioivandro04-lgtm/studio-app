import { describe, expect, it } from 'vitest';
import { DeadlineInput } from './schema';

const B = '11111111-1111-1111-1111-111111111111';

describe('DeadlineInput', () => {
  it('aceita prazo válido e limpa campos vazios', () => {
    expect(DeadlineInput.parse({ brandId: B, title: 'Candidaturas U. Lisboa', dueDate: '2027-02-15', country: '', url: '' })).toMatchObject({
      title: 'Candidaturas U. Lisboa', dueDate: '2027-02-15', country: null, url: null,
    });
  });
  it('exige título e data', () => {
    const r = DeadlineInput.safeParse({ brandId: B, title: '', dueDate: '15/02/2027' });
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => i.message)).toEqual(expect.arrayContaining(['Escreva o nome do prazo.', 'Escolha a data.']));
  });
  it('url tem de ser http(s)', () => {
    expect(DeadlineInput.safeParse({ brandId: B, title: 'x', dueDate: '2027-02-15', url: 'javascript:alert(1)' }).success).toBe(false);
  });
});
