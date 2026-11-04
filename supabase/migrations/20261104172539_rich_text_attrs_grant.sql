-- PROJ-39, Editor-Erweiterung: rich_attrs_ok läuft auch in den Prüfregeln der Tabellen, braucht also dieselben Rechte
-- wie die übrigen Prüffunktionen (20261031110516_invoice_settings.sql).
grant execute on function private.rich_attrs_ok(jsonb) to authenticated, service_role;
