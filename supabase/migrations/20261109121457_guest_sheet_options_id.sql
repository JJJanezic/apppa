-- PROJ-26, Korrektur zu 20261109121212_guest_sheet_numbering_qa_fixes.sql: Das Änderungsprotokoll (private.audit_row)
-- braucht eine Spalte id je Zeile. guest_sheet_options bekommt sie; eindeutig bleibt je Kunde eine Zeile.
alter table public.guest_sheet_options drop constraint guest_sheet_options_pkey;
alter table public.guest_sheet_options add column id uuid not null default gen_random_uuid();
alter table public.guest_sheet_options add primary key (id);
alter table public.guest_sheet_options add constraint guest_sheet_options_tenant_key unique (tenant_id);
