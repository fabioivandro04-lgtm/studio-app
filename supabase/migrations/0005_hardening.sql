-- Estúdio v1 — avisos do verificador de segurança do Supabase

-- is_owner() deixa de estar exposta na API (/rest/v1/rpc): passa para um esquema privado.
-- As políticas referem a função pelo OID, por isso continuam a funcionar.
create schema if not exists private;
alter function public.is_owner() set schema private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
revoke execute on function private.is_owner() from public, anon;
grant execute on function private.is_owner() to authenticated, service_role;

alter function public.post_targets_format_check() set search_path = public;
