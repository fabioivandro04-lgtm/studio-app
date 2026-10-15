-- Estúdio — ideias de conteúdo geradas pela IA e posts por semana de cada marca. Idempotente.

alter table public.brands
  add column if not exists posts_per_week int not null default 3 check (posts_per_week between 1 and 21);

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  deadline_id uuid references public.deadlines(id) on delete set null,
  kind text not null check (kind in ('deadline', 'shorts', 'week')),
  title text not null check (length(title) between 1 and 120),
  hook text not null default '' check (length(hook) <= 300),
  outline text not null default '' check (length(outline) <= 1500),
  caption text not null default '' check (length(caption) <= 2200),
  format text check (format in ('ig_image', 'ig_carousel', 'ig_reel', 'ig_story', 'tiktok_video', 'yt_short')),
  platforms text[] not null default '{}',
  suggested_at timestamptz,
  status text not null default 'new' check (status in ('new', 'used', 'discarded')),
  post_id uuid references public.posts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ideas_brand_status on public.ideas (brand_id, status, created_at desc);

alter table public.ideas enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ideas' and policyname = 'owner_all') then
    create policy owner_all on public.ideas for all to authenticated using (private.is_owner()) with check (private.is_owner());
  end if;
end $$;

-- O registo de gastos passa a aceitar pedidos de ideias.
alter table public.ai_usage drop constraint if exists ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check check (kind in ('suggest', 'refine', 'voice', 'ideas'));
