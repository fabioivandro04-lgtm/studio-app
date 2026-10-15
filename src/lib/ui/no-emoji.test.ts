import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{23F0}-\u{23FF}\u{2B50}]/u;
const SRC = path.resolve(__dirname, '../..');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? tsxFiles(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

describe('visual sem cara de IA', () => {
  it('nenhum ecrã usa emojis em botões ou rótulos', () => {
    const offenders = tsxFiles(SRC).filter((f) => EMOJI.test(readFileSync(f, 'utf8'))).map((f) => path.relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});
