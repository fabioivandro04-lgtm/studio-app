'use server';

import { revalidatePath } from 'next/cache';
import { decryptToken } from '@/lib/crypto/tokens';
import { createServerClient, createServiceClient } from '@/lib/db/clients';
import { createTickRepo } from '@/lib/db/repo/tick-repo';
import { serverEnv } from '@/lib/env';
import { getAdapters } from '@/lib/platforms/registry';
import type { Platform, RecentPost } from '@/lib/platforms/types';
import { ensureFreshToken } from '@/lib/publishing/tokens';

type Result = { ok: true } | { ok: false; error: string };

const refresh = () => {
  revalidatePath('/pendentes');
  revalidatePath('/calendario');
};

export async function markDone(targetId: string): Promise<Result> {
  const db = await createServerClient();
  const { error } = await db.rpc('mark_target_done', { p_id: targetId, p_external_id: null, p_permalink: null });
  if (error) return { ok: false, error: 'Não foi possível marcar como feito.' };
  refresh();
  return { ok: true };
}

export async function retryTarget(targetId: string): Promise<Result> {
  const db = await createServerClient();
  const { error } = await db.rpc('retry_target', { p_id: targetId });
  if (error) return { ok: false, error: 'Não foi possível tentar de novo.' };
  refresh();
  return { ok: true };
}

export async function associatePost(targetId: string, externalId: string, permalink: string | null): Promise<Result> {
  const db = await createServerClient();
  const { error } = await db.rpc('mark_target_done', { p_id: targetId, p_external_id: externalId, p_permalink: permalink });
  if (error) return { ok: false, error: 'Não foi possível associar o vídeo.' };
  refresh();
  return { ok: true };
}

/** Vídeos recentes da conta do destino, para associar manualmente. */
export async function listCandidates(targetId: string): Promise<{ ok: true; posts: RecentPost[] } | { ok: false; error: string }> {
  const db = await createServerClient();
  // RLS: só encontra o destino se o utilizador for o dono.
  const { data: t } = await db.from('post_targets').select('social_account_id, progress, updated_at').eq('id', targetId).single();
  if (!t) return { ok: false, error: 'Destino não encontrado.' };
  const env = serverEnv();
  const svc = createServiceClient();
  const { data: a } = await svc
    .from('social_accounts')
    .select('id, platform, external_id, access_token_enc, refresh_token_enc, token_expires_at')
    .eq('id', t.social_account_id)
    .single();
  if (!a) return { ok: false, error: 'Conta não encontrada.' };
  const adapter = getAdapters(env)[a.platform as Platform];
  try {
    const decrypt = (e: string) => decryptToken(e, env.TOKEN_ENC_KEY);
    const accessToken = await ensureFreshToken(
      { id: a.id, externalId: a.external_id, accessTokenEnc: a.access_token_enc, refreshTokenEnc: a.refresh_token_enc, tokenExpiresAt: a.token_expires_at ? new Date(a.token_expires_at) : null },
      adapter,
      { repo: createTickRepo(svc, env.TOKEN_ENC_KEY), decrypt, fetch, now: () => new Date() },
    );
    const uploadedAt = new Date((t.progress as { uploadedAt?: string })?.uploadedAt ?? t.updated_at);
    const posts = await adapter.listRecentPosts({ id: a.id, externalId: a.external_id, accessToken }, new Date(uploadedAt.getTime() - 3_600_000), { fetch });
    return { ok: true, posts: posts.map((p) => ({ ...p, createdAt: new Date(p.createdAt) })) };
  } catch (e) {
    return { ok: false, error: (e as { userMessage?: string }).userMessage ?? 'Não foi possível obter os vídeos.' };
  }
}
