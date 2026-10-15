-- Estúdio — tarefas agendadas (aplicar no Supabase depois do deploy na Vercel).
-- Substitua <APP_URL> (ex.: https://estudio.vercel.app) e <CRON_SECRET> pelos valores reais,
-- de preferência no SQL Editor do Supabase (os segredos ficam no Vault, não no código).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<APP_URL>', 'app_url');
select vault.create_secret('<CRON_SECRET>', 'cron_secret');

create or replace function private.call_cron(path text) returns void
  language sql security definer set search_path = public as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || path,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
$$;
revoke execute on function private.call_cron(text) from public, anon, authenticated;

select cron.schedule('estudio-tick',    '* * * * *',  $$select private.call_cron('/api/cron/tick')$$);
select cron.schedule('estudio-metrics', '30 3 * * *', $$select private.call_cron('/api/cron/metrics')$$);
select cron.schedule('estudio-tokens',  '0 3 * * *',  $$select private.call_cron('/api/cron/tokens')$$);
