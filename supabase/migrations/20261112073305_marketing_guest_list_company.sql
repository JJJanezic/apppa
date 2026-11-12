-- PROJ-52 Korrektur: marketing_guest_list meldete 42702 („mehrdeutige Spalte“), weil der Firmenname der Verknüpfung
-- (PROJ-50) wie die alte Gastspalte company_name hieß. Firmenname intern als co_name, Ausgabe unverändert „company_name“.
-- Sonst unverändert gegenüber 20261112072927_marketing_segments_export.sql.

create or replace function public.marketing_guest_list(
  p_tenant_id uuid,
  p_filters jsonb default '{}'::jsonb,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  c_uuid constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_filters jsonb := case when jsonb_typeof(p_filters) = 'object' then p_filters else '{}'::jsonb end;
  v_today date := private.today_vienna();
  v_from date;
  v_to date;
  v_min integer;
  v_properties uuid[];
  v_apartments uuid[];
  v_sources text[] := private.jsonb_text_list(v_filters -> 'sources', '^[a-z_]{1,30}$');
  v_countries text[] := private.jsonb_text_list(v_filters -> 'countries', '^[A-Z]{2}$');
  v_languages text[] := private.jsonb_text_list(v_filters -> 'languages', '^[a-z]{2,3}$|^none$');
  v_reach text := coalesce(nullif(v_filters ->> 'reach', ''), 'any');
  v_place_filter boolean;
  v_stay_filter boolean;
  v_result jsonb;
begin
  if not private.has_role(p_tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = '42501';
  end if;
  if v_filters ->> 'from' ~ '^\d{4}-(0[1-9]|1[0-2])$' then
    v_from := (v_filters ->> 'from' || '-01')::date;
  end if;
  if v_filters ->> 'to' ~ '^\d{4}-(0[1-9]|1[0-2])$' then
    v_to := ((v_filters ->> 'to' || '-01')::date + interval '1 month' - interval '1 day')::date;
  end if;
  if v_filters ->> 'minStays' ~ '^\d{1,3}$' and (v_filters ->> 'minStays')::integer >= 1 then
    v_min := (v_filters ->> 'minStays')::integer;
  end if;
  v_properties := private.jsonb_text_list(v_filters -> 'properties', c_uuid)::uuid[];
  -- Gewählte Wohnungen und alle Wohnungen der gewählten Objekte
  select coalesce(array_agg(distinct a.id), '{}') into v_apartments
  from public.apartments a
  where a.tenant_id = p_tenant_id
    and (a.id = any (private.jsonb_text_list(v_filters -> 'apartments', c_uuid)::uuid[]) or a.property_id = any (v_properties));
  -- Wohnungsfilter gesetzt (auch wenn die gewählten Wohnungen nicht mehr existieren: dann keine Treffer)
  v_place_filter := cardinality(v_properties) > 0 or cardinality(private.jsonb_text_list(v_filters -> 'apartments', c_uuid)) > 0;
  v_stay_filter := v_from is not null or v_to is not null or v_place_filter or cardinality(v_sources) > 0;

  with stays as (
    -- Aufenthalt: Buchung, nicht storniert, Anreise bis heute
    select b.guest_id, b.arrival, b.departure, b.apartment_id, b.source
    from public.bookings b
    where b.tenant_id = p_tenant_id and b.kind = 'booking' and b.cancelled_at is null and b.arrival <= v_today and b.guest_id is not null
  ),
  stats as (
    select s.guest_id, count(*)::integer as stay_count, max(s.arrival) as last_stay from stays s group by s.guest_id
  ),
  consenting as (
    select
      g.*,
      (g.email is not null and g.email_source = 'direct') as has_email,
      (g.street is not null and (g.postal_code is not null or g.city is not null)) as has_post
    from public.guests g
    where g.tenant_id = p_tenant_id and g.marketing_consent_state = 'granted' and g.anonymized_at is null
  ),
  matches as (
    select c.*, coalesce(st.stay_count, 0) as stay_count, st.last_stay, co.name as co_name
    from consenting c
    left join stats st on st.guest_id = c.id
    left join public.companies co on co.id = c.company_id and co.tenant_id = c.tenant_id
    where (c.has_email or c.has_post)
      and (v_reach = 'any' or (v_reach = 'email' and c.has_email) or (v_reach = 'post' and c.has_post))
      and (v_min is null or coalesce(st.stay_count, 0) >= v_min)
      and (cardinality(v_countries) = 0 or c.address_country = any (v_countries))
      and (cardinality(v_languages) = 0 or c.language = any (v_languages) or ('none' = any (v_languages) and c.language is null))
      and (
        not v_stay_filter
        or exists (
          select 1 from stays s
          where s.guest_id = c.id
            and (v_from is null or s.departure > v_from)
            and (v_to is null or s.arrival <= v_to)
            and (not v_place_filter or s.apartment_id = any (v_apartments))
            and (cardinality(v_sources) = 0 or s.source = any (v_sources))
        )
      )
  ),
  page as (
    select m.*
    from matches m
    order by lower(m.last_name), lower(coalesce(m.first_name, '')), m.id
    limit case when p_limit is null then null else least(greatest(p_limit, 1), 1000) end
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from matches),
    'without_contact', (select count(*) from consenting c where not c.has_email and not c.has_post),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'last_name', p.last_name,
        'first_name', p.first_name,
        'title_prefix', p.title_prefix,
        'title_suffix', p.title_suffix,
        'gender', p.gender,
        'company_name', p.co_name,
        -- Plattform-Adressen und -Nummern nie herausgeben
        'email', case when p.email_source = 'direct' then p.email end,
        'phone', case when p.phone_source = 'direct' then p.phone end,
        'street', p.street,
        'postal_code', p.postal_code,
        'city', p.city,
        'address_country', p.address_country,
        'language', p.language,
        'stay_count', p.stay_count,
        'last_stay', p.last_stay,
        'consent_on', p.marketing_consent_on
      ) order by lower(p.last_name), lower(coalesce(p.first_name, '')), p.id)
      from page p
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
