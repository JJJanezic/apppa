-- PROJ-7: Nachbesserungen aus den Integrationstests
-- * Suche mit mehreren Wörtern findet unabhängig von der Reihenfolge („rene dupre“ → „Dupré, René“):
--   jedes Wort des Suchbegriffs muss im Suchtext vorkommen
-- * Anonymisieren serverseitig aufrufbar (nur mit dem Secret Key; Tests, später PROJ-8)

create or replace function public.guest_list(
  p_tenant_id uuid,
  p_query text default '',
  p_country text default null,
  p_marketing text default null,
  p_sort text default 'name',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  last_name text,
  first_name text,
  company_name text,
  country text,
  anonymized_at timestamptz,
  stay_count integer,
  last_stay date,
  total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with needle as (
    select
      -- Wörter des Suchbegriffs; LIKE-Platzhalter wörtlich nehmen
      array_remove(string_to_array(
        replace(replace(replace(private.guest_norm(left(p_query, 200)), '\', '\\'), '%', '\%'), '_', '\_'),
        ' '
      ), '') as words,
      private.guest_phone_digits(left(p_query, 200)) as digits
  ),
  matches as (
    select g.*,
      -- Aufenthalte kommen mit den Buchungen (PROJ-8)
      0 as stay_count,
      null::date as last_stay
    from public.guests g, needle n
    where g.tenant_id = p_tenant_id
      and (
        cardinality(n.words) = 0
        or not exists (select 1 from unnest(n.words) w where g.search_text not like '%' || w || '%')
        or (length(n.digits) >= 3 and g.phone_key like '%' || n.digits || '%')
      )
      and (p_country is null or g.country = p_country)
      and (
        p_marketing is null
        or (p_marketing = 'none' and g.marketing_source is null and g.marketing_custom is null)
        or (p_marketing = 'custom' and g.marketing_custom is not null)
        or g.marketing_source = p_marketing
      )
  )
  select m.id, m.last_name, m.first_name, m.company_name, m.country, m.anonymized_at, m.stay_count, m.last_stay,
    count(*) over () as total
  from matches m
  order by
    case when p_sort = 'lastStay' then m.last_stay end desc nulls last,
    lower(m.last_name), lower(coalesce(m.first_name, '')), m.id
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

create function public.anonymize_guest(p_guest_id uuid)
returns void
language sql security invoker set search_path = ''
as $$ select private.anonymize_guest(p_guest_id); $$;

revoke execute on function public.anonymize_guest(uuid) from public, anon, authenticated;
grant execute on function public.anonymize_guest(uuid) to service_role;
