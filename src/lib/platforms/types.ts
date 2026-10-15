import type { MediaStorage } from '@/lib/media/storage';

export type Platform = 'instagram' | 'tiktok' | 'youtube';
export type TargetFormat = 'ig_image' | 'ig_carousel' | 'ig_reel' | 'ig_story' | 'tiktok_video' | 'yt_short';
export type TargetStatus = 'pending' | 'uploading' | 'processing' | 'awaiting_user' | 'published' | 'failed';
export type PostStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'needs_action'
  | 'published'
  | 'partial'
  | 'failed'
  | 'cancelled';

export const FORMAT_PLATFORM: Record<TargetFormat, Platform> = {
  ig_image: 'instagram',
  ig_carousel: 'instagram',
  ig_reel: 'instagram',
  ig_story: 'instagram',
  tiktok_video: 'tiktok',
  yt_short: 'youtube',
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

export interface MediaInfo {
  id: string;
  kind: 'image' | 'video';
  mime: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationS: number | null;
  storagePath: string;
}

export interface TargetDraft {
  format: TargetFormat;
  caption: string;
  title: string | null;
}

export interface ValidationError {
  field: 'media' | 'caption' | 'title' | 'format';
  message: string;
}

export type Progress = Record<string, unknown>;

export interface TargetCtx extends TargetDraft {
  id: string;
  options: Record<string, unknown>;
  progress: Progress;
  media: MediaInfo[];
}

export interface AccountCtx {
  id: string;
  externalId: string;
  accessToken: string;
}

export interface AdvanceDeps {
  fetch: typeof fetch;
  storage: MediaStorage;
  now(): Date;
  deadline: Date;
  usageToday(kind: string): Promise<number>;
  recordUsage(kind: string, units: number): Promise<void>;
}

export type AdvanceResult =
  | { kind: 'progress'; status: 'uploading' | 'processing'; progress: Progress }
  | { kind: 'awaiting_user'; progress: Progress; externalPostId: string | null; permalink: string | null }
  | { kind: 'published'; progress: Progress; externalPostId: string; permalink: string | null };

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  refreshExpiresAt: Date | null;
  scopes: string[];
}

export interface AccountProfile {
  externalId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface PostMetrics {
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  watchTimeS: number | null;
  isPublic: boolean | null;
  raw: unknown;
  /** Só Instagram: visitas ao perfil e seguidores ganhos a partir do post. */
  profileVisits?: number | null;
  follows?: number | null;
}

export interface AccountMetrics {
  followers: number | null;
  views: number | null;
  raw: unknown;
}

export interface RecentPost {
  externalId: string;
  createdAt: Date;
  permalink: string | null;
  thumbnailUrl: string | null;
  title: string | null;
}

type FetchDeps = Pick<AdvanceDeps, 'fetch'>;
type FetchNowDeps = Pick<AdvanceDeps, 'fetch' | 'now'>;

export interface PlatformAdapter {
  platform: Platform;
  formats: TargetFormat[];
  validate(draft: TargetDraft, media: MediaInfo[]): ValidationError[];
  advance(target: TargetCtx, account: AccountCtx, deps: AdvanceDeps): Promise<AdvanceResult>;
  fetchAccountMetrics(account: AccountCtx, deps: FetchDeps): Promise<AccountMetrics>;
  fetchPostMetrics(account: AccountCtx, externalIds: string[], deps: FetchDeps): Promise<Record<string, PostMetrics>>;
  listRecentPosts(account: AccountCtx, since: Date, deps: FetchDeps): Promise<RecentPost[]>;
  refreshToken(tokens: { accessToken: string; refreshToken: string | null }, deps: FetchNowDeps): Promise<TokenSet>;
  authorizeUrl(state: string, redirectUri: string): string;
  exchangeCode(
    code: string,
    redirectUri: string,
    deps: FetchNowDeps,
  ): Promise<{ tokens: TokenSet; profile: AccountProfile }>;
}
