-- Agendador do bot dentro do Supabase (substitui o GitHub Actions, que atrasava horas).
-- Antes de rodar: troque COLE_AQUI_O_CRON_SECRET pelo valor de CRON_SECRET da Vercel (nos dois lugares).
-- Horários em UTC: 12h–20h UTC = 9h–17h em Brasília.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- remove versões antigas, se existirem
select cron.unschedule(jobname) from cron.job where jobname in ('bot-disparo', 'bot-caixa');

-- disparo: a cada 10 minutos, dias úteis, 9h–17h de Brasília
select cron.schedule('bot-disparo', '*/10 12-20 * * 1-5', $$
  select net.http_get(
    url := 'https://bot-pesquisa-fgv.vercel.app/api/cron/disparo',
    headers := jsonb_build_object('Authorization', 'Bearer COLE_AQUI_O_CRON_SECRET'),
    timeout_milliseconds := 60000
  );
$$);

-- leitura das respostas de e-mail: a cada 10 minutos, todos os dias, 8h–20h de Brasília
select cron.schedule('bot-caixa', '5-55/10 11-23 * * *', $$
  select net.http_get(
    url := 'https://bot-pesquisa-fgv.vercel.app/api/cron/caixa',
    headers := jsonb_build_object('Authorization', 'Bearer COLE_AQUI_O_CRON_SECRET'),
    timeout_milliseconds := 60000
  );
$$);

-- para conferir depois: últimas execuções e respostas
-- select jobname, status, start_time from cron.job_run_details d join cron.job j using (jobid) order by start_time desc limit 10;
-- select status_code, created from net._http_response order by created desc limit 10;
