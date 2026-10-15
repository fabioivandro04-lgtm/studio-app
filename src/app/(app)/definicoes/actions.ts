'use server';

import { revalidatePath } from 'next/cache';
import { normalizeHashtag } from '@/lib/ai/schemas';
import { BrandAiInput, BrandInput, HashtagGroupInput } from '@/lib/brands/schema';
import { createServerClient, createServiceClient } from '@/lib/db/clients';
import { countOpenTargets } from '@/lib/db/repo/accounts-repo';

export type ActionResult = { ok: true } | { ok: false; error: string };

const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? 'Dados inválidos.';

export async function saveBrand(input: { id?: string; name: string; color: string; timezone?: string }): Promise<ActionResult> {
  const parsed = BrandInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const db = await createServerClient();
  const res = input.id
    ? await db.from('brands').update(parsed.data).eq('id', input.id)
    : await db.from('brands').insert(parsed.data);
  if (res.error) return { ok: false, error: 'Não foi possível guardar a marca.' };
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function saveBrandAi(input: {
  brandId: string;
  aiContext: string;
  aiVoice: string;
  aiHashtags: string[];
  goal: 'contacts' | 'reach';
  postsPerWeek: number;
}): Promise<ActionResult> {
  const parsed = BrandAiInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const hashtags = [...new Set(parsed.data.aiHashtags.map(normalizeHashtag).filter((h): h is string => !!h))];
  const db = await createServerClient();
  const { error } = await db
    .from('brands')
    .update({ ai_context: parsed.data.aiContext.trim(), ai_voice: parsed.data.aiVoice.trim(), ai_hashtags: hashtags, goal: parsed.data.goal, posts_per_week: parsed.data.postsPerWeek })
    .eq('id', input.brandId);
  if (error) return { ok: false, error: 'Não foi possível guardar as definições de IA da marca.' };
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function deleteBrand(id: string): Promise<ActionResult> {
  const db = await createServerClient();
  const { count } = await db
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', id)
    .in('status', ['scheduled', 'publishing']);
  if ((count ?? 0) > 0) return { ok: false, error: 'Esta marca tem posts agendados. Cancele-os primeiro.' };
  // Os destinos impedem apagar contas e mídia (FK restrict); apagar primeiro os posts da marca.
  const posts = await db.from('posts').delete().eq('brand_id', id);
  if (posts.error) return { ok: false, error: 'Não foi possível apagar os posts da marca.' };
  const res = await db.from('brands').delete().eq('id', id);
  if (res.error) return { ok: false, error: 'Não foi possível apagar a marca.' };
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function disconnectAccount(id: string): Promise<ActionResult> {
  const db = await createServerClient();
  // RLS: confirma que a conta pertence ao dono antes de usar o cliente de serviço.
  const { data: account } = await db.from('social_accounts').select('id').eq('id', id).single();
  if (!account) return { ok: false, error: 'Conta não encontrada.' };
  if ((await countOpenTargets(db, id)) > 0) {
    return { ok: false, error: 'Esta conta tem posts agendados. Cancele-os ou mude-os de conta primeiro.' };
  }
  const svc = createServiceClient();
  const { count } = await svc.from('post_targets').select('id', { count: 'exact', head: true }).eq('social_account_id', id);
  const res =
    (count ?? 0) === 0
      ? await svc.from('social_accounts').delete().eq('id', id)
      : // Mantém o histórico de posts publicados, mas apaga os tokens.
        await svc
          .from('social_accounts')
          .update({ status: 'disabled', access_token_enc: '', refresh_token_enc: null, status_message: 'Desligada' })
          .eq('id', id);
  if (res.error) return { ok: false, error: 'Não foi possível desligar a conta.' };
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function saveHashtagGroup(input: { id?: string; brandId: string; name: string; tags: string }): Promise<ActionResult> {
  const parsed = HashtagGroupInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, brandId, name, tags } = parsed.data;
  const db = await createServerClient();
  const res = id
    ? await db.from('hashtag_groups').update({ name, tags }).eq('id', id).select('id')
    : await db.from('hashtag_groups').insert({ brand_id: brandId, name, tags }).select('id');
  if (res.error || !res.data?.length) return { ok: false, error: 'Não foi possível guardar o grupo.' };
  revalidatePath('/definicoes/marcas');
  return { ok: true };
}

export async function deleteHashtagGroup(id: string): Promise<ActionResult> {
  const db = await createServerClient();
  const { error } = await db.from('hashtag_groups').delete().eq('id', id);
  if (error) return { ok: false, error: 'Não foi possível apagar o grupo.' };
  revalidatePath('/definicoes/marcas');
  return { ok: true };
}
