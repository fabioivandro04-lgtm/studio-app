import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { runTool } from './server';
import { defineTool } from './tool';
import { ok } from './result';
import { fakeDb } from './testing/fake-db';
import { testCtx } from './testing/ctx';

const echo = defineTool({ name: 'eco', title: 'Eco', description: 'x', input: z.object({ n: z.number().int().min(1, 'Número inválido.') }), run: async ({ n }) => ok(`n=${n}`) });
const boom = defineTool({ name: 'boom', title: 'B', description: 'x', input: z.object({}), run: async () => { throw new Error('segredo interno'); } });

describe('runTool', () => {
  it('valida a entrada e devolve a mensagem em pt-PT', async () => {
    const r = await runTool(echo, { n: 0 }, testCtx(fakeDb({}).db));
    expect(r).toMatchObject({ isError: true, content: [{ type: 'text', text: 'Número inválido.' }] });
  });
  it('erros internos não são expostos', async () => {
    const r = await runTool(boom, {}, testCtx(fakeDb({}).db));
    expect(r).toMatchObject({ isError: true, content: [{ type: 'text', text: 'Ocorreu um erro. Tente de novo.' }] });
  });
  it('limite de pedidos', async () => {
    const ctx = testCtx(fakeDb({}).db, { take: () => false });
    expect(await runTool(echo, { n: 1 }, ctx)).toMatchObject({ isError: true, content: [{ text: 'Muitos pedidos, aguarde um minuto.' }] });
  });
  it('sucesso', async () => {
    expect(await runTool(echo, { n: 2 }, testCtx(fakeDb({}).db))).toMatchObject({ content: [{ type: 'text', text: 'n=2' }] });
  });
});
