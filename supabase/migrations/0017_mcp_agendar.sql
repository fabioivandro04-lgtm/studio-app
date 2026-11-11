-- MCP: o agente (Claude) pode agendar um rascunho e voltar a pôr em rascunho um post agendado.
-- Só muda estado e hora; o conteúdo continua a mudar apenas em rascunho (regras de 0014). Apagar continua proibido.
-- security definer porque as políticas restritivas de 0014 bloqueiam o agente; as verificações estão aqui.

create or replace function public.agent_schedule_post(p_id uuid, p_at timestamptz) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_owner() then raise exception 'not_owner'; end if;
  if p_at is null or p_at < now() then raise exception 'past_time'; end if;
  perform 1 from public.posts where id = p_id and status = 'draft' for update;
  if not found then raise exception 'not_draft'; end if;
  if not exists (select 1 from public.post_targets where post_id = p_id) then raise exception 'no_targets'; end if;
  if exists (select 1 from public.post_targets where post_id = p_id and status <> 'pending') then raise exception 'post_locked'; end if;
  update public.posts set status = 'scheduled', scheduled_at = p_at, updated_at = now() where id = p_id;
end $$;

create or replace function public.agent_unschedule_post(p_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_owner() then raise exception 'not_owner'; end if;
  perform 1 from public.posts where id = p_id and status = 'scheduled' for update;
  if not found then raise exception 'not_scheduled'; end if;
  -- Se alguma rede já começou a publicar, já não se pode voltar atrás.
  if exists (select 1 from public.post_targets where post_id = p_id and status <> 'pending') then raise exception 'post_locked'; end if;
  update public.posts set status = 'draft', updated_at = now() where id = p_id;
end $$;

revoke execute on function public.agent_schedule_post(uuid, timestamptz) from public, anon;
grant execute on function public.agent_schedule_post(uuid, timestamptz) to authenticated;
revoke execute on function public.agent_unschedule_post(uuid) from public, anon;
grant execute on function public.agent_unschedule_post(uuid) to authenticated;
