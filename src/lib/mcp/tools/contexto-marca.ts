import { z } from 'zod';
import { listHashtagGroups } from '@/lib/db/repo/hashtag-groups-repo';
import { BrandId, loadBrand } from '../common';
import { ok } from '../result';
import { defineTool } from '../tool';

export const contextoMarca = defineTool({
  name: 'contexto_marca',
  title: 'Contexto e voz da marca',
  description: 'Contexto do negócio, voz/tom, hashtags habituais, objetivo, posts por semana e grupos de hashtags da marca. Use antes de escrever legendas.',
  input: z.object({ brandId: BrandId }),
  readOnly: true,
  async run({ brandId }, ctx) {
    const brand = await loadBrand(ctx.db, brandId);
    const groups = await listHashtagGroups(ctx.db, brandId);
    const data = {
      marca: brand.name, contexto: brand.aiContext, voz: brand.aiVoice, hashtagsHabituais: brand.aiHashtags,
      objetivo: brand.goal === 'reach' ? 'alcance' : 'contactos', postsPorSemana: brand.postsPerWeek,
      gruposHashtags: groups.map((g) => ({ nome: g.name, hashtags: g.tags })),
    };
    const text = [
      `Marca: ${brand.name}. Objetivo: ${data.objetivo}; ${brand.postsPerWeek} posts por semana.`,
      `Contexto: ${brand.aiContext || '(vazio)'}`,
      `Voz: ${brand.aiVoice || '(vazia)'}`,
      `Grupos de hashtags: ${groups.map((g) => `${g.name} (${g.tags.join(' ')})`).join('; ') || 'nenhum'}`,
    ].join('\n');
    return ok(text, data);
  },
});
