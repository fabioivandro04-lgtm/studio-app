import type { SupabaseClient } from '@supabase/supabase-js';
import type { IdeaDraft } from '@/lib/ai/ideas-schema';
import type { Platform, TargetFormat } from '@/lib/platforms/types';

export type IdeaStatus = 'new' | 'used' | 'discarded';
export type IdeaKind = 'deadline' | 'shorts' | 'week';

export interface Idea extends IdeaDraft {
  id: string;
  brandId: string;
  kind: IdeaKind;
  status: IdeaStatus;
  suggestedAt: Date | null;
  postId: string | null;
  deadlineTitle: string | null;
  createdAt: Date;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const fromRow = (r: any): Idea => ({
  id: r.id, brandId: r.brand_id, kind: r.kind, status: r.status, title: r.title, hook: r.hook, outline: r.outline,
  caption: r.caption, format: (r.format as TargetFormat | null) ?? null, platforms: (r.platforms ?? []) as Platform[],
  suggestedAt: r.suggested_at ? new Date(r.suggested_at) : null, postId: r.post_id, deadlineTitle: r.deadlines?.title ?? null,
  createdAt: new Date(r.created_at),
});

export async function listIdeas(db: SupabaseClient, brandId: string | null): Promise<Idea[]> {
  let q = db.from('ideas').select('*, deadlines(title)').order('suggested_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }).limit(300);
  if (brandId) q = q.eq('brand_id', brandId);
  const { data, error } = await q;
  if (error) throw new Error(`ideas: ${error.message}`);
  return (data ?? []).map(fromRow);
}

export async function getIdea(db: SupabaseClient, id: string): Promise<Idea | null> {
  const { data } = await db.from('ideas').select('*, deadlines(title)').eq('id', id).maybeSingle();
  return data ? fromRow(data) : null;
}

export async function insertIdeas(
  db: SupabaseClient,
  rows: { brandId: string; kind: IdeaKind; deadlineId: string | null; suggestedAt: Date | null; idea: IdeaDraft }[],
): Promise<void> {
  const { error } = await db.from('ideas').insert(
    rows.map((r) => ({
      brand_id: r.brandId, kind: r.kind, deadline_id: r.deadlineId, suggested_at: r.suggestedAt?.toISOString() ?? null,
      title: r.idea.title, hook: r.idea.hook, outline: r.idea.outline, caption: r.idea.caption, format: r.idea.format, platforms: r.idea.platforms,
    })),
  );
  if (error) throw new Error(`ideas: ${error.message}`);
}

export async function setIdeaStatus(db: SupabaseClient, id: string, status: IdeaStatus, postId?: string): Promise<boolean> {
  const patch: Record<string, unknown> = { status };
  if (postId) patch.post_id = postId;
  const { data, error } = await db.from('ideas').update(patch).eq('id', id).select('id');
  if (error) throw new Error(`ideas: ${error.message}`);
  return (data ?? []).length > 0;
}

/** Títulos recentes (posts e ideias) da marca, para a IA não repetir temas. */
export async function recentTitles(db: SupabaseClient, brandId: string): Promise<string[]> {
  const [posts, ideas] = await Promise.all([
    db.from('posts').select('internal_title').eq('brand_id', brandId).neq('internal_title', '').order('created_at', { ascending: false }).limit(20),
    db.from('ideas').select('title').eq('brand_id', brandId).neq('status', 'discarded').order('created_at', { ascending: false }).limit(20),
  ]);
  return [...(posts.data ?? []).map((p) => p.internal_title as string), ...(ideas.data ?? []).map((i) => i.title as string)];
}

/** Posts (não cancelados) e ideias novas com data no intervalo [from, to). */
export async function plannedCount(db: SupabaseClient, brandId: string, from: Date, to: Date): Promise<number> {
  const head = { count: 'exact' as const, head: true };
  const [posts, ideas] = await Promise.all([
    db.from('posts').select('id', head).eq('brand_id', brandId).neq('status', 'cancelled').gte('scheduled_at', from.toISOString()).lt('scheduled_at', to.toISOString()),
    db.from('ideas').select('id', head).eq('brand_id', brandId).eq('status', 'new').gte('suggested_at', from.toISOString()).lt('suggested_at', to.toISOString()),
  ]);
  return (posts.count ?? 0) + (ideas.count ?? 0);
}

export async function upcomingDeadlines(db: SupabaseClient, brandId: string, from: string, to: string) {
  const { data } = await db.from('deadlines').select('id, title, due_date, institution, country').eq('brand_id', brandId).gte('due_date', from).lte('due_date', to).order('due_date');
  return (data ?? []).map((d) => ({ id: d.id as string, title: d.title as string, dueDate: String(d.due_date).slice(0, 10), institution: d.institution as string | null, country: d.country as string | null }));
}
