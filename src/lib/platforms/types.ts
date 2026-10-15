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
