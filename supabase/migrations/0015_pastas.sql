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

-- Resumo das pastas para a Biblioteca: nº de ficheiros, posts (não cancelados) que os usam e até 4 miniaturas.
-- security invoker: o RLS do utilizador aplica-se.
create or replace function public.media_folder_stats(p_brand uuid default null)
  returns table (folder_id uuid, files int, used_in int, previews text[])
  language sql stable security invoker set search_path = '' as $$
  select f.id,
    (select count(*)::int from public.media_assets m where m.folder_id = f.id),
    (select count(distinct pm.post_id)::int
       from public.post_media pm
       join public.posts p on p.id = pm.post_id
       join public.media_assets m on m.id = pm.media_id
      where m.folder_id = f.id and p.status <> 'cancelled'),
    array(select coalesce(m.thumbnail_path, m.storage_path)
            from public.media_assets m
           where m.folder_id = f.id and (m.thumbnail_path is not null or m.kind = 'image')
           order by m.created_at, m.id limit 4)
  from public.media_folders f
  where p_brand is null or f.brand_id = p_brand
  order by f.name
$$;
revoke execute on function public.media_folder_stats(uuid) from public, anon;
grant execute on function public.media_folder_stats(uuid) to authenticated, service_role;
