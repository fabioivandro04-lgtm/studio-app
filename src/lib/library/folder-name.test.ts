import { describe, expect, it } from 'vitest';
import { cleanFolderName, defaultFolderName } from './folder-name';

describe('cleanFolderName', () => {
  it('apara e junta espaços', () => expect(cleanFolderName('  Prazos   2027 ')).toBe('Prazos 2027'));
  it('vazio → null', () => expect(cleanFolderName('   ')).toBeNull());
  it('81 caracteres → null; 80 aceita', () => {
    expect(cleanFolderName('a'.repeat(81))).toBeNull();
    expect(cleanFolderName('a'.repeat(80))).toBe('a'.repeat(80));
  });
});

describe('defaultFolderName', () => {
  it('usa o título do post', () => expect(defaultFolderName('  Prazos Portugal ', '2026-10-17')).toBe('Prazos Portugal'));
  it('sem título → "Post de dd/mm"', () => expect(defaultFolderName('', '2026-10-17')).toBe('Post de 17/10'));
  it('título longo é cortado a 80', () => expect(defaultFolderName('x'.repeat(100), '2026-10-17')).toHaveLength(80));
});
