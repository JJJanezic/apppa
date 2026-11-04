-- PROJ-39, Editor-Erweiterung: Schriftart, Schriftgröße und Ausrichtung je ganzem Text.
-- Optionale Angabe attrs am Dokument. Fehlt sie, gilt „Standard“ und linksbündig; alte Texte bleiben damit gültig.
-- Bausteine, feste Texte und Entwürfe prüfen alle über rich_doc_ok, darum genügt die Änderung hier. Vorhandene Zeilen
-- werden nicht neu geprüft und nicht verändert. Dieselbe Regel steht in src/lib/rich-text.ts (isRichDoc).

create function private.rich_attrs_ok(p_attrs jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_attrs) is distinct from 'object' then false
    when p_attrs = '{}'::jsonb then false
    when not private.rich_keys_ok(p_attrs, array['fontFamily', 'fontSize', 'textAlign']) then false
    when p_attrs ? 'fontFamily' and coalesce(p_attrs ->> 'fontFamily', '') not in
      ('arimo', 'tinos', 'carlito', 'source-sans', 'source-serif', 'open-sans') then false
    when p_attrs ? 'textAlign' and coalesce(p_attrs ->> 'textAlign', '') not in ('center', 'right', 'justify') then false
    when not (p_attrs ? 'fontSize') then true
    when jsonb_typeof(p_attrs -> 'fontSize') <> 'number' then false
    -- 6 bis 24 pt in Schritten von 0,5 pt
    else (p_attrs ->> 'fontSize')::numeric between 6 and 24 and (p_attrs ->> 'fontSize')::numeric * 2 % 1 = 0
  end;
$$;

create or replace function private.rich_doc_ok(p_doc jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select private.rich_keys_ok(p_doc, array['type', 'attrs', 'content'])
    and p_doc ->> 'type' = 'doc'
    and (not (p_doc ? 'attrs') or private.rich_attrs_ok(p_doc -> 'attrs'))
    and jsonb_typeof(p_doc -> 'content') = 'array'
    and not exists (
      select 1 from jsonb_array_elements(private.rich_array(p_doc -> 'content')) b
      where not (private.rich_paragraph_ok(b) or private.rich_list_ok(b))
    );
$$;

revoke execute on function private.rich_attrs_ok(jsonb) from public, anon;
