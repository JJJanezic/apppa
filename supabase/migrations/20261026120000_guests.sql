-- PROJ-7: Gäste-Datenbank
--
-- * Gäste (Hauptgäste) je Kunde, Muster aus PROJ-1: Lesen für Mitglieder (und den Admin), direktes Anlegen
--   und Ändern nur für Inhaber; Mitarbeiter legen Gäste nur zusammen mit einer Buchung an (PROJ-8).
--   Standardfelder + Änderungsprotokoll.
-- * Suche und Dublettenvergleich über Schlüssel, die die Datenbank selbst pflegt (Kleinbuchstaben, ohne
--   Akzente; Telefon nur Ziffern; Relay-Adressen von booking.com/Airbnb zählen nicht als gleiche E-Mail).
-- * Zusammenführen sowie Löschen/Anonymisieren als geschützte Funktionen (alles oder nichts, Rolle wird in der
--   Datenbank geprüft). Beim Löschen/Anonymisieren werden die Altwerte im Änderungsprotokoll entfernt.
-- * Abgelehnte Dubletten-Vorschläge („Kein Doppeleintrag“) je Kunde, nur für Inhaber.
--
-- Fehlercodes für die App (src/app/(app)/gaeste/actions.ts):
--   P0701 nur Inhaber · P0702 Gast nicht gefunden · P0703 Gast anonymisiert · P0704 Zusammenführen ungültig

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Vereinheitlichung (gleiche Regeln wie searchKey/phoneDigits in src/lib/guests.ts)
-- ---------------------------------------------------------------------------
create function private.guest_norm(p_value text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  -- zweistellige Form von unaccent: findet das Wörterbuch auch bei leerem search_path
  select btrim(regexp_replace(
    extensions.unaccent('extensions.unaccent'::regdictionary, lower(coalesce(p_value, ''))),
    '\s+', ' ', 'g'
  ));
$$;

create function private.guest_phone_digits(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$ select regexp_replace(coalesce(p_value, ''), '\D', '', 'g'); $$;

-- Relay-Adressen der Plattformen wechseln je Buchung (Liste wie isPlatformRelayEmail in src/lib/guests.ts)
create function private.guest_email_key(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_email is null or btrim(p_email) = '' then null
    when lower(split_part(btrim(p_email), '@', 2)) ~ '(^|\.)guest\.(booking|airbnb)\.com$' then null
    else lower(btrim(p_email))
  end;
$$;

-- ---------------------------------------------------------------------------
-- Gäste
-- ---------------------------------------------------------------------------
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  last_name text not null check (last_name = btrim(last_name) and length(last_name) between 1 and 100),
  first_name text check (first_name is null or (first_name = btrim(first_name) and length(first_name) between 1 and 100)),
  -- Herkunftsland (Wohnsitzland), ISO 3166-1 alpha-2
  country text not null check (country ~ '^[A-Z]{2}$'),
  email text check (email is null or (email = lower(btrim(email)) and length(email) between 3 and 254 and email like '%_@_%')),
  email_source text not null default 'direct' check (email_source in ('direct', 'platform')),
  phone text check (phone is null or length(btrim(phone)) between 4 and 40),
  phone_source text not null default 'direct' check (phone_source in ('direct', 'platform')),
  language text check (language is null or language ~ '^[a-z]{2}$'),
  -- „nicht in der Zukunft“ prüft der Trigger (CHECK darf sich nicht auf das heutige Datum stützen)
  birth_date date check (birth_date is null or birth_date >= date '1900-01-01'),
  street text check (street is null or length(btrim(street)) between 1 and 200),
  postal_code text check (postal_code is null or length(btrim(postal_code)) between 1 and 20),
  city text check (city is null or length(btrim(city)) between 1 and 100),
  address_country text check (address_country is null or address_country ~ '^[A-Z]{2}$'),
  marketing_source text check (marketing_source is null or marketing_source in (
    'website', 'instagram', 'google_ads', 'newsletter', 'referral', 'platform_search'
  )),
  marketing_custom text check (marketing_custom is null or length(btrim(marketing_custom)) between 1 and 100),
  company_name text check (company_name is null or length(btrim(company_name)) between 1 and 200),
  company_vat_id text check (company_vat_id is null or length(btrim(company_vat_id)) between 1 and 30),
  company_billing_address text check (company_billing_address is null or length(company_billing_address) <= 500),
  note text check (note is null or length(note) <= 2000),
  anonymized_at timestamptz,
  -- von der Datenbank gepflegt (Trigger), nicht beschreibbar
  search_text text not null default '',
  email_key text,
  phone_key text,
  name_key text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  -- Standardwert oder eigene Angabe, nicht beides
  constraint guests_marketing_check check (marketing_source is null or marketing_custom is null),
  -- Ziel künftiger zusammengesetzter Fremdschlüssel (Buchungen desselben Kunden, PROJ-8)
  constraint guests_id_tenant_key unique (id, tenant_id)
);
comment on table public.guests is 'Hauptgäste je Kunde (PROJ-7). Löschen/Anonymisieren und Zusammenführen nur über Funktionen.';

create index guests_tenant_name_idx on public.guests (tenant_id, last_name, first_name);
create index guests_tenant_country_idx on public.guests (tenant_id, country);
create index guests_search_trgm_idx on public.guests using gin (search_text extensions.gin_trgm_ops);
create index guests_email_key_idx on public.guests (tenant_id, email_key) where email_key is not null;
create index guests_phone_key_idx on public.guests (tenant_id, phone_key) where phone_key is not null;
create index guests_name_key_idx on public.guests (tenant_id, name_key) where name_key is not null;

-- Schlüssel pflegen, Geburtsdatum prüfen
create function private.guests_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.birth_date is not null and new.birth_date > (now() at time zone 'Europe/Vienna')::date then
    raise exception 'Das Geburtsdatum darf nicht in der Zukunft liegen.' using errcode = '23514';
  end if;
  new.search_text := private.guest_norm(concat_ws(' ', new.last_name, new.first_name, new.company_name, new.email))
    || ' ' || private.guest_phone_digits(new.phone);
  new.email_key := private.guest_email_key(new.email);
  new.phone_key := nullif(private.guest_phone_digits(new.phone), '');
  if new.phone_key is not null and length(new.phone_key) < 6 then
    new.phone_key := null;
  end if;
  new.name_key := case
    when new.first_name is null or new.anonymized_at is not null then null
    else private.guest_norm(new.first_name || ' ' || new.last_name)
  end;
  return new;
end;
$$;

create trigger guests_before_write before insert or update on public.guests
  for each row execute function private.guests_before_write();

-- ---------------------------------------------------------------------------
-- Abgelehnte Dubletten-Vorschläge
-- ---------------------------------------------------------------------------
create table public.guest_duplicate_dismissals (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Paar in fester Reihenfolge (kleinere ID zuerst), damit es nur einmal vorkommt
  guest_a uuid not null,
  guest_b uuid not null,
  dismissed_by uuid default auth.uid(),
  dismissed_at timestamptz not null default now(),
  primary key (guest_a, guest_b),
  constraint guest_duplicate_dismissals_order check (guest_a < guest_b),
  constraint guest_duplicate_dismissals_a_fkey foreign key (guest_a, tenant_id)
    references public.guests (id, tenant_id) on delete cascade,
  constraint guest_duplicate_dismissals_b_fkey foreign key (guest_b, tenant_id)
    references public.guests (id, tenant_id) on delete cascade
);
comment on table public.guest_duplicate_dismissals is '„Kein Doppeleintrag“: abgelehnte Dubletten-Vorschläge je Kunde (PROJ-7).';
create index guest_duplicate_dismissals_tenant_idx on public.guest_duplicate_dismissals (tenant_id);
create index guest_duplicate_dismissals_b_idx on public.guest_duplicate_dismissals (guest_b, tenant_id);
create index guest_duplicate_dismissals_a_idx on public.guest_duplicate_dismissals (guest_a, tenant_id);

-- ---------------------------------------------------------------------------
-- Rechte und Abschottung (Muster PROJ-1)
-- ---------------------------------------------------------------------------
revoke all on public.guests, public.guest_duplicate_dismissals from anon, authenticated;

grant select on public.guests to authenticated;
grant insert (
  tenant_id, last_name, first_name, country, email, phone, language, birth_date, street, postal_code, city,
  address_country, marketing_source, marketing_custom, company_name, company_vat_id, company_billing_address, note
) on public.guests to authenticated;
grant update (
  last_name, first_name, country, email, email_source, phone, phone_source, language, birth_date, street,
  postal_code, city, address_country, marketing_source, marketing_custom, company_name, company_vat_id,
  company_billing_address, note
) on public.guests to authenticated;
-- DELETE: keine Rechte → nur über private.delete_guest bzw. das Löschen des ganzen Kunden

grant select, insert (tenant_id, guest_a, guest_b) on public.guest_duplicate_dismissals to authenticated;

alter table public.guests enable row level security;
alter table public.guest_duplicate_dismissals enable row level security;

create policy "Mitglieder und Admin lesen Gäste"
  on public.guests for select to authenticated
  using (private.is_member(tenant_id) or (select private.is_admin()));
create policy "Inhaber legen Gäste an"
  on public.guests for insert to authenticated
  with check (private.has_role(tenant_id, 'owner'));
create policy "Inhaber ändern nicht anonymisierte Gäste"
  on public.guests for update to authenticated
  using (private.has_role(tenant_id, 'owner') and anonymized_at is null)
  with check (private.has_role(tenant_id, 'owner') and anonymized_at is null);

create policy "Inhaber lesen abgelehnte Vorschläge"
  on public.guest_duplicate_dismissals for select to authenticated
  using (private.has_role(tenant_id, 'owner'));
create policy "Inhaber lehnen Vorschläge ab"
  on public.guest_duplicate_dismissals for insert to authenticated
  with check (private.has_role(tenant_id, 'owner'));

select private.enable_tenant_table('public.guests');

-- ---------------------------------------------------------------------------
-- Gästeliste: Suche, Filter, Sortierung, Blättern (Zugriffsregeln gelten wie bei direkten Abfragen)
-- ---------------------------------------------------------------------------
create function public.guest_list(
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
      -- LIKE-Platzhalter im Suchbegriff wörtlich nehmen
      replace(replace(replace(private.guest_norm(left(p_query, 200)), '\', '\\'), '%', '\%'), '_', '\_') as text,
      private.guest_phone_digits(left(p_query, 200)) as digits
  ),
  matches as (
    select g.*,
      -- Aufenthalte kommen mit den Buchungen (PROJ-8)
      0 as stay_count,
      null::date as last_stay
    from public.guests g, needle n
    where g.tenant_id = p_tenant_id
      and (n.text = '' or g.search_text like '%' || n.text || '%'
        or (length(n.digits) >= 3 and g.phone_key like '%' || n.digits || '%'))
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

-- ---------------------------------------------------------------------------
-- Dubletten
-- ---------------------------------------------------------------------------
-- Mögliche Doppeleinträge für einen neuen Gast (Warnung beim Anlegen)
create function public.guest_duplicate_candidates(
  p_tenant_id uuid,
  p_last_name text,
  p_first_name text,
  p_email text,
  p_phone text
)
returns table (id uuid, reasons text[])
language sql
stable
security invoker
set search_path = ''
as $$
  with k as (
    select
      private.guest_email_key(p_email) as email_key,
      nullif(private.guest_phone_digits(p_phone), '') as phone_key,
      case when nullif(btrim(p_first_name), '') is null then null
        else private.guest_norm(btrim(p_first_name) || ' ' || btrim(p_last_name)) end as name_key
  )
  select g.id,
    array_remove(array[
      case when g.email_key = k.email_key then 'email' end,
      case when length(k.phone_key) >= 6 and g.phone_key = k.phone_key then 'phone' end,
      case when g.name_key = k.name_key then 'name' end
    ], null) as reasons
  from public.guests g, k
  where g.tenant_id = p_tenant_id
    and g.anonymized_at is null
    and (g.email_key = k.email_key
      or (length(k.phone_key) >= 6 and g.phone_key = k.phone_key)
      or g.name_key = k.name_key)
  order by lower(g.last_name), lower(coalesce(g.first_name, ''))
  limit 5;
$$;

-- Vorschlagsliste: Paare desselben Kunden (ohne anonymisierte und abgelehnte), nur für Inhaber
create function private.guest_duplicate_pairs(p_tenant_id uuid)
returns table (guest_a uuid, guest_b uuid, reasons text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0701';
  end if;
  return query
    with pairs as (
      select a.id as a_id, b.id as b_id, 'email' as reason
        from public.guests a join public.guests b on b.tenant_id = a.tenant_id and b.email_key = a.email_key and a.id < b.id
        where a.tenant_id = p_tenant_id and a.anonymized_at is null and b.anonymized_at is null
      union all
      select a.id, b.id, 'phone'
        from public.guests a join public.guests b on b.tenant_id = a.tenant_id and b.phone_key = a.phone_key and a.id < b.id
        where a.tenant_id = p_tenant_id and a.anonymized_at is null and b.anonymized_at is null
      union all
      select a.id, b.id, 'name'
        from public.guests a join public.guests b on b.tenant_id = a.tenant_id and b.name_key = a.name_key and a.id < b.id
        where a.tenant_id = p_tenant_id and a.anonymized_at is null and b.anonymized_at is null
    )
    select p.a_id, p.b_id, array_agg(distinct p.reason order by p.reason)
    from pairs p
    where not exists (
      select 1 from public.guest_duplicate_dismissals d where d.guest_a = p.a_id and d.guest_b = p.b_id
    )
    group by p.a_id, p.b_id
    order by p.a_id, p.b_id
    limit 200;
end;
$$;

-- ---------------------------------------------------------------------------
-- Zusammenführen: p_keep bleibt mit den je Angabe gewählten Werten ('a' = p_keep, 'b' = p_remove), p_remove
-- wird entfernt. Ab PROJ-8 gehen hier auch die Buchungen von p_remove auf p_keep über.
-- ---------------------------------------------------------------------------
create function private.merge_guests(p_keep uuid, p_remove uuid, p_choice jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keep public.guests;
  v_remove public.guests;
  -- true = Wert des zweiten Gastes übernehmen
  b_name boolean := p_choice ->> 'name' = 'b';
  b_country boolean := p_choice ->> 'country' = 'b';
  b_email boolean := p_choice ->> 'email' = 'b';
  b_phone boolean := p_choice ->> 'phone' = 'b';
  b_language boolean := p_choice ->> 'language' = 'b';
  b_birth boolean := p_choice ->> 'birthDate' = 'b';
  b_address boolean := p_choice ->> 'address' = 'b';
  b_marketing boolean := p_choice ->> 'marketing' = 'b';
  b_company boolean := p_choice ->> 'company' = 'b';
  b_note boolean := p_choice ->> 'note' = 'b';
begin
  if p_keep is null or p_remove is null or p_keep = p_remove then
    raise exception 'Ein Gast lässt sich nicht mit sich selbst zusammenführen.' using errcode = 'P0704';
  end if;
  -- feste Sperr-Reihenfolge gegen Verklemmungen bei gleichzeitigen Aufrufen
  perform 1 from public.guests where id in (p_keep, p_remove) order by id for update;
  select * into v_keep from public.guests where id = p_keep;
  select * into v_remove from public.guests where id = p_remove;
  if v_keep.id is null or v_remove.id is null then
    raise exception 'Gast nicht gefunden.' using errcode = 'P0702';
  end if;
  if v_keep.tenant_id <> v_remove.tenant_id then
    raise exception 'Gäste verschiedener Kunden lassen sich nicht zusammenführen.' using errcode = 'P0704';
  end if;
  if not private.has_role(v_keep.tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0701';
  end if;
  if v_keep.anonymized_at is not null or v_remove.anonymized_at is not null then
    raise exception 'Anonymisierte Gäste lassen sich nicht zusammenführen.' using errcode = 'P0703';
  end if;

  update public.guests set
    last_name = case when b_name then v_remove.last_name else v_keep.last_name end,
    first_name = case when b_name then v_remove.first_name else v_keep.first_name end,
    country = case when b_country then v_remove.country else v_keep.country end,
    email = case when b_email then v_remove.email else v_keep.email end,
    email_source = case when b_email then v_remove.email_source else v_keep.email_source end,
    phone = case when b_phone then v_remove.phone else v_keep.phone end,
    phone_source = case when b_phone then v_remove.phone_source else v_keep.phone_source end,
    language = case when b_language then v_remove.language else v_keep.language end,
    birth_date = case when b_birth then v_remove.birth_date else v_keep.birth_date end,
    street = case when b_address then v_remove.street else v_keep.street end,
    postal_code = case when b_address then v_remove.postal_code else v_keep.postal_code end,
    city = case when b_address then v_remove.city else v_keep.city end,
    address_country = case when b_address then v_remove.address_country else v_keep.address_country end,
    marketing_source = case when b_marketing then v_remove.marketing_source else v_keep.marketing_source end,
    marketing_custom = case when b_marketing then v_remove.marketing_custom else v_keep.marketing_custom end,
    company_name = case when b_company then v_remove.company_name else v_keep.company_name end,
    company_vat_id = case when b_company then v_remove.company_vat_id else v_keep.company_vat_id end,
    company_billing_address = case when b_company then v_remove.company_billing_address else v_keep.company_billing_address end,
    note = case when b_note then v_remove.note else v_keep.note end
  where id = p_keep;

  -- PROJ-8: update public.bookings set guest_id = p_keep where guest_id = p_remove;

  delete from public.guests where id = p_remove;

  -- Verknüpfung im Protokoll: „zusammengeführt mit …“ beim verbleibenden Gast
  insert into public.audit_log (tenant_id, table_name, record_id, action, old_data, new_data, actor_id, actor_label)
  values (
    v_keep.tenant_id, 'guests', p_keep, 'update', null,
    jsonb_build_object('merged_from', p_remove),
    auth.uid(), 'user'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Anonymisieren: personenbezogene Angaben entfernen, Herkunftsland (und Buchungen) behalten,
-- Altwerte im Protokoll entfernen
-- ---------------------------------------------------------------------------
create function private.anonymize_guest(p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.guests set
    last_name = 'Gelöschter Gast',
    first_name = null,
    email = null,
    email_source = 'direct',
    phone = null,
    phone_source = 'direct',
    language = null,
    birth_date = null,
    street = null,
    postal_code = null,
    city = null,
    address_country = null,
    marketing_source = null,
    marketing_custom = null,
    company_name = null,
    company_vat_id = null,
    company_billing_address = null,
    note = null,
    anonymized_at = now()
  where id = p_guest_id;
  delete from public.guest_duplicate_dismissals where guest_a = p_guest_id or guest_b = p_guest_id;
  perform private.purge_audit_personal_data('guests', p_guest_id);
end;
$$;

-- Löschen auf Wunsch des Inhabers: ohne Buchungen endgültig, mit Buchungen anonymisieren
create function private.delete_guest(p_guest_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest public.guests;
  -- Buchungen kommen mit PROJ-8; bis dahin hat kein Gast Aufenthalte
  v_has_stays boolean := false;
begin
  select * into v_guest from public.guests where id = p_guest_id for update;
  if v_guest.id is null then
    raise exception 'Gast nicht gefunden.' using errcode = 'P0702';
  end if;
  if not private.has_role(v_guest.tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0701';
  end if;
  if v_guest.anonymized_at is not null then
    raise exception 'Der Gast ist bereits anonymisiert.' using errcode = 'P0703';
  end if;

  if v_has_stays then
    perform private.anonymize_guest(p_guest_id);
    return 'anonymized';
  end if;

  delete from public.guests where id = p_guest_id;
  -- Es bleibt nur der Vermerk „gelöscht“ mit Person und Zeitpunkt
  perform private.purge_audit_personal_data('guests', p_guest_id);
  return 'deleted';
end;
$$;

-- ---------------------------------------------------------------------------
-- Aufrufbar über die API (security invoker; die privaten Funktionen prüfen die Rolle selbst)
-- ---------------------------------------------------------------------------
create function public.guest_duplicate_pairs(p_tenant_id uuid)
returns table (guest_a uuid, guest_b uuid, reasons text[])
language sql stable security invoker set search_path = ''
as $$ select * from private.guest_duplicate_pairs(p_tenant_id); $$;

create function public.merge_guests(p_keep uuid, p_remove uuid, p_choice jsonb)
returns void
language sql security invoker set search_path = ''
as $$ select private.merge_guests(p_keep, p_remove, p_choice); $$;

create function public.delete_guest(p_guest_id uuid)
returns text
language sql security invoker set search_path = ''
as $$ select private.delete_guest(p_guest_id); $$;

revoke execute on function private.guest_norm(text) from public, anon;
revoke execute on function private.guest_phone_digits(text) from public, anon;
revoke execute on function private.guest_email_key(text) from public, anon;
revoke execute on function private.guests_before_write() from public, anon, authenticated;
revoke execute on function private.guest_duplicate_pairs(uuid) from public, anon;
revoke execute on function private.merge_guests(uuid, uuid, jsonb) from public, anon;
revoke execute on function private.anonymize_guest(uuid) from public, anon, authenticated;
revoke execute on function private.delete_guest(uuid) from public, anon;
revoke execute on function public.guest_list(uuid, text, text, text, text, integer, integer) from public, anon;
revoke execute on function public.guest_duplicate_candidates(uuid, text, text, text, text) from public, anon;
revoke execute on function public.guest_duplicate_pairs(uuid) from public, anon;
revoke execute on function public.merge_guests(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.delete_guest(uuid) from public, anon;

grant execute on function private.guest_norm(text) to authenticated;
grant execute on function private.guest_phone_digits(text) to authenticated;
grant execute on function private.guest_email_key(text) to authenticated;
grant execute on function private.guest_duplicate_pairs(uuid) to authenticated;
grant execute on function private.merge_guests(uuid, uuid, jsonb) to authenticated;
grant execute on function private.delete_guest(uuid) to authenticated;
-- Anonymisieren direkt nur serverseitig (Tests; ab PROJ-8 ruft delete_guest es auf)
grant execute on function private.anonymize_guest(uuid) to service_role;
grant execute on function public.guest_list(uuid, text, text, text, text, integer, integer) to authenticated;
grant execute on function public.guest_duplicate_candidates(uuid, text, text, text, text) to authenticated;
grant execute on function public.guest_duplicate_pairs(uuid) to authenticated;
grant execute on function public.merge_guests(uuid, uuid, jsonb) to authenticated;
grant execute on function public.delete_guest(uuid) to authenticated;
