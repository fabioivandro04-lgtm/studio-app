-- Respostas com IA (mensagens e comentários) e relatório semanal.

-- Respostas guardadas: perguntas frequentes e as respostas certas (preços, vagas, prazos). A IA só usa isto e o contexto.
alter table public.brands
  add column if not exists reply_knowledge text not null default '' check (length(reply_knowledge) <= 4000);

alter table public.ai_usage drop constraint if exists ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check check (kind in ('suggest', 'refine', 'voice', 'ideas', 'reply', 'report'));

-- Um relatório por marca e por semana (segunda-feira da semana a que se refere).
create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  facts jsonb not null,
  report jsonb not null,
  created_at timestamptz not null default now(),
  unique (brand_id, week_start)
);

alter table public.weekly_reports enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'weekly_reports' and policyname = 'owner_all') then
    create policy owner_all on public.weekly_reports for all to authenticated using (private.is_owner()) with check (private.is_owner());
  end if;
end $$;

-- Agente (Claude): só leitura.
drop policy if exists agent_read_only on public.weekly_reports;
drop policy if exists agent_read_only_upd on public.weekly_reports;
drop policy if exists agent_read_only_del on public.weekly_reports;
create policy agent_read_only on public.weekly_reports as restrictive for insert to authenticated with check (not private.is_agent());
create policy agent_read_only_upd on public.weekly_reports as restrictive for update to authenticated using (not private.is_agent());
create policy agent_read_only_del on public.weekly_reports as restrictive for delete to authenticated using (not private.is_agent());
