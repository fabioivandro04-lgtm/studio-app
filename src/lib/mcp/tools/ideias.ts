import { z } from 'zod';
import { listIdeas } from '@/lib/db/repo/ideas-repo';
import { BrandId, loadBrand } from '../common';
import { ok } from '../result';
import { defineTool } from '../tool';

export const ideias = defineTool({
  name: 'ideias',
  title: 'Ideias',
  description: 'Ideias guardadas no Estúdio por estado (new = novas, used = usadas, discarded = descartadas): título, gancho, guião, legenda, formato e redes.',
  input: z.object({ brandId: BrandId, estado: z.enum(['new', 'used', 'discarded']).default('new') }),
  readOnly: true,
  async run({ brandId, estado }, ctx) {
    await loadBrand(ctx.db, brandId);
    const list = (await listIdeas(ctx.db, brandId, estado)).filter((i) => i.status === estado).map((i) => ({
      id: i.id, titulo: i.title, gancho: i.hook, guiao: i.outline, legenda: i.caption, formato: i.format, redes: i.platforms,
      dataSugerida: i.suggestedAt?.toISOString() ?? null, postId: i.postId,
    }));
    return ok(list.length ? list.map((i) => `${i.id} · ${i.titulo}${i.gancho ? ` — ${i.gancho}` : ''}`).join('\n') : 'Sem ideias neste estado.', { ideias: list });
  },
});
