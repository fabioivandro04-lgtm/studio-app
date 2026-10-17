-- Pastas na Biblioteca: cada ficheiro pode estar numa pasta (tema/abordagem) da mesma marca. Idempotente.
-- Apagar uma pasta nunca apaga ficheiros (ficam "Sem pasta"). O agente (Claude) lê e cria pastas, nunca altera nem apaga.

create table if not exists public.media_folders (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  notes text not null default '' check (length(notes) <= 2000),
  created_at timestamptz not null default now()
);
create unique index if not exists media_folders_brand_name on public.media_folders (brand_id, lower(name));

alter table public.media_assets add column if not exists folder_id uuid references public.media_folders(id) on delete set null;
create index if not exists media_assets_folder_idx on public.media_assets (folder_id, created_at);

create or replace function private.media_folder_same_brand() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.folder_id is not null
     and not exists (select 1 from public.media_folders f where f.id = new.folder_id and f.brand_id = new.brand_id) then
    raise exception 'A pasta é de outra marca.';
  end if;
  return new;
end $$;
revoke execute on function private.media_folder_same_brand() from public, anon;

drop trigger if exists media_folder_same_brand on public.media_assets;
create trigger media_folder_same_brand before insert or update of folder_id, brand_id on public.media_assets
  for each row execute function private.media_folder_same_brand();

alter table public.media_folders enable row level security;
drop policy if exists owner_all on public.media_folders;
create policy owner_all on public.media_folders for all to authenticated using (private.is_owner()) with check (private.is_owner());
drop policy if exists agent_no_update on public.media_folders;
create policy agent_no_update on public.media_folders as restrictive for update to authenticated using (not private.is_agent());
drop policy if exists agent_no_delete on public.media_folders;
create policy agent_no_delete on public.media_folders as restrictive for delete to authenticated using (not private.is_agent());
