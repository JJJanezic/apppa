-- PROJ-39, Zeilenhöhe (refine 2026-11-05): vierte optionale Einstellung lineHeight je ganzem Text, nur über den HTML-Code.
-- Faktor der Schriftgröße von 0,8 bis 3, höchstens zwei Nachkommastellen; fehlt sie, gilt der Zeilenabstand des Briefpapiers.
-- Nur die Prüfung ändert sich: keine neuen Spalten, keine Datenumstellung, vorhandene Zeilen (auch ausgestellte Rechnungen)
-- werden nicht neu geprüft. create or replace behält das Ausführungsrecht aus 20261104172539_rich_text_attrs_grant.sql.
-- Dieselbe Regel steht in src/lib/rich-text.ts (isRichDoc, isRichLineHeight).

create or replace function private.rich_attrs_ok(p_attrs jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_attrs) is distinct from 'object' then false
    when p_attrs = '{}'::jsonb then false
    when not private.rich_keys_ok(p_attrs, array['fontFamily', 'fontSize', 'textAlign', 'lineHeight']) then false
    when p_attrs ? 'fontFamily' and coalesce(p_attrs ->> 'fontFamily', '') not in
      ('arimo', 'tinos', 'carlito', 'source-sans', 'source-serif', 'open-sans') then false
    when p_attrs ? 'textAlign' and coalesce(p_attrs ->> 'textAlign', '') not in ('center', 'right', 'justify') then false
    -- 6 bis 24 pt in Schritten von 0,5 pt
    when p_attrs ? 'fontSize' and not (
      jsonb_typeof(p_attrs -> 'fontSize') = 'number'
      and (p_attrs ->> 'fontSize')::numeric between 6 and 24
      and (p_attrs ->> 'fontSize')::numeric * 2 % 1 = 0
    ) then false
    -- 0,8 bis 3 mit höchstens zwei Nachkommastellen
    when p_attrs ? 'lineHeight' and not (
      jsonb_typeof(p_attrs -> 'lineHeight') = 'number'
      and (p_attrs ->> 'lineHeight')::numeric between 0.8 and 3
      and (p_attrs ->> 'lineHeight')::numeric * 100 % 1 = 0
    ) then false
    else true
  end;
$$;
