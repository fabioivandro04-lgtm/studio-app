import { describe, expect, it } from 'vitest';
import { canDeletePost, canRemoveFromCalendar } from './delete-rules';

describe('canDeletePost', () => {
  it('pode apagar rascunhos, publicados, parciais, falhados e cancelados', () => {
    for (const s of ['draft', 'published', 'partial', 'failed', 'cancelled'] as const) expect(canDeletePost(s, ['published'])).toBe(true);
  });
  it('não pode apagar agendados nem posts a meio da publicação', () => {
    for (const s of ['scheduled', 'publishing', 'needs_action'] as const) expect(canDeletePost(s, [])).toBe(false);
    expect(canDeletePost('partial', ['published', 'processing'])).toBe(false);
    expect(canDeletePost('failed', ['awaiting_user'])).toBe(false);
  });
});

describe('canRemoveFromCalendar', () => {
  it('aceita agendados que ainda não começaram (cancelam-se antes)', () => {
    expect(canRemoveFromCalendar('scheduled', ['pending', 'pending'])).toBe(true);
    expect(canRemoveFromCalendar('scheduled', [])).toBe(true);
    expect(canRemoveFromCalendar('scheduled', ['pending', 'uploading'])).toBe(false);
  });
  it('segue canDeletePost para o resto', () => {
    expect(canRemoveFromCalendar('draft', ['pending'])).toBe(true);
    expect(canRemoveFromCalendar('published', ['published'])).toBe(true);
    expect(canRemoveFromCalendar('publishing', ['processing'])).toBe(false);
  });
});
