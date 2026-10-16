-- MCP do Estúdio: origem do post e defesas para tokens OAuth de agentes (Claude).
-- Um token de agente é um JWT do dono com o claim client_id. Com ele só se criam/editam rascunhos,
-- ficheiros, ideias, prazos e registo; nada se apaga, agenda ou altera em contas/marcas/definições.

alter table public.posts add column if not exists origin text not null default 'app';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_origin_check') then
    alter table public.posts add constraint posts_origin_check check (origin in ('app', 'claude'));
  end if;
end $$;

create or replace function private.is_agent() returns boolean
  language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() ? 'client_id', false)
$$;
revoke execute on function private.is_agent() from public, anon;
grant execute on function private.is_agent() to authenticated, service_role;

create or replace function private.post_is_draft(p_post uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.posts where id = p_post and status = 'draft')
$$;
revoke execute on function private.post_is_draft(uuid) from public, anon;
grant execute on function private.post_is_draft(uuid) to authenticated, service_role;

do $$
declare t text;
begin
  -- Tabelas onde o agente pode criar/alterar (nunca apagar).
  foreach t in array array['media_assets', 'ideas', 'deadlines', 'activity_log'] loop
    execute format('drop policy if exists agent_no_delete on public.%I', t);
    execute format('create policy agent_no_delete on public.%I as restrictive for delete to authenticated using (not private.is_agent())', t);
  end loop;

  -- Ficheiros e registo: o agente só acrescenta (não troca o ficheiro de um post agendado nem reescreve o histórico).
  foreach t in array array['media_assets', 'activity_log'] loop
    execute format('drop policy if exists agent_no_update on public.%I', t);
    execute format('create policy agent_no_update on public.%I as restrictive for update to authenticated using (not private.is_agent())', t);
  end loop;

  -- Tabelas só de leitura para o agente.
  foreach t in array array['brands', 'social_accounts', 'app_settings', 'hashtag_groups', 'app_owner', 'post_metrics',
                           'account_metrics', 'api_usage', 'ai_usage'] loop
    execute format('drop policy if exists agent_read_only on public.%I', t);
    execute format('drop policy if exists agent_read_only_upd on public.%I', t);
    execute format('drop policy if exists agent_read_only_del on public.%I', t);
    execute format('create policy agent_read_only on public.%I as restrictive for insert to authenticated with check (not private.is_agent())', t);
    execute format('create policy agent_read_only_upd on public.%I as restrictive for update to authenticated using (not private.is_agent())', t);
    execute format('create policy agent_read_only_del on public.%I as restrictive for delete to authenticated using (not private.is_agent())', t);
  end loop;

  -- Mídia e destinos de um post: só enquanto o post é rascunho (save_post apaga e recria ao editar).
  foreach t in array array['post_media', 'post_targets'] loop
    execute format('drop policy if exists agent_draft_only on public.%I', t);
    execute format('create policy agent_draft_only on public.%I as restrictive for all to authenticated
                      using (not private.is_agent() or private.post_is_draft(post_id))
                      with check (not private.is_agent() or private.post_is_draft(post_id))', t);
  end loop;
end $$;

-- Posts: o agente só cria/edita rascunhos e não apaga.
drop policy if exists agent_draft_ins on public.posts;
drop policy if exists agent_draft_upd on public.posts;
drop policy if exists agent_no_delete on public.posts;
create policy agent_draft_ins on public.posts as restrictive for insert to authenticated
  with check (not private.is_agent() or (status = 'draft' and origin = 'claude'));
create policy agent_draft_upd on public.posts as restrictive for update to authenticated
  using (not private.is_agent() or status = 'draft') with check (not private.is_agent() or (status = 'draft' and origin = 'claude'));
create policy agent_no_delete on public.posts as restrictive for delete to authenticated
  using (not private.is_agent());

-- Ficheiros no Storage: o agente só cria (não apaga nem substitui).
drop policy if exists agent_no_delete on storage.objects;
create policy agent_no_delete on storage.objects as restrictive for delete to authenticated
  using (not private.is_agent());
drop policy if exists agent_no_update on storage.objects;
create policy agent_no_update on storage.objects as restrictive for update to authenticated
  using (not private.is_agent());

-- save_post: grava a origem; recusa agendar com token de agente.
create or replace function public.save_post(p jsonb) returns uuid
  language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_brand uuid := (p->>'brandId')::uuid;
  v_status post_status := case p->>'intent' when 'draft' then 'draft'::post_status else 'scheduled'::post_status end;
  v_origin text := coalesce(nullif(p->>'origin', ''), 'app');
begin
  if private.is_agent() and v_status <> 'draft' then raise exception 'Só rascunhos.'; end if;
  if private.is_agent() then v_origin := 'claude'; end if;

  if exists (
    select 1 from jsonb_array_elements_text(p->'mediaIds') m(id)
    left join media_assets a on a.id = m.id::uuid
    where a.id is null or a.brand_id <> v_brand
  ) then raise exception 'media_brand'; end if;

  if exists (
    select 1 from jsonb_array_elements(p->'targets') t
    left join social_accounts a on a.id = (t->>'accountId')::uuid
    where a.id is null or a.brand_id <> v_brand
  ) then raise exception 'account_brand'; end if;

  if v_id is null then
    insert into posts (brand_id, internal_title, scheduled_at, status, origin)
    values (v_brand, coalesce(p->>'internalTitle', ''), (p->>'scheduledAt')::timestamptz, v_status, v_origin)
    returning id into v_id;
  else
    perform 1 from posts where id = v_id and status in ('draft', 'scheduled') for update;
    if not found or exists (select 1 from post_targets where post_id = v_id and status <> 'pending') then
      raise exception 'post_locked';
    end if;
    update posts
       set brand_id = v_brand, internal_title = coalesce(p->>'internalTitle', ''),
           scheduled_at = (p->>'scheduledAt')::timestamptz, status = v_status, updated_at = now(),
           origin = case when private.is_agent() then 'claude' else origin end
     where id = v_id;
    if not found then raise exception 'post_locked'; end if;
    delete from post_media where post_id = v_id;
    delete from post_targets where post_id = v_id;
  end if;

  insert into post_media (post_id, media_id, position)
  select v_id, m.id::uuid, (m.ord - 1)::int
    from jsonb_array_elements_text(p->'mediaIds') with ordinality as m(id, ord);

  insert into post_targets (post_id, social_account_id, format, caption, title, options)
  select v_id, (t->>'accountId')::uuid, (t->>'format')::target_format, coalesce(t->>'caption', ''), nullif(t->>'title', ''),
         case when jsonb_typeof(t->'coverMs') = 'number' and (t->>'coverMs')::numeric >= 0
              then jsonb_build_object('thumbOffsetMs', round((t->>'coverMs')::numeric)::int)
              else '{}'::jsonb end
    from jsonb_array_elements(p->'targets') t;

  return v_id;
end $$;

revoke execute on function public.save_post(jsonb) from public, anon;
grant execute on function public.save_post(jsonb) to authenticated;
