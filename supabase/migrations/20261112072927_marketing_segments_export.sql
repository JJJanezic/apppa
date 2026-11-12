-- PROJ-52 Marketing: Segmente und CSV-Export. Nur für Inhaber des Kunden.
-- - marketing_segments: benannte Filterkombinationen je Kunde (nur Filter, keine Gäste); Lesen und Schreiben direkt über
--   die Zugriffsregeln (nur Inhaber), Name je Kunde eindeutig.
-- - marketing_guest_list: bewerbbare Gäste (Einwilligung „Erteilt“, eigene E-Mail oder Anschrift) mit Filtern, für Liste
--   und Export; Plattform-E-Mail und -Telefon gibt die Abfrage nie heraus.
-- - log_marketing_export: Protokolleintrag je Export (Person, Zeitpunkt, Filter, Segment, Anzahl; keine Gastdaten).
-- Fehlercodes: 42501 nur Inhaber, 23505 Name doppelt, P0016 Kunde deaktiviert.

-- ---------------------------------------------------------------------------
-- Segmente
-- ---------------------------------------------------------------------------
create table public.marketing_segments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (name = btrim(name) and length(name) between 1 and 60),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object' and pg_column_size(filters) < 50000),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
comment on table public.marketing_segments is 'Marketing-Segmente je Kunde (PROJ-52): Name und gespeicherte Filter der Seite „Marketing“. Nur Inhaber.';

create unique index marketing_segments_name_key on public.marketing_segments (tenant_id, lower(name));
create index marketing_segments_created_by_idx on public.marketing_segments (created_by);

-- Deaktivierte Kunden: keine Änderungen (wie die übrigen Einstellungen)
create function private.guard_marketing_segment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.tenants t where t.id = coalesce(new.tenant_id, old.tenant_id) and t.status = 'deactivated') then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  if tg_op = 'UPDATE' and new.tenant_id is distinct from old.tenant_id then
    raise exception 'Kunde lässt sich nicht ändern.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger a_guard_marketing_segment before insert or update on public.marketing_segments
  for each row execute function private.guard_marketing_segment();

revoke all on public.marketing_segments from anon, authenticated;
grant select, insert, delete on public.marketing_segments to authenticated;
grant update (name, filters) on public.marketing_segments to authenticated;
alter table public.marketing_segments enable row level security;

create policy "Inhaber lesen Segmente" on public.marketing_segments for select to authenticated
  using (private.has_role(tenant_id, 'owner'));
create policy "Inhaber legen Segmente an" on public.marketing_segments for insert to authenticated
  with check (private.has_role(tenant_id, 'owner'));
create policy "Inhaber ändern Segmente" on public.marketing_segments for update to authenticated
  using (private.has_role(tenant_id, 'owner'))
  with check (private.has_role(tenant_id, 'owner'));
create policy "Inhaber löschen Segmente" on public.marketing_segments for delete to authenticated
  using (private.has_role(tenant_id, 'owner'));

select private.enable_tenant_table('public.marketing_segments');

-- ---------------------------------------------------------------------------
-- Bewerbbare Gäste (Liste und Export)
-- p_filters: {from 'JJJJ-MM', to 'JJJJ-MM', minStays, properties[], apartments[], sources[], countries[], languages[]
--   ('none' = ohne Sprache), reach 'any'|'email'|'post'}; Unbekanntes wird übergangen. p_limit null = alle (Export).
-- Ergebnis: {total, without_contact, rows[]}. Läuft mit den Rechten der Person (Zugriffsregeln), prüft zusätzlich die
-- Inhaber-Rolle.
-- ---------------------------------------------------------------------------
create function private.jsonb_text_list(p_value jsonb, p_pattern text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct x), '{}')
  from jsonb_array_elements_text(case when jsonb_typeof(p_value) = 'array' then p_value else '[]'::jsonb end) as x
  where x ~ p_pattern;
$$;

create function public.marketing_guest_list(
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
    select c.*, coalesce(st.stay_count, 0) as stay_count, st.last_stay, co.name as company_name
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
        'company_name', p.company_name,
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

-- ---------------------------------------------------------------------------
-- Protokolleintrag je Export (nur Inhaber); keine Gastdaten
-- ---------------------------------------------------------------------------
create function private.log_marketing_export(p_tenant_id uuid, p_filters jsonb, p_segment_id uuid, p_count integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = '42501';
  end if;
  insert into public.audit_log (tenant_id, table_name, record_id, action, old_data, new_data, actor_id, actor_label)
  values (
    p_tenant_id,
    'marketing_exports',
    gen_random_uuid(),
    'insert',
    null,
    jsonb_build_object(
      'filters', case when jsonb_typeof(p_filters) = 'object' and pg_column_size(p_filters) < 50000 then p_filters else '{}'::jsonb end,
      'segment_id', (select s.id from public.marketing_segments s where s.id = p_segment_id and s.tenant_id = p_tenant_id),
      'segment_name', (select s.name from public.marketing_segments s where s.id = p_segment_id and s.tenant_id = p_tenant_id),
      'count', greatest(coalesce(p_count, 0), 0)
    ),
    auth.uid(),
    'user'
  );
end;
$$;

create function public.log_marketing_export(p_tenant_id uuid, p_filters jsonb, p_segment_id uuid, p_count integer)
returns void language sql security invoker set search_path = ''
as $$ select private.log_marketing_export(p_tenant_id, p_filters, p_segment_id, p_count); $$;

-- ---------------------------------------------------------------------------
-- Rechte der Funktionen
-- ---------------------------------------------------------------------------
revoke execute on function private.guard_marketing_segment() from public, anon, authenticated;
revoke execute on function private.jsonb_text_list(jsonb, text) from public, anon;
revoke execute on function public.marketing_guest_list(uuid, jsonb, integer, integer) from public, anon;
revoke execute on function private.log_marketing_export(uuid, jsonb, uuid, integer) from public, anon;
revoke execute on function public.log_marketing_export(uuid, jsonb, uuid, integer) from public, anon;

grant execute on function private.jsonb_text_list(jsonb, text) to authenticated;
grant execute on function public.marketing_guest_list(uuid, jsonb, integer, integer) to authenticated;
grant execute on function private.log_marketing_export(uuid, jsonb, uuid, integer) to authenticated;
grant execute on function public.log_marketing_export(uuid, jsonb, uuid, integer) to authenticated;
