'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerClient } from '@/lib/db/clients';
import { toMediaInfo } from '@/lib/db/repo/tick-repo';
import { canDeletePost } from '@/lib/posts/delete-rules';
import { checkPost, PostInput, type PostError, type PostInputT } from '@/lib/posts/schema';

export type SaveResult = { ok: true; id: string } | { ok: false; errors: PostError[] };

const DB_ERRORS: Record<string, string> = {
  post_locked: 'Este post já começou a publicar e não pode ser alterado.',
  media_brand: 'Um dos ficheiros não pertence a esta marca.',
  account_brand: 'Uma das contas não pertence a esta marca.',
};

export async function savePost(raw: PostInputT): Promise<SaveResult> {
  const parsed = PostInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => ({ targetIndex: null, field: String(i.path[0] ?? ''), message: i.message })) };
  }
  const input = parsed.data;
  const db = await createServerClient();
  const { data: brand } = await db.from('brands').select('id, timezone').eq('id', input.brandId).single();
  if (!brand) return { ok: false, errors: [{ targetIndex: null, field: 'brandId', message: 'Marca não encontrada.' }] };

  const [{ data: accounts }, { data: media }] = await Promise.all([
    db.from('social_accounts').select('id, platform').eq('brand_id', brand.id).neq('status', 'disabled'),
    db.from('media_assets').select('id, kind, mime, size_bytes, width, height, duration_s, storage_path').in('id', input.mediaIds),
  ]);
  const check = checkPost(input, (media ?? []).map(toMediaInfo), accounts ?? [], brand.timezone, new Date());
  if (!check.ok) return check;

  const { data: id, error } = await db.rpc('save_post', {
    p: { ...input, scheduledAt: check.scheduledAt.toISOString() },
  });
  if (error) {
    const known = Object.keys(DB_ERRORS).find((k) => error.message.includes(k));
    return { ok: false, errors: [{ targetIndex: null, field: 'form', message: known ? DB_ERRORS[known] : 'Não foi possível guardar o post.' }] };
  }
  revalidatePath('/calendario');
  revalidatePath('/pendentes');
  revalidatePath('/caixa');
  return { ok: true, id: id as string };
}

export async function cancelPost(id: string): Promise<{ ok: boolean; error?: string }> {
  const db = await createServerClient();
  const { error } = await db.rpc('cancel_post', { p_id: id });
  if (error) return { ok: false, error: 'Não foi possível cancelar o post.' };
  revalidatePath('/calendario');
  return { ok: true };
}

export async function duplicatePost(id: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = await createServerClient();
  const { data: post } = await db.from('posts').select('brand_id, internal_title, scheduled_at').eq('id', id).single();
  if (!post) return { ok: false, error: 'Post não encontrado.' };
  const [{ data: pm }, { data: targets }] = await Promise.all([
    db.from('post_media').select('media_id, position').eq('post_id', id).order('position'),
    db.from('post_targets').select('social_account_id, format, caption, title, options').eq('post_id', id),
  ]);
  const { data: newId, error } = await db.rpc('save_post', {
    p: {
      brandId: post.brand_id, internalTitle: `${post.internal_title} (cópia)`.trim(), scheduledAt: post.scheduled_at, intent: 'draft',
      mediaIds: (pm ?? []).map((m) => m.media_id),
      targets: (targets ?? []).map((t) => ({
        accountId: t.social_account_id, format: t.format, caption: t.caption, title: t.title ?? '',
        coverMs: typeof t.options?.thumbOffsetMs === 'number' ? t.options.thumbOffsetMs : null,
      })),
    },
  });
  if (error) return { ok: false, error: 'Não foi possível duplicar o post.' };
  revalidatePath('/calendario');
  return { ok: true, id: newId as string };
}

/** Apaga o post do Estúdio (com redes, métricas e ligação às ideias). Não mexe nas redes sociais. */
export async function deletePost(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.guid().safeParse(id).success) return { ok: false, error: 'Post não encontrado.' };
  const db = await createServerClient();
  const [{ data: post }, { data: targets }] = await Promise.all([
    db.from('posts').select('status').eq('id', id).maybeSingle(),
    db.from('post_targets').select('status').eq('post_id', id),
  ]);
  if (!post) return { ok: false, error: 'Post não encontrado.' };
  if (!canDeletePost(post.status, (targets ?? []).map((t) => t.status))) {
    return { ok: false, error: post.status === 'scheduled' ? 'Cancele o post antes de o apagar.' : 'Este post está a ser publicado. Tente mais tarde.' };
  }
  const { data, error } = await db.from('posts').delete().eq('id', id).select('id');
  if (error || !data?.length) return { ok: false, error: 'Não foi possível apagar o post.' };
  revalidatePath('/calendario');
  revalidatePath('/metricas');
  return { ok: true };
}
