-- PROJ-3: Die Sperre für App-Rollen ausdrücklich machen (Advisor 0008 „RLS enabled, no policy“).
-- Wirkung unverändert: anon/authenticated haben ohnehin keine Tabellenrechte; nur service_role (umgeht RLS).
create policy "Kein Zugriff für App-Rollen" on public.login_failures
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);
