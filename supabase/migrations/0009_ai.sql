-- Estúdio — assistente de IA: contexto/voz/objetivo por marca, definições, registo de uso e métricas extra.
-- Idempotente: pode ser aplicada mais de uma vez.

alter table public.brands
  add column if not exists ai_context text not null default '' check (length(ai_context) <= 4000),
  add column if not exists ai_voice text not null default '' check (length(ai_voice) <= 2000),
  add column if not exists ai_hashtags text[] not null default '{}' check (coalesce(array_length(ai_hashtags, 1), 0) <= 10),
  add column if not exists goal text not null default 'contacts' check (goal in ('contacts', 'reach'));

create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  ai_model text not null default 'anthropic/claude-sonnet-5.5' check (length(ai_model) between 3 and 100),
  ai_monthly_limit_usd numeric(8, 2) not null default 5 check (ai_monthly_limit_usd between 0 and 1000)
);
insert into public.app_settings default values on conflict (id) do nothing;

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  brand_id uuid references public.brands(id) on delete set null,
  kind text not null check (kind in ('suggest', 'refine', 'voice')),
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(10, 6) not null default 0
);
create index if not exists ai_usage_created_at on public.ai_usage (created_at);

alter table public.app_settings enable row level security;
alter table public.ai_usage enable row level security;
drop policy if exists owner_all on public.app_settings;
create policy owner_all on public.app_settings for all to authenticated
  using (private.is_owner()) with check (private.is_owner());
drop policy if exists owner_all on public.ai_usage;
create policy owner_all on public.ai_usage for all to authenticated
  using (private.is_owner()) with check (private.is_owner());

alter table public.post_metrics
  add column if not exists profile_visits bigint,
  add column if not exists follows bigint;
