import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.join(import.meta.dirname, '..', '..');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return /components[\\/]ui(-x)?$/.test(p) ? [] : files(p);
    return p.endsWith('.tsx') ? [p] : [];
  });
}

describe('sem controlos nativos com formato estrangeiro', () => {
  it('nenhum <select> nem input date/time fora dos componentes de UI', () => {
    const bad = files(SRC).filter((f) => /<select\b|type="(date|time)"|type=\{type\}/.test(readFileSync(f, 'utf8'))).map((f) => path.relative(SRC, f));
    expect(bad).toEqual([]);
  });
});
