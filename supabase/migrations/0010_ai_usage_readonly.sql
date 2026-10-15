-- O registo de gastos da IA só se lê e acrescenta: ninguém o altera nem apaga a partir da app.
-- Políticas restritivas somam-se à owner_all (não é preciso apagá-la). Idempotente.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_usage' and policyname = 'ai_usage_no_update') then
    create policy ai_usage_no_update on public.ai_usage as restrictive for update to authenticated using (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_usage' and policyname = 'ai_usage_no_delete') then
    create policy ai_usage_no_delete on public.ai_usage as restrictive for delete to authenticated using (false);
  end if;
end $$;
