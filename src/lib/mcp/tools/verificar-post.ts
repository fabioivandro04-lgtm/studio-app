import { ok } from '../result';
import { defineTool } from '../tool';
import { loadPostContext, RascunhoArgs, scheduleWarnings } from '../post-input';

export const verificarPost = defineTool({
  name: 'verificar_post',
  title: 'Verificar post',
  description: 'Corre as regras da app (duração e medidas do vídeo, formato, legenda, hashtags, data) como se fosse agendar, sem gravar nada. Use antes de criar_rascunho.',
  input: RascunhoArgs,
  readOnly: true,
  async run(a, ctx) {
    const pc = await loadPostContext(ctx, a);
    const avisos = scheduleWarnings(a, pc, ctx.now());
    return ok(avisos.length ? `Avisos:\n- ${avisos.join('\n- ')}` : 'Tudo certo para agendar.', { avisos });
  },
});
