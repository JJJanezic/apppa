-- PROJ-50: Aufrufrechte der geschützten Firmen-Funktionen für angemeldete Personen (Schema „private“ vergibt keine
-- Ausführungsrechte von selbst; die Funktionen prüfen Kunde und Rolle selbst)
grant execute on function private.save_guest(jsonb) to authenticated;
grant execute on function private.company_duplicate_pairs(uuid) to authenticated;
grant execute on function private.delete_company(uuid) to authenticated;
grant execute on function private.merge_companies(uuid, uuid, jsonb) to authenticated;
