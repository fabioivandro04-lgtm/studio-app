import { unstable_rethrow } from 'next/navigation';
import { AiError } from '@/lib/ai/errors';
import { createFakeAi } from '@/lib/ai/fake';
import { createOpenRouter } from '@/lib/ai/openrouter';
import type { AiDeps } from '@/lib/ai/service';
import type { BrandAi } from '@/lib/ai/types';
import { createServerClient } from '@/lib/db/clients';
import { insertUsage, loadAiSettings, monthSpend } from '@/lib/db/repo/ai-repo';
import { listBrands } from '@/lib/db/repo/brands-repo';
import type { Brand } from '@/lib/db/types';
import { serverEnv } from '@/lib/env';

/** Contexto partilhado pelas server actions de IA (assistente e ideias). Só para o servidor. */
export type Fail = { ok: false; error: string };
const UNEXPECTED = 'Ocorreu um erro inesperado. Tente de novo.';

export function fail(e: unknown): Fail {
  unstable_rethrow(e); // deixa passar os sinais internos do Next (render dinâmico, redirect…)
  if (e instanceof AiError) return { ok: false, error: e.message };
  console.error('[ai]', e);
  return { ok: false, error: UNEXPECTED };
}

export const toBrandAi = (b: Brand): BrandAi => ({ name: b.name, aiContext: b.aiContext, aiVoice: b.aiVoice, aiHashtags: b.aiHashtags, goal: b.goal });

/** Cliente do dono, marca (via RLS) e dependências da IA. */
export async function aiSetup(brandId: string) {
  const db = await createServerClient();
  const brand = (await listBrands(db)).find((b) => b.id === brandId);
  if (!brand) throw new AiError('invalid_input', 'Marca não encontrada.');
  const env = serverEnv();
  const [settings, spend] = await Promise.all([loadAiSettings(db), monthSpend(db, new Date())]);
  const provider =
    env.PLATFORM_MODE === 'fake'
      ? createFakeAi()
      : env.OPENROUTER_API_KEY
        ? createOpenRouter({ apiKey: env.OPENROUTER_API_KEY, appUrl: env.APP_URL, fetch })
        : null;
  const deps: AiDeps = {
    provider, model: settings.model, limitUsd: settings.limitUsd, spentUsd: spend.usd,
    recordUsage: (u) => insertUsage(db, u),
  };
  return { db, brand, deps };
}
