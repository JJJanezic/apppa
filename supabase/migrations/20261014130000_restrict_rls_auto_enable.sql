-- PROJ-1: Advisor-Warnungen beheben.
-- public.rls_auto_enable() ist die Funktion des Supabase-Event-Triggers „ensure_rls“
-- (aktiviert RLS automatisch auf neuen Tabellen). Sie muss nicht über die API aufrufbar sein;
-- Event-Trigger prüfen das EXECUTE-Recht nicht und laufen unverändert weiter.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
