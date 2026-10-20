'use server';

import { z } from 'zod';
import { aiSetup, fail, toBrandAi, type Fail } from '@/lib/ai/context';
import type { WeekFacts, WeeklyReport } from '@/lib/ai/report-prompts';
import { runWeeklyReport } from '@/lib/ai/service';
import { collectWeekFacts, loadReport, saveReport } from '@/lib/reports/repo';
import { lastFullWeek } from '@/lib/reports/week';

export type ReportResult = { ok: true; weekStart: string; weekEnd: string; facts: WeekFacts; report: WeeklyReport } | Fail;

/** Resumo da última semana completa: devolve o já guardado ou pede-o à IA (e guarda-o). */
export async function weeklyReport(raw: { brandId: string; regenerate?: boolean }): Promise<ReportResult> {
  const parsed = z.object({ brandId: z.guid(), regenerate: z.boolean().optional() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Marca inválida.' };
  try {
    const { db, brand, deps } = await aiSetup(parsed.data.brandId);
    const { weekStart, weekEnd } = lastFullWeek(new Date(), brand.timezone);
    if (!parsed.data.regenerate) {
      const saved = await loadReport(db, brand.id, weekStart);
      if (saved) return { ok: true, weekStart, weekEnd, facts: saved.facts, report: saved.report };
    }
    const facts = await collectWeekFacts(db, brand, weekStart, weekEnd);
    const report = await runWeeklyReport(deps, { brandId: brand.id, brand: toBrandAi(brand), facts });
    await saveReport(db, brand.id, facts, report);
    return { ok: true, weekStart, weekEnd, facts, report };
  } catch (e) {
    return fail(e);
  }
}
