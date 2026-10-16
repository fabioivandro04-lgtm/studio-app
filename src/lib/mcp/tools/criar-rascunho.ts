import { z } from 'zod';
import { claimIdea, linkIdeaPost } from '@/lib/db/repo/ideas-repo';
import { ok, ToolError } from '../result';
import { defineTool } from '../tool';
import { loadPostContext, RascunhoShape, saveDraft, scheduleWarnings, toPostInput } from '../post-input';

export const criarRascunho = defineTool({
  name: 'criar_rascunho',
  title: 'Criar rascunho',
  description: 'Cria um RASCUNHO de post no Estúdio (nunca agenda): ficheiros da Biblioteca, data/hora no fuso da marca, redes com legenda. O dono revê e agenda na app. Devolve o link e os avisos que a app daria ao agendar. Com ideiaId marca a ideia como usada.',
  input: z.object({ ...RascunhoShape, ideiaId: z.guid().optional() }),
  async run({ ideiaId, ...a }, ctx) {
    const pc = await loadPostContext(ctx, a);
    const input = toPostInput(a, pc, 'draft');
    const avisos = scheduleWarnings(a, pc, ctx.now());
    if (ideiaId) {
      const { data: idea } = await ctx.db.from('ideas').select('id, brand_id').eq('id', ideiaId).maybeSingle();
      if (!idea || idea.brand_id !== a.brandId) throw new ToolError('Ideia não encontrada nesta marca.');
      if (!(await claimIdea(ctx.db, ideiaId))) throw new ToolError('Esta ideia já foi usada ou descartada.');
    }
    let postId: string;
    try {
      postId = await saveDraft(ctx, input, pc.tz);
    } catch (e) {
      // Liberta a ideia reservada: sem post, volta a nova.
      if (ideiaId) await ctx.db.from('ideas').update({ status: 'new' }).eq('id', ideiaId).is('post_id', null);
      throw e;
    }
    if (ideiaId) await linkIdeaPost(ctx.db, ideiaId, postId);
    await ctx.db.from('activity_log').insert({ brand_id: a.brandId, level: 'info', source: 'mcp', message: `Claude criou o rascunho «${a.titulo || 'sem título'}»` });
    const link = `${ctx.appUrl}/posts/${postId}`;
    return ok(
      `Rascunho criado para ${a.data} às ${a.hora}: ${link}${avisos.length ? `\nAvisos antes de agendar:\n- ${avisos.join('\n- ')}` : '\nSem avisos: pronto para o dono agendar.'}`,
      { postId, link, avisos },
    );
  },
});
