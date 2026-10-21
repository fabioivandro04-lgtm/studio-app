import { describe, expect, it } from 'vitest';
import { pickClearable } from './clear-rules';

describe('pickClearable', () => {
  it('apaga rascunhos, agendados e cancelados; cancela primeiro os agendados', () => {
    const r = pickClearable([
      { id: 'a', status: 'draft', targets: ['pending'] },
      { id: 'b', status: 'scheduled', targets: ['pending'] },
      { id: 'c', status: 'cancelled', targets: ['failed'] },
    ]);
    expect(r).toEqual({ cancel: ['b'], remove: ['a', 'b', 'c'] });
  });
  it('nunca mexe no histórico nem em posts a meio da publicação', () => {
    const r = pickClearable([
      { id: 'p', status: 'published', targets: ['published'] },
      { id: 'f', status: 'failed', targets: ['failed'] },
      { id: 'x', status: 'publishing', targets: ['uploading'] },
      { id: 'q', status: 'partial', targets: ['published', 'failed'] },
      { id: 's', status: 'scheduled', targets: ['awaiting_user'] },
      { id: 'k', status: 'cancelled', targets: ['published'] },
    ]);
    expect(r).toEqual({ cancel: [], remove: [] });
  });
});
