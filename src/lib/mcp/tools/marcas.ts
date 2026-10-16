import { z } from 'zod';
import { ok } from '../result';
import { defineTool } from '../tool';

export const marcas = defineTool({
  name: 'marcas',
  title: 'Marcas',
  description: 'Lista as marcas do Estúdio com id, fuso horário, contas ligadas (id, rede, @, estado) e horários fixos de publicação. Use primeiro.',
  input: z.object({}),
  readOnly: true,
  async run(_args, ctx) {
    const [{ data: brands, error }, { data: accounts, error: e2 }] = await Promise.all([
      ctx.db.from('brands').select('id, name, timezone, posting_slots, created_at').order('created_at'),
      ctx.db.from('social_accounts').select('id, brand_id, platform, handle, status'),
    ]);
    if (error || e2) throw new Error(`marcas: ${(error ?? e2)!.message}`);
    const out = (brands ?? []).map((b) => ({
      id: b.id as string,
      nome: b.name as string,
      fuso: b.timezone as string,
      contas: (accounts ?? []).filter((a) => a.brand_id === b.id).map((a) => ({ id: a.id as string, rede: a.platform as string, handle: a.handle as string, estado: a.status as string })),
      horariosFixos: (Array.isArray(b.posting_slots) ? b.posting_slots : []).map((s: { weekday: number; time: string }) => ({ diaSemana: s.weekday, hora: s.time })),
    }));
    const text = out.length
      ? out.map((m) => `${m.nome} (${m.id}, ${m.fuso}): ${m.contas.map((c) => `${c.rede} @${c.handle}${c.estado === 'active' ? '' : ` [${c.estado}]`}`).join(', ') || 'sem contas ligadas'}; ${m.horariosFixos.length} horários fixos.`).join('\n')
      : 'Ainda não há marcas.';
    return ok(text, { marcas: out });
  },
});
