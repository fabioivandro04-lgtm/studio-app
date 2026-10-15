import { describe, expect, it } from 'vitest';
import { hasUnsavedChanges } from './dirty';

const base = { brandId: 'b', internalTitle: 'T', mediaIds: ['m1'], date: '2026-10-19', time: '19:00', targets: [{ accountId: 'a', format: 'ig_image' as const, caption: 'x', title: null }], locked: false };

describe('hasUnsavedChanges', () => {
  it('igual ao guardado → falso; legenda, data ou mídia diferente → verdadeiro', () => {
    expect(hasUnsavedChanges(base, { ...base })).toBe(false);
    expect(hasUnsavedChanges(base, { ...base, targets: [{ ...base.targets[0], caption: 'y' }] })).toBe(true);
    expect(hasUnsavedChanges(base, { ...base, time: '20:00' })).toBe(true);
    expect(hasUnsavedChanges(base, { ...base, mediaIds: [] })).toBe(true);
  });
});
