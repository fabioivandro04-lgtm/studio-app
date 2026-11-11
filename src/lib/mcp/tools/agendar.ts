import { z } from 'zod';
import { loadDrafts } from '@/lib/caixa/drafts-repo';
import { planSchedule } from '@/lib/caixa/schedule';
import { ok, ToolError } from '../result';
import { defineTool } from '../tool';

const REASON: Record<string, string> = {
  past_time: 'A hora já passou.',
  not_draft: 'Já não é um rascunho.',
  no_targets: 'Não tem redes escolhidas.',
  post_locked: 'Já começou a ser publicado.',
  not_scheduled: 'Não está agendado.',
};
const reason = (msg: string) => Object.entries(REASON).find(([k]) => msg.includes(k))?.[1] ?? 'Não foi possível.';

export const agendarRascunhos = defineTool({
  name: 'agendar_rascunhos',
  title: 'Agendar rascunhos',
  description:
    'Agenda rascunhos na data/hora que já têm (mesmas regras do editor e da Caixa). Para publicar já, edite primeiro o rascunho para daqui a uns minutos. Os que não passam nas regras ficam de fora com o motivo.',
  input: z.object({ postIds: z.array(z.guid('Id de post inválido.')).min(1).max(20) }),
  async run({ postIds }, ctx) {
    const ids = [...new Set(postIds)];
    const { candidates } = await loadDrafts(ctx.db, { ids });
    const plan = planSchedule(candidates, ctx.now());
    const agendados: { postId: string; quando: string }[] = [];
    const recusados = [...plan.skipped].map((s) => ({ postId: s.id, motivo: s.reason }));
    for (const r of plan.ready) {
      const { error } = await ctx.db.rpc('agent_schedule_post', { p_id: r.id, p_at: r.scheduledAt.toISOString() });
      if (error) {
        recusados.push({ postId: r.id, motivo: reason(error.message) });
        continue;
      }
      agendados.push({ postId: r.id, quando: r.scheduledAt.toISOString() });
      const c = candidates.find((x) => x.id === r.id);
      if (c && !c.missing) {
        await ctx.db.from('activity_log').insert({
          brand_id: c.input.brandId, level: 'info', source: 'mcp', message: `Claude agendou «${c.input.internalTitle || 'sem título'}»`,
        });
      }
    }
    const linhas = [
      ...agendados.map((a) => `Agendado: ${ctx.appUrl}/posts/${a.postId} (${a.quando})`),
      ...recusados.map((s) => `Não agendado: ${s.postId} — ${s.motivo}`),
    ];
    return ok(linhas.join('\n'), { agendados, recusados });
  },
});

export const desagendarPost = defineTool({
  name: 'desagendar_post',
  title: 'Voltar a rascunho',
  description: 'Tira um post agendado do calendário de publicação e volta a pô-lo em rascunho (pode ser editado e agendado de novo). Não apaga nada.',
  input: z.object({ postId: z.guid('Id de post inválido.') }),
  async run({ postId }, ctx) {
    const { data: post } = await ctx.db.from('posts').select('id, brand_id, internal_title').eq('id', postId).maybeSingle();
    if (!post) throw new ToolError('Post não encontrado.');
    const { error } = await ctx.db.rpc('agent_unschedule_post', { p_id: postId });
    if (error) throw new ToolError(reason(error.message));
    await ctx.db.from('activity_log').insert({
      brand_id: post.brand_id, level: 'info', source: 'mcp', message: `Claude voltou a pôr em rascunho «${post.internal_title || 'sem título'}»`,
    });
    return ok(`Voltou a rascunho: ${ctx.appUrl}/posts/${postId}`, { postId });
  },
});
