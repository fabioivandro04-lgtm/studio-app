-- Estúdio v1 — esquema base

create type platform as enum ('instagram', 'tiktok', 'youtube');
create type account_status as enum ('active', 'needs_reauth', 'disabled');
create type media_kind as enum ('image', 'video');
create type post_status as enum ('draft', 'scheduled', 'publishing', 'needs_action', 'published', 'partial', 'failed', 'cancelled');
create type target_format as enum ('ig_image', 'ig_carousel', 'ig_reel', 'ig_story', 'tiktok_video', 'yt_short');
create type target_status as enum ('pending', 'uploading', 'processing', 'awaiting_user', 'published', 'failed');
create type log_level as enum ('info', 'warn', 'error');

create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  timezone text not null default 'Africa/Maputo',
  created_at timestamptz not null default now()
);

create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  platform platform not null,
  external_id text not null,
  handle text not null,
  display_name text not null,
  avatar_url text,
  access_token_enc text not null,
  refresh_token_enc text,
  token_expires_at timestamptz,
  refresh_expires_at timestamptz,
  token_updated_at timestamptz not null default now(),
  scopes text[] not null default '{}',
  status account_status not null default 'active',
  status_message text,
  created_at timestamptz not null default now(),
  unique (brand_id, platform, external_id)
);

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  storage_path text not null unique,
  kind media_kind not null,
  mime text not null,
  size_bytes bigint not null check (size_bytes > 0),
  width int,
  height int,
  duration_s numeric(10, 2),
  thumbnail_path text,
  original_name text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index media_assets_brand_idx on media_assets (brand_id, created_at desc);

create table posts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  internal_title text not null default '',
  scheduled_at timestamptz,
  status post_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_scheduled_idx on posts (scheduled_at);

create table post_media (
  post_id uuid not null references posts(id) on delete cascade,
  media_id uuid not null references media_assets(id) on delete restrict,
  position int not null,
  primary key (post_id, position)
);

create table post_targets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  social_account_id uuid not null references social_accounts(id) on delete restrict,
  format target_format not null,
  caption text not null default '',
  title text,
  options jsonb not null default '{}',
  status target_status not null default 'pending',
  progress jsonb not null default '{}',
  attempts int not null default 0,
  next_attempt_at timestamptz,
  locked_until timestamptz,
  external_post_id text,
  permalink text,
  last_error text,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);
create index post_targets_status_idx on post_targets (status, next_attempt_at);
create index post_targets_post_idx on post_targets (post_id);

create function post_targets_format_check() returns trigger language plpgsql as $$
declare p platform;
begin
  select platform into p from social_accounts where id = new.social_account_id;
  if (new.format::text like 'ig\_%' and p <> 'instagram')
     or (new.format::text like 'tiktok\_%' and p <> 'tiktok')
     or (new.format::text like 'yt\_%' and p <> 'youtube') then
    raise exception 'formato incompatível com a conta (% em %)', new.format, p;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger post_targets_format_check before insert or update on post_targets
  for each row execute function post_targets_format_check();

create table deadlines (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  title text not null,
  country text,
  institution text,
  due_date date not null,
  url text,
  notes text,
  created_at timestamptz not null default now()
);
create index deadlines_brand_idx on deadlines (brand_id, due_date);

create table post_metrics (
  post_target_id uuid not null references post_targets(id) on delete cascade,
  collected_on date not null,
  views bigint, reach bigint, likes bigint, comments bigint, shares bigint, saves bigint,
  watch_time_s bigint,
  raw jsonb,
  primary key (post_target_id, collected_on)
);

create table account_metrics (
  social_account_id uuid not null references social_accounts(id) on delete cascade,
  collected_on date not null,
  followers bigint,
  views bigint,
  raw jsonb,
  primary key (social_account_id, collected_on)
);

create table activity_log (
  id bigint generated always as identity primary key,
  brand_id uuid references brands(id) on delete cascade,
  level log_level not null,
  source text not null,
  message text not null,
  context jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_created_idx on activity_log (created_at desc);

create table api_usage (
  social_account_id uuid not null references social_accounts(id) on delete cascade,
  day date not null,
  kind text not null,
  count bigint not null default 0,
  primary key (social_account_id, day, kind)
);
