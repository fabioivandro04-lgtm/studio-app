-- Estúdio v1 — acesso exclusivo do dono

create table app_owner (user_id uuid primary key references auth.users(id) on delete cascade);

create function public.is_owner() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_owner where user_id = auth.uid())
$$;
revoke execute on function public.is_owner() from public;
grant execute on function public.is_owner() to anon, authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array['brands','social_accounts','media_assets','posts','post_media','post_targets',
                           'deadlines','post_metrics','account_metrics','activity_log','api_usage','app_owner'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())', t);
  end loop;
end $$;

-- O browser nunca lê tokens: retirar o acesso às colunas encriptadas.
revoke select on public.social_accounts from anon, authenticated;
grant select (id, brand_id, platform, external_id, handle, display_name, avatar_url, token_expires_at,
              refresh_expires_at, token_updated_at, scopes, status, status_message, created_at)
  on public.social_accounts to authenticated;
revoke insert, update on public.social_accounts from anon, authenticated;
grant update (status, status_message) on public.social_accounts to authenticated;

-- Armazenamento de mídia (bucket privado)
insert into storage.buckets (id, name, public) values ('media', 'media', false) on conflict (id) do nothing;
create policy media_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.is_owner());
create policy media_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_owner());
create policy media_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_owner());
create policy media_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_owner());
