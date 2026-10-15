-- Estúdio v1 — contagem atómica de uso das APIs (quotas)

create function public.record_api_usage(p_account uuid, p_kind text, p_units bigint)
  returns bigint
  language sql security invoker set search_path = public as $$
  insert into api_usage (social_account_id, day, kind, count)
  values (p_account, (now() at time zone 'utc')::date, p_kind, p_units)
  on conflict (social_account_id, day, kind) do update set count = api_usage.count + excluded.count
  returning count
$$;

revoke execute on function public.record_api_usage(uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.record_api_usage(uuid, text, bigint) to service_role;
