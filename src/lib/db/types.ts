import type { Goal } from '@/lib/ai/types';
import type { Platform, PostStatus, TargetFormat, TargetStatus } from '@/lib/platforms/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const date = (v: unknown): Date | null => (v == null ? null : new Date(v as string));
const num = (v: unknown): number | null => (v == null ? null : Number(v));

export interface Brand {
  id: string; name: string; color: string; timezone: string; createdAt: Date;
  aiContext: string; aiVoice: string; aiHashtags: string[]; goal: Goal;
}
export const fromBrandRow = (r: Row): Brand => ({
  id: r.id, name: r.name, color: r.color, timezone: r.timezone, createdAt: new Date(r.created_at),
  aiContext: r.ai_context ?? '', aiVoice: r.ai_voice ?? '', aiHashtags: r.ai_hashtags ?? [], goal: r.goal === 'reach' ? 'reach' : 'contacts',
});

export type AccountStatus = 'active' | 'needs_reauth' | 'disabled';
/** Conta como o browser a vê (sem tokens). */
export interface SocialAccount {
  id: string; brandId: string; platform: Platform; externalId: string; handle: string; displayName: string;
  avatarUrl: string | null; tokenExpiresAt: Date | null; status: AccountStatus; statusMessage: string | null;
}
export const fromAccountRow = (r: Row): SocialAccount => ({
  id: r.id, brandId: r.brand_id, platform: r.platform, externalId: r.external_id, handle: r.handle,
  displayName: r.display_name, avatarUrl: r.avatar_url ?? null, tokenExpiresAt: date(r.token_expires_at),
  status: r.status, statusMessage: r.status_message ?? null,
});

export interface MediaAsset {
  id: string; brandId: string; storagePath: string; kind: 'image' | 'video'; mime: string; sizeBytes: number;
  width: number | null; height: number | null; durationS: number | null; thumbnailPath: string | null;
  originalName: string | null; tags: string[]; createdAt: Date;
}
export const fromMediaRow = (r: Row): MediaAsset => ({
  id: r.id, brandId: r.brand_id, storagePath: r.storage_path, kind: r.kind, mime: r.mime,
  sizeBytes: Number(r.size_bytes), width: num(r.width), height: num(r.height), durationS: num(r.duration_s),
  thumbnailPath: r.thumbnail_path ?? null, originalName: r.original_name ?? null, tags: r.tags ?? [],
  createdAt: new Date(r.created_at),
});

export interface Post {
  id: string; brandId: string; internalTitle: string; scheduledAt: Date | null; status: PostStatus;
  createdAt: Date; updatedAt: Date;
}
export const fromPostRow = (r: Row): Post => ({
  id: r.id, brandId: r.brand_id, internalTitle: r.internal_title, scheduledAt: date(r.scheduled_at),
  status: r.status, createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
});

export interface PostTarget {
  id: string; postId: string; socialAccountId: string; format: TargetFormat; caption: string; title: string | null;
  options: Record<string, unknown>; status: TargetStatus; progress: Record<string, unknown>; attempts: number;
  nextAttemptAt: Date | null; lockedUntil: Date | null; externalPostId: string | null; permalink: string | null;
  lastError: string | null; publishedAt: Date | null; updatedAt: Date;
}
export const fromPostTargetRow = (r: Row): PostTarget => ({
  id: r.id, postId: r.post_id, socialAccountId: r.social_account_id, format: r.format, caption: r.caption,
  title: r.title ?? null, options: r.options ?? {}, status: r.status, progress: r.progress ?? {},
  attempts: r.attempts, nextAttemptAt: date(r.next_attempt_at), lockedUntil: date(r.locked_until),
  externalPostId: r.external_post_id ?? null, permalink: r.permalink ?? null, lastError: r.last_error ?? null,
  publishedAt: date(r.published_at), updatedAt: new Date(r.updated_at),
});

export interface Deadline {
  id: string; brandId: string; title: string; country: string | null; institution: string | null;
  dueDate: string; url: string | null; notes: string | null;
}
export const fromDeadlineRow = (r: Row): Deadline => ({
  id: r.id, brandId: r.brand_id, title: r.title, country: r.country ?? null, institution: r.institution ?? null,
  dueDate: typeof r.due_date === 'string' ? r.due_date : (r.due_date as Date).toISOString().slice(0, 10),
  url: r.url ?? null, notes: r.notes ?? null,
});

export interface PostMetricsRow {
  postTargetId: string; collectedOn: string; views: number | null; reach: number | null; likes: number | null;
  comments: number | null; shares: number | null; saves: number | null; watchTimeS: number | null;
}
export const fromPostMetricsRow = (r: Row): PostMetricsRow => ({
  postTargetId: r.post_target_id, collectedOn: String(r.collected_on).slice(0, 10), views: num(r.views),
  reach: num(r.reach), likes: num(r.likes), comments: num(r.comments), shares: num(r.shares), saves: num(r.saves),
  watchTimeS: num(r.watch_time_s),
});

export interface AccountMetricsRow { socialAccountId: string; collectedOn: string; followers: number | null; views: number | null }
export const fromAccountMetricsRow = (r: Row): AccountMetricsRow => ({
  socialAccountId: r.social_account_id, collectedOn: String(r.collected_on).slice(0, 10),
  followers: num(r.followers), views: num(r.views),
});

export interface ActivityLog {
  id: number; brandId: string | null; level: 'info' | 'warn' | 'error'; source: string; message: string;
  context: unknown; createdAt: Date;
}
export const fromActivityRow = (r: Row): ActivityLog => ({
  id: Number(r.id), brandId: r.brand_id ?? null, level: r.level, source: r.source, message: r.message,
  context: r.context ?? null, createdAt: new Date(r.created_at),
});
