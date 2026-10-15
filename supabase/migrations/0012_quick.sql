-- Subprojeto 3: grupos de hashtags por marca e horários fixos de publicação.

alter table public.brands
  add column if not exists posting_slots jsonb not null default '[]'::jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'brands_posting_slots_array') then
    alter table public.brands add constraint brands_posting_slots_array check (jsonb_typeof(posting_slots) = 'array');
  end if;
end $$;

create table if not exists public.hashtag_groups (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  tags text[] not null check (cardinality(tags) between 1 and 30),
  created_at timestamptz not null default now()
);
create index if not exists hashtag_groups_brand on public.hashtag_groups (brand_id, name);

alter table public.hashtag_groups enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'hashtag_groups' and policyname = 'owner_all') then
    create policy owner_all on public.hashtag_groups for all to authenticated using (private.is_owner()) with check (private.is_owner());
  end if;
end $$;
