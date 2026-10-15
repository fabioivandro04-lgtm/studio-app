'use server';

import { revalidatePath } from 'next/cache';
import { suggestSlots, type Slot } from '@/lib/ai/best-time';
import { aiSetup, fail, toBrandAi, type Fail } from '@/lib/ai/context';
import { AiError } from '@/lib/ai/errors';
import { RefineInput, SuggestInput } from '@/lib/ai/inputs';
import { runDraftVoice, runRefine, runSuggest } from '@/lib/ai/service';
import type { RefineAction, Suggestions } from '@/lib/ai/types';
import { AiSettingsInput } from '@/lib/brands/schema';
import { decryptToken } from '@/lib/crypto/tokens';
import { createServerClient, createServiceClient } from '@/lib/db/clients';
import { bestTimeInputs, loadAiSettings, monthSpend } from '@/lib/db/repo/ai-repo';
import { listBrands } from '@/lib/db/repo/brands-repo';
import { createTickRepo } from '@/lib/db/repo/tick-repo';
import { serverEnv } from '@/lib/env';
import { getAdapters } from '@/lib/platforms/registry';
import type { Platform, TargetFormat } from '@/lib/platforms/types';
import { ensureFreshToken } from '@/lib/publishing/tokens';

const IMAGE_URL_TTL_S = 600;

export async function suggestPost(i: {
  brandId: string;
  prompt: string;
  mediaId: string | null;
  platforms: Platform[];
  formats: Partial<Record<Platform, TargetFormat>>;
}): Promise<{ ok: true; suggestions: Suggestions } | Fail> {
  const parsed = SuggestInput.safeParse(i);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Pedido inválido.' };
  try {
    const { db, brand, deps } = await aiSetup(i.brandId);
    let imageUrl: string | null = null;
    if (i.mediaId) {
      const { data: m } = await db.from('media_assets').select('storage_path, thumbnail_path, kind').eq('id', i.mediaId).maybeSingle();
      const path = m ? (m.thumbnail_path ?? (m.kind === 'image' ? m.storage_path : null)) : null;
      if (path) {
        const { data } = await db.storage.from('media').createSignedUrl(path, IMAGE_URL_TTL_S);
        imageUrl = data?.signedUrl ?? null;
      }
    }
    const targets = i.platforms.map((platform) => ({ platform, format: i.formats[platform] ?? defaultFormatFor(platform) }));
    const suggestions = await runSuggest(deps, { brandId: brand.id, brand: toBrandAi(brand), prompt: i.prompt, imageUrl, targets });
    return { ok: true, suggestions };
  } catch (e) {
    return fail(e);
  }
}

const defaultFormatFor = (p: Platform): TargetFormat => (p === 'instagram' ? 'ig_image' : p === 'tiktok' ? 'tiktok_video' : 'yt_short');

export async function refineCaption(i: { brandId: string; platform: Platform; text: string; action: RefineAction }): Promise<{ ok: true; text: string } | Fail> {
  const parsed = RefineInput.safeParse(i);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Pedido inválido.' };
  try {
    const { brand, deps } = await aiSetup(i.brandId);
    return { ok: true, text: await runRefine(deps, { ...i, brand: toBrandAi(brand) }) };
  } catch (e) {
    return fail(e);
  }
}

export async function draftVoice(i: { brandId: string }): Promise<{ ok: true; voice: string } | Fail> {
  try {
    const { db, brand, deps } = await aiSetup(i.brandId);
    // RLS confirma que a conta é do dono; só depois se lê o token com o cliente de serviço.
    const { data: acc } = await db
      .from('social_accounts')
      .select('id')
      .eq('brand_id', brand.id)
      .eq('platform', 'instagram')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (!acc) throw new AiError('invalid_input', 'Ligue o Instagram desta marca primeiro.');
    const env = serverEnv();
    const svc = createServiceClient();
    const { data: a } = await svc
      .from('social_accounts')
      .select('id, external_id, access_token_enc, refresh_token_enc, token_expires_at')
      .eq('id', acc.id)
      .single();
    if (!a) throw new AiError('invalid_input', 'Conta não encontrada.');
    const adapter = getAdapters(env).instagram;
    const accessToken = await ensureFreshToken(
      { id: a.id, externalId: a.external_id, accessTokenEnc: a.access_token_enc, refreshTokenEnc: a.refresh_token_enc, tokenExpiresAt: a.token_expires_at ? new Date(a.token_expires_at) : null },
      adapter,
      { repo: createTickRepo(svc, env.TOKEN_ENC_KEY), decrypt: (x) => decryptToken(x, env.TOKEN_ENC_KEY), fetch, now: () => new Date() },
    );
    const posts = await adapter.listRecentPosts({ id: a.id, externalId: a.external_id, accessToken }, new Date(0), { fetch });
    const captions = posts.map((p) => p.title ?? '').filter(Boolean).slice(0, 20);
    return { ok: true, voice: await runDraftVoice(deps, { brandId: brand.id, brand: toBrandAi(brand), captions }) };
  } catch (e) {
    return fail(e);
  }
}

export async function bestTimes(i: { brandId: string; excludePostId: string | null }): Promise<{ ok: true; slots: Slot[] } | Fail> {
  try {
    const db = await createServerClient();
    const brand = (await listBrands(db)).find((b) => b.id === i.brandId);
    if (!brand) return { ok: false, error: 'Marca não encontrada.' };
    const now = new Date();
    const { history, busy } = await bestTimeInputs(db, brand.id, i.excludePostId, now);
    return { ok: true, slots: suggestSlots({ history, goal: brand.goal, tz: brand.timezone, busy, now }) };
  } catch (e) {
    return fail(e);
  }
}

export async function aiStatus(): Promise<{ ok: true; hasKey: boolean; model: string; limitUsd: number; spentUsd: number; requests: number } | Fail> {
  try {
    const db = await createServerClient();
    const env = serverEnv();
    const [settings, spend] = await Promise.all([loadAiSettings(db), monthSpend(db, new Date())]);
    return {
      ok: true, hasKey: env.PLATFORM_MODE === 'fake' || !!env.OPENROUTER_API_KEY,
      model: settings.model, limitUsd: settings.limitUsd, spentUsd: spend.usd, requests: spend.requests,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function saveAiSettings(i: { model: string; limitUsd: number }): Promise<{ ok: true } | Fail> {
  const parsed = AiSettingsInput.safeParse(i);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  const db = await createServerClient();
  const { error } = await db
    .from('app_settings')
    .update({ ai_model: parsed.data.model, ai_monthly_limit_usd: parsed.data.limitUsd })
    .eq('id', true);
  if (error) return { ok: false, error: 'Não foi possível guardar as definições da IA.' };
  revalidatePath('/definicoes/ia');
  return { ok: true };
}
