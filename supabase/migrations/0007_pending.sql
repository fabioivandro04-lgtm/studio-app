-- Estúdio v1 — ações pendentes (RLS aplica-se: security invoker)

create function public.retry_target(p_id uuid) returns void
  language plpgsql security invoker set search_path = public as $$
declare v_post uuid; v_status target_status;
begin
  select post_id, status into v_post, v_status from post_targets where id = p_id for update;
  if v_post is null then raise exception 'not_found'; end if;
  if v_status <> 'failed' then raise exception 'not_failed'; end if;
  update post_targets
     set status = 'pending', attempts = 0, last_error = null, progress = '{}', next_attempt_at = null, locked_until = null
   where id = p_id;
  -- O post volta à fila (claim_due_targets só apanha scheduled/publishing).
  update posts set status = 'scheduled', updated_at = now() where id = v_post and status not in ('draft');
  perform refresh_post_status(v_post);
end $$;

create function public.mark_target_done(p_id uuid, p_external_id text, p_permalink text) returns void
  language plpgsql security invoker set search_path = public as $$
declare v_post uuid; v_status target_status;
begin
  select post_id, status into v_post, v_status from post_targets where id = p_id for update;
  if v_post is null then raise exception 'not_found'; end if;
  if v_status not in ('awaiting_user', 'published') then raise exception 'not_awaiting'; end if;
  update post_targets
     set status = 'published',
         published_at = coalesce(published_at, now()),
         external_post_id = coalesce(nullif(p_external_id, ''), external_post_id),
         permalink = coalesce(nullif(p_permalink, ''), permalink),
         last_error = null
   where id = p_id;
  perform refresh_post_status(v_post);
end $$;

revoke execute on function public.retry_target(uuid) from public, anon;
grant execute on function public.retry_target(uuid) to authenticated;
revoke execute on function public.mark_target_done(uuid, text, text) from public, anon;
grant execute on function public.mark_target_done(uuid, text, text) to authenticated;
