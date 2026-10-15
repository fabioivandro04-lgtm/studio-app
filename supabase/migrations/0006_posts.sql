-- Estúdio v1 — guardar e cancelar posts de forma atómica (RLS aplica-se: security invoker)

create function public.save_post(p jsonb) returns uuid
  language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_brand uuid := (p->>'brandId')::uuid;
  v_status post_status := case p->>'intent' when 'draft' then 'draft'::post_status else 'scheduled'::post_status end;
begin
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
    insert into posts (brand_id, internal_title, scheduled_at, status)
    values (v_brand, coalesce(p->>'internalTitle', ''), (p->>'scheduledAt')::timestamptz, v_status)
    returning id into v_id;
  else
    perform 1 from posts where id = v_id and status in ('draft', 'scheduled') for update;
    if not found or exists (select 1 from post_targets where post_id = v_id and status <> 'pending') then
      raise exception 'post_locked';
    end if;
    update posts
       set brand_id = v_brand, internal_title = coalesce(p->>'internalTitle', ''),
           scheduled_at = (p->>'scheduledAt')::timestamptz, status = v_status, updated_at = now()
     where id = v_id;
    delete from post_media where post_id = v_id;
    delete from post_targets where post_id = v_id;
  end if;

  insert into post_media (post_id, media_id, position)
  select v_id, m.id::uuid, (m.ord - 1)::int
    from jsonb_array_elements_text(p->'mediaIds') with ordinality as m(id, ord);

  insert into post_targets (post_id, social_account_id, format, caption, title)
  select v_id, (t->>'accountId')::uuid, (t->>'format')::target_format, coalesce(t->>'caption', ''), nullif(t->>'title', '')
    from jsonb_array_elements(p->'targets') t;

  return v_id;
end $$;

revoke execute on function public.save_post(jsonb) from public, anon;
grant execute on function public.save_post(jsonb) to authenticated;

create function public.cancel_post(p_id uuid) returns void
  language plpgsql security invoker set search_path = public as $$
begin
  update posts set status = 'cancelled', updated_at = now() where id = p_id;
  update post_targets set status = 'failed', last_error = 'Cancelado', locked_until = null
   where post_id = p_id and status in ('pending', 'uploading', 'processing');
end $$;

revoke execute on function public.cancel_post(uuid) from public, anon;
grant execute on function public.cancel_post(uuid) to authenticated;
