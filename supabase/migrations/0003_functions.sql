-- Estúdio v1 — funções do motor de publicação

create function public.claim_due_targets(p_limit int, p_lock_seconds int default 120)
  returns setof public.post_targets
  language plpgsql security invoker set search_path = public as $$
begin
  return query
  with due as (
    select t.id
      from post_targets t
      join posts p on p.id = t.post_id
      join social_accounts a on a.id = t.social_account_id
     where t.status in ('pending', 'uploading', 'processing')
       and p.status in ('scheduled', 'publishing')
       and p.scheduled_at <= now()
       and coalesce(t.next_attempt_at, '-infinity') <= now()
       and coalesce(t.locked_until, '-infinity') < now()
       and a.status = 'active'
     order by p.scheduled_at, t.id
     limit p_limit
       for update of t skip locked
  )
  update post_targets t
     set locked_until = now() + make_interval(secs => p_lock_seconds)
    from due
   where t.id = due.id
  returning t.*;
end $$;

revoke execute on function public.claim_due_targets(int, int) from public, anon, authenticated;
grant execute on function public.claim_due_targets(int, int) to service_role;

-- Mesma regra que derivePostStatus (src/lib/publishing/status.ts).
create function public.refresh_post_status(p_post_id uuid)
  returns post_status
  language plpgsql security invoker set search_path = public as $$
declare
  cur post_status;
  n_total int; n_pending int; n_active int; n_published int; n_failed int;
  result post_status;
begin
  select status into cur from posts where id = p_post_id for update;
  if cur is null then return null; end if;
  if cur in ('draft', 'cancelled') then return cur; end if;

  select count(*),
         count(*) filter (where status = 'pending'),
         count(*) filter (where status in ('pending', 'uploading', 'processing')),
         count(*) filter (where status = 'published'),
         count(*) filter (where status = 'failed')
    into n_total, n_pending, n_active, n_published, n_failed
    from post_targets where post_id = p_post_id;

  if n_total = 0 then return cur; end if;

  if n_active > 0 then
    result := case when n_pending = n_total then 'scheduled' else 'publishing' end;
  elsif n_published = n_total then result := 'published';
  elsif n_failed = n_total then result := 'failed';
  elsif n_failed > 0 then result := 'partial';
  else result := 'needs_action';
  end if;

  update posts set status = result, updated_at = now() where id = p_post_id and status <> result;
  return result;
end $$;

revoke execute on function public.refresh_post_status(uuid) from public, anon;
grant execute on function public.refresh_post_status(uuid) to authenticated, service_role;
