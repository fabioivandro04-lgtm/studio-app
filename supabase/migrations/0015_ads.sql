-- Anúncios da Meta (Instagram/Facebook): contas de anúncios ligadas por marca, só para ler resultados (ads_read).
-- Os resultados são lidos na hora pela Marketing API; aqui fica só a conta e o token encriptado.

create table if not exists public.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  -- Id da conta de anúncios sem o prefixo "act_".
  external_id text not null check (external_id ~ '^[0-9]+$'),
  name text not null,
  currency text not null default 'EUR',
  access_token_enc text not null,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (brand_id, external_id)
);
create index if not exists ad_accounts_brand on public.ad_accounts (brand_id);

alter table public.ad_accounts enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ad_accounts' and policyname = 'owner_all') then
    create policy owner_all on public.ad_accounts for all to authenticated using (private.is_owner()) with check (private.is_owner());
  end if;
end $$;

-- O browser nunca lê o token; só o servidor (cliente de serviço) cria e atualiza contas.
revoke all on public.ad_accounts from anon, authenticated;
grant select (id, brand_id, external_id, name, currency, token_expires_at, created_at) on public.ad_accounts to authenticated;
grant delete on public.ad_accounts to authenticated;

-- Agente (Claude): só leitura.
drop policy if exists agent_read_only_del on public.ad_accounts;
create policy agent_read_only_del on public.ad_accounts as restrictive for delete to authenticated
  using (not private.is_agent());
