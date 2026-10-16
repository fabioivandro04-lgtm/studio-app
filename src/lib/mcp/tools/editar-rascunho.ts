import { z } from 'zod';
import { ok, ToolError } from '../result';
import { defineTool } from '../tool';
import { loadPostContext, RascunhoShape, saveDraft, scheduleWarnings, toPostInput } from '../post-input';

export const editarRascunho = defineTool({
  name: 'editar_rascunho',
  title: 'Editar rascunho',
  description: 'Substitui o conteúdo de um rascunho existente (ficheiros, data/hora, redes, legendas). Só funciona com posts em rascunho; envie todos os campos.',
  input: z.object({ postId: z.string().min(1), ...RascunhoShape }),
  async run({ postId, ...a }, ctx) {
    const { data: post } = await ctx.db.from('posts').select('id, brand_id, status').eq('id', postId).maybeSingle();
    if (!post) throw new ToolError('Post não encontrado.');
    if (post.status !== 'draft') throw new ToolError('Só pode editar rascunhos.');
    if (post.brand_id !== a.brandId) throw new ToolError('Este post é de outra marca.');
    const pc = await loadPostContext(ctx, a);
    await saveDraft(ctx, toPostInput(a, pc, 'draft', postId), pc.tz);
    const avisos = scheduleWarnings(a, pc, ctx.now());
    await ctx.db.from('activity_log').insert({ brand_id: a.brandId, level: 'info', source: 'mcp', message: `Claude editou o rascunho «${a.titulo || 'sem título'}»` });
    const link = `${ctx.appUrl}/posts/${postId}`;
    return ok(`Rascunho atualizado: ${link}${avisos.length ? `\nAvisos:\n- ${avisos.join('\n- ')}` : ''}`, { postId, link, avisos });
  },
});
