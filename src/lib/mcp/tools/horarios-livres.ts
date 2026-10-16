import { z } from 'zod';
import { busyTimes } from '@/lib/db/repo/ai-repo';
import { freeSlotsInRange } from '@/lib/schedule/slots';
import { BrandId, checkRange, DateStr, loadBrand, localDayRange } from '../common';
import { ok } from '../result';
import { defineTool } from '../tool';

export const horariosLivres = defineTool({
  name: 'horarios_livres',
  title: 'Horários fixos livres',
  description: 'Horários fixos de publicação da marca que estão livres entre duas datas (no máximo 62 dias). Ocupado = outro post ou ideia a menos de 1 hora. Use para escolher dias e horas.',
  input: z.object({ brandId: BrandId, de: DateStr, ate: DateStr }),
  readOnly: true,
  async run({ brandId, de, ate }, ctx) {
    checkRange(de, ate, 62);
    const brand = await loadBrand(ctx.db, brandId);
    if (!brand.postingSlots.length) return ok('Esta marca não tem horários fixos.', { livres: [] });
    const { from, to } = localDayRange(de, ate, brand.timezone);
    const busy = await busyTimes(ctx.db, brandId, new Date(from.getTime() - 3600_000), new Date(to.getTime() + 3600_000), { includeIdeas: true });
    const livres = freeSlotsInRange({ slots: brand.postingSlots, tz: brand.timezone, busy, now: ctx.now(), from: de, to: ate }).map((s) => ({ data: s.date, hora: s.time }));
    return ok(livres.length ? livres.map((s) => `${s.data} ${s.hora}`).join('\n') : 'Não há horários fixos livres nesse intervalo.', { livres });
  },
});
