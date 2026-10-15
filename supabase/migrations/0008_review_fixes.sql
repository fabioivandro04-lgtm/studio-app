-- Estúdio v1 — correções da revisão final

-- C1: nunca reagendar um post cancelado.
-- I1: guardar o contentor anterior (Instagram) para recuperar uma publicação já feita em vez de publicar duas vezes.
create or replace function public.retry_target(p_id uuid) returns void
  language plpgsql security invoker set search_path = public as $$
declare v_post uuid; v_status target_status; v_post_status post_status; v_container text;
begin
  select t.post_id, t.status, p.status, t.progress->>'containerId'
    into v_post, v_status, v_post_status, v_container
    from post_targets t join posts p on p.id = t.post_id
   where t.id = p_id
     for update of t;
  if v_post is null then raise exception 'not_found'; end if;
  if v_post_status = 'cancelled' then raise exception 'cancelled'; end if;
  if v_status <> 'failed' then raise exception 'not_failed'; end if;
  update post_targets
     set status = 'pending', attempts = 0, last_error = null, next_attempt_at = null, locked_until = null,
         progress = case when v_container is null then '{}'::jsonb else jsonb_build_object('previousContainerId', v_container) end
   where id = p_id;
  update posts set status = 'scheduled', updated_at = now() where id = v_post and status <> 'draft';
  perform refresh_post_status(v_post);
end $$;
