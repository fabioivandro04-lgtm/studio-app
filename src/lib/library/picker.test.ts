import { describe, expect, it } from 'vitest';
import { pickerFilter } from './picker';

const media = [{ id: 'a', folderId: 'f1' }, { id: 'b', folderId: null }, { id: 'c', folderId: 'f2' }];

describe('pickerFilter', () => {
  it('filtra por pasta, sem pasta ou todas', () => {
    expect(pickerFilter(media, 'f1', ['f1', 'f2']).items.map((m) => m.id)).toEqual(['a']);
    expect(pickerFilter(media, 'none', ['f1']).items.map((m) => m.id)).toEqual(['b']);
    expect(pickerFilter(media, 'all', []).items).toHaveLength(3);
  });
  it('pasta que já não existe nesta marca (mudou de marca) → todas', () => {
    expect(pickerFilter(media, 'f9', ['f1'])).toEqual({ value: 'all', items: media });
  });
});
