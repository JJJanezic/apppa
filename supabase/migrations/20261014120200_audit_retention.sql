-- PROJ-1: Protokolleinträge nach 2 Jahren automatisch entfernen (täglich 03:15 UTC)

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'purge-audit-log',
  '15 3 * * *',
  $$delete from public.audit_log where created_at < now() - interval '2 years'$$
);
