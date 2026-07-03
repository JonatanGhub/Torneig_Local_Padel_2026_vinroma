-- Taula d'idempotència pels crons diaris/setmanals de WhatsApp. El pla Hobby
-- de Vercel no garanteix que un cron es dispari exactament a l'hora (o que es
-- dispari cada dia): ja hem tingut misses del "Avui es juga" per col·lisió amb
-- un deploy i, altres cops, sense cap causa aparent. Com a xarxa de seguretat,
-- el trànsit normal del lloc (app/[locale]/layout.tsx) dispara els mateixos
-- jobs via `after()` si detecta que encara no s'han executat avui. Aquesta
-- taula és el "pany" que evita que el cron real i el self-heal enviïn el
-- missatge dues vegades: qui aconsegueix inserir primer és qui l'envia.
create table if not exists public.cron_daily_runs (
  job_name text not null,
  run_date date not null,
  ran_at timestamptz not null default now(),
  primary key (job_name, run_date)
);

alter table public.cron_daily_runs enable row level security;
-- Sense policies: només s'hi accedeix amb el service role (cron i self-heal
-- corren en codi de servidor), que salta la RLS.
