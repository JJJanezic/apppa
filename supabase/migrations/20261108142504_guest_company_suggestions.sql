-- PROJ-49: Firmenvorschläge im Gastformular
--
-- Liefert Fassungen der Firmen anderer Gäste eines Kunden, deren Firmenname den Suchtext enthält (Kleinbuchstaben,
-- ohne Akzente, wie die Gästesuche). Gäste mit gleicher Fassung (alle sieben Firmenfelder gleich, ohne Rücksicht auf
-- Groß-/Kleinschreibung und Leerzeichen am Rand) ergeben einen Vorschlag mit den Werten des zuletzt geänderten Gastes.
-- Reihenfolge: zuletzt geändert zuerst, höchstens 8. Nur Firmenfelder, keine Personendaten.
-- Läuft mit den Rechten der angemeldeten Person: Die Leseregel der Gäste begrenzt auf die eigenen Kunden.

create function public.guest_company_suggestions(
  p_tenant_id uuid,
  p_query text,
  p_exclude_id uuid default null
)
returns table (
  company_name text,
  company_vat_id text,
  company_address_line1 text,
  company_address_line2 text,
  company_postal_code text,
  company_city text,
  company_country text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with needle as (
    -- LIKE-Platzhalter im Suchbegriff wörtlich nehmen
    select replace(replace(replace(private.guest_norm(left(p_query, 200)), '\', '\\'), '%', '\%'), '_', '\_') as text
  ),
  matches as (
    select g.id, g.updated_at, g.company_name, g.company_vat_id, g.company_address_line1, g.company_address_line2,
      g.company_postal_code, g.company_city, g.company_country
    from public.guests g, needle n
    where char_length(private.guest_norm(left(p_query, 200))) >= 2
      and g.tenant_id = p_tenant_id
      and g.anonymized_at is null
      and g.id is distinct from p_exclude_id
      and nullif(btrim(g.company_name), '') is not null
      -- Vorfilter über den Suchindex (der Suchtext enthält den Firmennamen), dann genau im Firmennamen
      and g.search_text like '%' || n.text || '%'
      and private.guest_norm(g.company_name) like '%' || n.text || '%'
  ),
  versions as (
    -- je Fassung der zuletzt geänderte Gast
    select distinct on (
      lower(btrim(m.company_name)),
      lower(btrim(coalesce(m.company_vat_id, ''))),
      lower(btrim(coalesce(m.company_address_line1, ''))),
      lower(btrim(coalesce(m.company_address_line2, ''))),
      lower(btrim(coalesce(m.company_postal_code, ''))),
      lower(btrim(coalesce(m.company_city, ''))),
      lower(btrim(coalesce(m.company_country, '')))
    ) m.*
    from matches m
    order by
      lower(btrim(m.company_name)),
      lower(btrim(coalesce(m.company_vat_id, ''))),
      lower(btrim(coalesce(m.company_address_line1, ''))),
      lower(btrim(coalesce(m.company_address_line2, ''))),
      lower(btrim(coalesce(m.company_postal_code, ''))),
      lower(btrim(coalesce(m.company_city, ''))),
      lower(btrim(coalesce(m.company_country, ''))),
      m.updated_at desc, m.id
  )
  select v.company_name, v.company_vat_id, v.company_address_line1, v.company_address_line2, v.company_postal_code,
    v.company_city, v.company_country
  from versions v
  order by v.updated_at desc, v.id
  limit 8;
$$;

revoke execute on function public.guest_company_suggestions(uuid, text, uuid) from public, anon;
grant execute on function public.guest_company_suggestions(uuid, text, uuid) to authenticated;
