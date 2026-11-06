-- Teil von /clean-dev: verwaiste Protokollzeilen (Kunde existiert nicht mehr) paketweise löschen. Nur in „apppa-dev“ ausführen:
--   npx supabase db query --linked --project-ref nizgfmvjplhegoosanmu -f scripts/clean-dev-audit.sql
-- So oft wiederholen, bis „deleted“ 0 ist; danach VACUUM (FULL, ANALYZE) als eigener Aufruf.
with doomed as (
  select a.ctid
  from public.audit_log a
  where a.tenant_id is not null and not exists (select 1 from public.tenants t where t.id = a.tenant_id)
  limit 25000
), gone as (
  delete from public.audit_log a using doomed d where a.ctid = d.ctid returning 1
)
select count(*) as deleted from gone;
