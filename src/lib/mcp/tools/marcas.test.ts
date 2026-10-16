import { describe, expect, it } from 'vitest';
import { fakeDb } from '../testing/fake-db';
import { testCtx } from '../testing/ctx';
import { marcas } from './marcas';

describe('marcas', () => {
  it('lista marcas com fuso, contas e horários fixos', async () => {
    const { db } = fakeDb({
      brands: [{ id: 'b1', name: 'Unidreamity', color: '#000', timezone: 'Africa/Maputo', created_at: '2026-01-01', posting_slots: [{ weekday: 2, time: '19:00' }] }],
      social_accounts: [{ id: 'a1', brand_id: 'b1', platform: 'instagram', handle: 'unidreamity', status: 'active' }],
    });
    const r = await marcas.run({}, testCtx(db));
    expect(r.structuredContent).toEqual({
      marcas: [{ id: 'b1', nome: 'Unidreamity', fuso: 'Africa/Maputo', contas: [{ id: 'a1', rede: 'instagram', handle: 'unidreamity', estado: 'active' }], horariosFixos: [{ diaSemana: 2, hora: '19:00' }] }],
    });
    expect(r.content[0]).toMatchObject({ type: 'text' });
    expect((r.content[0] as { text: string }).text).toContain('Unidreamity');
  });
});
