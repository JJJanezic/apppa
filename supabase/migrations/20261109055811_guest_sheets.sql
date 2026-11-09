-- PROJ-26 Gästeblatt (Meldewesen): Gästeblätter je Buchung (unterschrieben am Tablet oder als PDF hochgeladen), Datenschutz-
-- Texte je Kunde, Kontakt (E-Mail, Telefon) in den Kundenstammdaten, Marketing-Einwilligung am Gast, Speicherbereich
-- „guest-sheets“, Lesesichten für Buchung und Liste, Feld-Speichern für Inhaber und Mitarbeiter, Abreise-Nachtrag,
-- Löschsperren, „Gästeherkunft“ nach dem Herkunftsland der Adresse.
-- Lesen: Mitglieder des Kunden (ohne Betreiber-Ausnahme). Schreiben der Blätter nur über register_guest_sheet_upload
-- (Mitglieder) und finish_guest_sheet (nur der Server mit geheimem Schlüssel). Unterschriebene Blätter sind unveränderlich;
-- erlaubt sind nur „ersetzt“, der Abreise-Vermerk und das Umhängen beim Zusammenführen von Gästen.
-- Fehlercodes: P0970 Texte inzwischen geändert, P0973 anderes aktuelles Blatt, P0974 Pflichtangaben fehlen, P0975 Stand
-- geändert, P0976 kein Blatt vorgesehen, P0977 kein Gast, P0978 Gast anonymisiert, P0979 zu viele Mitreisende,
-- P0980 Datei fehlt oder gehört nicht zum Kunden, P0981 Gästeblatt lässt sich nicht ändern/löschen, P0021 Kunde hat Gästeblätter
-- in der Aufbewahrungsfrist, P0016 Kunde deaktiviert.

-- ---------------------------------------------------------------------------
-- Änderungsprotokoll: Quelle einer Änderung durch eine Person (z. B. „Gästeblatt“), sonst wie bisher „user“
-- ---------------------------------------------------------------------------
create or replace function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_column text := coalesce(tg_argv[0], 'tenant_id');
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_actor uuid := auth.uid();
begin
  insert into public.audit_log (
    tenant_id, table_name, record_id, action, old_data, new_data, actor_id, actor_label
  )
  values (
    (v_row ->> v_tenant_column)::uuid,
    tg_table_name,
    (v_row ->> 'id')::uuid,
    lower(tg_op),
    v_old,
    v_new,
    v_actor,
    case
      when v_actor is not null then coalesce(nullif(current_setting('app.source', true), ''), 'user')
      else coalesce(nullif(current_setting('app.actor', true), ''), 'system')
    end
  );
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Kundenstammdaten: Kontakt für Gäste (Platzhalter {E-Mail} und {Telefon} der Datenschutz-Texte)
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column email text check (email is null or (email = lower(btrim(email)) and length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  add column phone text check (phone is null or (phone = btrim(phone) and length(phone) between 4 and 40));

-- ---------------------------------------------------------------------------
-- Datenschutz-Texte je Kunde (leer = Standardtext der App)
-- ---------------------------------------------------------------------------
create table public.guest_sheet_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  privacy_text jsonb check (privacy_text is null or (jsonb_typeof(privacy_text) = 'object' and privacy_text ->> 'type' = 'doc' and pg_column_size(privacy_text) < 200000)),
  marketing_text jsonb check (marketing_text is null or (jsonb_typeof(marketing_text) = 'object' and marketing_text ->> 'type' = 'doc' and pg_column_size(marketing_text) < 200000)),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
comment on table public.guest_sheet_settings is 'Einstellungen → Gästeblatt (PROJ-26): Datenschutz-Information (Teil A) und Marketing-Einwilligung (Teil B); null = Standardtext.';

-- ---------------------------------------------------------------------------
-- Gästeblätter
-- ---------------------------------------------------------------------------
create table public.guest_sheets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  booking_id uuid not null,
  -- Hauptgast beim Unterschreiben bzw. Hochladen (hochgeladen: auch ohne Gast)
  guest_id uuid,
  kind text not null check (kind in ('signed', 'uploaded')),
  sheet_number text check (sheet_number is null or (sheet_number = btrim(sheet_number) and length(sheet_number) between 1 and 30)),
  marketing_consent boolean not null default false,
  -- eingefrorene Fassung (nur unterschrieben)
  snapshot jsonb,
  signed_at_1 timestamptz,
  signed_at_2 timestamptz,
  signature_1_path text unique,
  signature_2_path text unique,
  pdf_path text not null unique,
  pdf_sha256 text check (pdf_sha256 is null or pdf_sha256 ~ '^[0-9a-f]{64}$'),
  -- hochgeladen: „Unterschrieben am“ (optional)
  signed_on date,
  -- Abreise-Nachtrag: wer die tatsächliche Abreise nach der Unterschrift an der Buchung gespeichert hat
  departure_noted_at timestamptz,
  departure_noted_by uuid,
  replaced_at timestamptz,
  replaced_by uuid references public.guest_sheets (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint guest_sheets_booking_fkey foreign key (booking_id, tenant_id) references public.bookings (id, tenant_id),
  constraint guest_sheets_guest_fkey foreign key (guest_id) references public.guests (id),
  constraint guest_sheets_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null,
  constraint guest_sheets_noted_by_fkey foreign key (departure_noted_by) references public.profiles (id) on delete set null,
  constraint guest_sheets_signed_check check (
    kind <> 'signed' or (snapshot is not null and signed_at_1 is not null and signed_at_2 is not null
      and signature_1_path is not null and signature_2_path is not null and pdf_sha256 is not null and guest_id is not null)
  ),
  constraint guest_sheets_uploaded_check check (
    kind <> 'uploaded' or (snapshot is null and signature_1_path is null and signature_2_path is null)
  ),
  -- Dateien im Ordner des eigenen Kunden
  constraint guest_sheets_paths_check check (
    split_part(pdf_path, '/', 1) = tenant_id::text
    and (signature_1_path is null or split_part(signature_1_path, '/', 1) = tenant_id::text)
    and (signature_2_path is null or split_part(signature_2_path, '/', 1) = tenant_id::text)
  )
);
comment on table public.guest_sheets is 'Gästeblätter je Buchung (PROJ-26). Schreiben nur über register_guest_sheet_upload und finish_guest_sheet; unterschriebene Blätter sind unveränderlich.';

-- Je Buchung höchstens ein aktuelles Blatt
create unique index guest_sheets_current_key on public.guest_sheets (booking_id) where replaced_at is null;
create index guest_sheets_list_idx on public.guest_sheets (tenant_id, created_at desc);
create index guest_sheets_booking_idx on public.guest_sheets (booking_id, created_at desc);
create index guest_sheets_guest_idx on public.guest_sheets (guest_id);
create index guest_sheets_replaced_by_idx on public.guest_sheets (replaced_by);

-- Marketing-Einwilligung am Gast (Grundlage für PROJ-19): erteilt am, über welches Gästeblatt
alter table public.guests
  add column marketing_consent_at timestamptz,
  add column marketing_consent_sheet_id uuid references public.guest_sheets (id) on delete set null;
create index guests_marketing_consent_sheet_idx on public.guests (marketing_consent_sheet_id);

-- ---------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------
revoke all on public.guest_sheet_settings from anon, authenticated;
revoke all on public.guest_sheets from anon, authenticated;
grant select on public.guest_sheet_settings to authenticated;
grant select on public.guest_sheets to authenticated;

alter table public.guest_sheet_settings enable row level security;
alter table public.guest_sheets enable row level security;

create policy "Mitglieder lesen Gästeblatt-Texte" on public.guest_sheet_settings for select to authenticated
  using (private.is_member(tenant_id));
create policy "Mitglieder lesen Gästeblätter" on public.guest_sheets for select to authenticated
  using (private.is_member(tenant_id));

select private.enable_tenant_table('public.guest_sheet_settings');
select private.enable_tenant_table('public.guest_sheets');

-- Unveränderlich: nur „ersetzt“, Abreise-Vermerk und Gast (Zusammenführen) ändern sich; Löschen nur mit dem ganzen Kunden
create function private.protect_guest_sheet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_free constant text[] := array['replaced_at', 'replaced_by', 'departure_noted_at', 'departure_noted_by', 'guest_id', 'updated_at', 'updated_by'];
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.tenants t where t.id = old.tenant_id) then
      raise exception 'Gästeblätter lassen sich nicht löschen.' using errcode = 'P0981';
    end if;
    return old;
  end if;
  if (to_jsonb(new) - v_free) is distinct from (to_jsonb(old) - v_free) then
    raise exception 'Gästeblätter lassen sich nicht ändern.' using errcode = 'P0981';
  end if;
  return new;
end;
$$;
create trigger a_protect_guest_sheet before update or delete on public.guest_sheets
  for each row execute function private.protect_guest_sheet();

-- ---------------------------------------------------------------------------
-- Speicherbereich: privat, PDF und PNG bis 10 MB, ein Ordner je Kunde
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guest-sheets', 'guest-sheets', false, 10485760, array['application/pdf', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf', 'image/png'];

-- Kunde eines Speicherorts <Kunde>/<zufällig>.pdf|.png (null bei jedem anderen Format)
create function private.guest_sheet_file_tenant(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png)$'
    then split_part(p_name, '/', 1)::uuid end;
$$;

-- Mitglieder laden alte Gästeblätter (PDF) in den eigenen Ordner; Lesen, Ändern, Löschen nur der Server
create policy "Mitglieder laden Gästeblätter in den eigenen Ordner"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'guest-sheets'
    and name ~ '\.pdf$'
    and private.guest_sheet_file_tenant(name) is not null
    and private.is_member(private.guest_sheet_file_tenant(name))
  );

-- Tägliche Bereinigung: Dateien älter als 24 Stunden, auf die kein Gästeblatt zeigt. Nur für den Server.
create function public.unused_guest_sheet_files(p_limit integer default 1000)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'guest-sheets'
    and o.created_at < now() - interval '24 hours'
    and not exists (
      select 1 from public.guest_sheets s
      where s.pdf_path = o.name or s.signature_1_path = o.name or s.signature_2_path = o.name
    )
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

-- ---------------------------------------------------------------------------
-- Regeln
-- ---------------------------------------------------------------------------
-- Ist für die Buchung ein Gästeblatt vorgesehen? Buchung, nicht storniert, ohne „Wohnsitz angemeldet“
create function private.guest_sheet_expected(b public.bookings)
returns boolean
language sql
immutable
set search_path = ''
as $$ select b.kind = 'booking' and b.cancelled_at is null and not b.residence_registered; $$;

-- Pflichtangaben laut Meldeformular (gleiche Regel wie sheetGaps in src/lib/guest-sheet.ts)
create function private.guest_sheet_complete(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    nullif(btrim(g.last_name), '') is not null and nullif(btrim(g.first_name), '') is not null
    and g.birth_date is not null and g.country is not null
    and nullif(btrim(g.street), '') is not null and nullif(btrim(g.postal_code), '') is not null
    and nullif(btrim(g.city), '') is not null and g.address_country is not null
    and (g.country = 'AT' or (g.document_type is not null and nullif(btrim(g.document_number), '') is not null
      and g.document_issued_on is not null and nullif(btrim(g.document_authority), '') is not null and g.document_country is not null))
    and (select count(*) from public.booking_companions c where c.booking_id = b.id) = b.adults + cardinality(b.child_ages) - 1
    and not exists (
      select 1 from public.booking_companions c
      where c.booking_id = b.id and (nullif(btrim(c.last_name), '') is null or nullif(btrim(c.first_name), '') is null or c.birth_date is null)
    )
  from public.bookings b join public.guests g on g.id = b.guest_id
  where b.id = p_booking_id;
$$;

-- Mitreisende der Buchung in der Schreibweise der eingefrorenen Fassung
create function private.guest_sheet_companions(p_booking_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('lastName', c.last_name, 'firstName', c.first_name, 'birthDate', c.birth_date) order by c.position), '[]'::jsonb)
  from public.booking_companions c where c.booking_id = p_booking_id;
$$;

-- Marketing-Einwilligung am Gast vermerken; eine jüngere bleibt bestehen
create function private.note_marketing_consent(p_guest_id uuid, p_at timestamptz, p_sheet_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.guests set marketing_consent_at = p_at, marketing_consent_sheet_id = p_sheet_id
  where id = p_guest_id and anonymized_at is null and (marketing_consent_at is null or marketing_consent_at <= p_at);
$$;

-- ---------------------------------------------------------------------------
-- Lesesichten (mit den Rechten des Lesenden)
-- ---------------------------------------------------------------------------
create view public.guest_sheet_list
with (security_invoker = true)
as
select
  s.id,
  s.tenant_id,
  s.booking_id,
  s.guest_id,
  s.kind,
  s.sheet_number,
  s.marketing_consent,
  s.snapshot,
  s.signature_1_path,
  s.signature_2_path,
  s.pdf_path,
  s.signed_at_2 as signed_at,
  s.signed_on,
  s.replaced_at,
  s.departure_noted_at,
  s.created_at,
  cp.display_name as created_by_name,
  np.display_name as departure_noted_by_name,
  b.number as booking_number,
  b.cancelled_at is not null as booking_cancelled,
  b.arrival,
  b.departure,
  g.last_name,
  g.first_name,
  g.title_prefix,
  g.title_suffix,
  p.name as property_name,
  a.name as apartment_name,
  -- Buchung nach der Unterschrift geändert: Ankunft, geplante Abreise, Hauptgast oder Mitreisende weichen ab (Gastdaten nicht)
  coalesce(s.kind = 'signed' and (
    s.snapshot -> 'stay' ->> 'arrival' is distinct from b.arrival::text
    or s.snapshot -> 'stay' ->> 'plannedDeparture' is distinct from b.planned_departure::text
    or s.guest_id is distinct from b.guest_id
    or s.snapshot -> 'companions' is distinct from private.guest_sheet_companions(b.id)
  ), false) as changed,
  concat_ws(' ', s.sheet_number, b.number, g.last_name, g.first_name) as search_text
from public.guest_sheets s
join public.bookings b on b.id = s.booking_id
join public.apartments a on a.id = b.apartment_id
join public.properties p on p.id = a.property_id
left join public.guests g on g.id = s.guest_id
left join public.profiles cp on cp.id = s.created_by
left join public.profiles np on np.id = s.departure_noted_by;

create view public.guest_sheet_missing
with (security_invoker = true)
as
select
  b.id as booking_id,
  b.tenant_id,
  b.number as booking_number,
  b.arrival,
  b.departure,
  b.guest_sheet_number,
  g.last_name,
  g.first_name,
  g.title_prefix,
  g.title_suffix,
  p.name as property_name,
  a.name as apartment_name,
  concat_ws(' ', b.number, b.guest_sheet_number, g.last_name, g.first_name) as search_text
from public.bookings b
join public.apartments a on a.id = b.apartment_id
join public.properties p on p.id = a.property_id
left join public.guests g on g.id = b.guest_id
where b.kind = 'booking' and b.cancelled_at is null and not b.residence_registered
  and not exists (select 1 from public.guest_sheets s where s.booking_id = b.id and s.replaced_at is null);

grant select on public.guest_sheet_list to authenticated;
grant select on public.guest_sheet_missing to authenticated;

-- ---------------------------------------------------------------------------
-- Einstellungen → Gästeblatt speichern (nur Inhaber)
-- ---------------------------------------------------------------------------
-- Text eines Dokuments: alle Textknoten aneinander
create function private.rich_doc_text(p_doc jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(string_agg(t #>> '{}', ''), '') from jsonb_path_query(coalesce(p_doc, '{}'::jsonb), 'strict $.**.text') as t;
$$;

create function private.check_guest_sheet_text(p_doc jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text := private.rich_doc_text(p_doc);
  v_token text;
begin
  if p_doc is null then
    return;
  end if;
  if jsonb_typeof(p_doc) <> 'object' or p_doc ->> 'type' <> 'doc' or btrim(v_text) = '' or length(v_text) > 5000 then
    raise exception 'Ungültiger Text.' using errcode = '22023';
  end if;
  for v_token in select m[1] from regexp_matches(v_text, '\{([^{}\n]{1,40})\}', 'g') as m loop
    if v_token not in ('Kundenname', 'Anschrift', 'E-Mail', 'Telefon') then
      raise exception 'Unbekannter Platzhalter.' using errcode = '22023';
    end if;
  end loop;
end;
$$;

create function private.save_guest_sheet_texts(p_tenant_id uuid, p_expected_updated_at timestamptz, p_privacy jsonb, p_marketing jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.guest_sheet_settings;
begin
  if exists (select 1 from public.tenants t where t.id = p_tenant_id and t.status = 'deactivated') then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  if not private.has_role(p_tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = '42501';
  end if;
  perform private.check_guest_sheet_text(p_privacy);
  perform private.check_guest_sheet_text(p_marketing);
  select * into v_row from public.guest_sheet_settings where tenant_id = p_tenant_id for update;
  if v_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'Die Texte wurden inzwischen geändert.' using errcode = 'P0970';
  end if;
  insert into public.guest_sheet_settings (tenant_id, privacy_text, marketing_text)
  values (p_tenant_id, p_privacy, p_marketing)
  on conflict (tenant_id) do update set privacy_text = excluded.privacy_text, marketing_text = excluded.marketing_text
  returning * into v_row;
  return v_row.updated_at;
end;
$$;

create function public.save_guest_sheet_texts(p_tenant_id uuid, p_expected_updated_at timestamptz, p_privacy jsonb, p_marketing jsonb)
returns timestamptz language sql security invoker set search_path = ''
as $$ select private.save_guest_sheet_texts(p_tenant_id, p_expected_updated_at, p_privacy, p_marketing); $$;

-- ---------------------------------------------------------------------------
-- Seite 1: ein Feld bzw. eine Feldgruppe speichern (Inhaber und Mitarbeiter, nur die Felder des Blatts)
-- ---------------------------------------------------------------------------
create function private.save_guest_sheet_field(p_booking_id uuid, p_target text, p_values jsonb, p_expected_updated_at timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_guest public.guests;
  v_allowed constant text[] := array['last_name', 'first_name', 'gender', 'birth_date', 'country', 'document_type', 'document_number',
    'document_issued_on', 'document_authority', 'document_country', 'street', 'postal_code', 'city', 'address_country'];
  v_key text;
  v_updated timestamptz;
  v jsonb := p_values;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if p_values is null or jsonb_typeof(p_values) <> 'object' or p_target not in ('guest', 'booking', 'companions') then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'Buchung nicht gefunden.' using errcode = '42501';
  end if;
  if exists (select 1 from public.tenants t where t.id = v_booking.tenant_id and t.status = 'deactivated') then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  if not private.is_member(v_booking.tenant_id) then
    raise exception 'Buchung nicht gefunden.' using errcode = '42501';
  end if;
  if not private.guest_sheet_expected(v_booking) then
    raise exception 'Für diese Buchung ist kein Gästeblatt vorgesehen.' using errcode = 'P0976';
  end if;
  -- Im Änderungsprotokoll als „Gästeblatt“ vermerkt
  perform set_config('app.source', 'Gästeblatt', true);

  if p_target = 'guest' then
    if v_booking.guest_id is null then
      raise exception 'Kein Gast verknüpft.' using errcode = 'P0977';
    end if;
    select * into v_guest from public.guests where id = v_booking.guest_id for update;
    if v_guest.anonymized_at is not null then
      raise exception 'Der Gast ist anonymisiert.' using errcode = 'P0978';
    end if;
    if v_guest.updated_at is distinct from p_expected_updated_at then
      raise exception 'Der Gast wurde inzwischen geändert.' using errcode = 'P0975';
    end if;
    for v_key in select jsonb_object_keys(p_values) loop
      if not v_key = any (v_allowed) then
        raise exception 'Ungültige Eingabe.' using errcode = '22023';
      end if;
    end loop;
    begin
      update public.guests set
        last_name = case when v ? 'last_name' then btrim(v ->> 'last_name') else last_name end,
        first_name = case when v ? 'first_name' then nullif(btrim(v ->> 'first_name'), '') else first_name end,
        gender = case when v ? 'gender' then v ->> 'gender' else gender end,
        birth_date = case when v ? 'birth_date' then nullif(v ->> 'birth_date', '')::date else birth_date end,
        country = case when v ? 'country' then upper(v ->> 'country') else country end,
        document_type = case when v ? 'document_type' then nullif(v ->> 'document_type', '') else document_type end,
        document_number = case when v ? 'document_number' then nullif(btrim(v ->> 'document_number'), '') else document_number end,
        document_issued_on = case when v ? 'document_issued_on' then nullif(v ->> 'document_issued_on', '')::date else document_issued_on end,
        document_authority = case when v ? 'document_authority' then nullif(btrim(v ->> 'document_authority'), '') else document_authority end,
        document_country = case when v ? 'document_country' then nullif(upper(v ->> 'document_country'), '') else document_country end,
        street = case when v ? 'street' then nullif(btrim(v ->> 'street'), '') else street end,
        postal_code = case when v ? 'postal_code' then nullif(btrim(v ->> 'postal_code'), '') else postal_code end,
        city = case when v ? 'city' then nullif(btrim(v ->> 'city'), '') else city end,
        address_country = case when v ? 'address_country' then nullif(upper(v ->> 'address_country'), '') else address_country end
      where id = v_guest.id
      returning updated_at into v_updated;
    exception
      when check_violation or invalid_datetime_format or datetime_field_overflow or not_null_violation then
        raise exception 'Ungültige Eingabe.' using errcode = '22023';
    end;
    return v_updated;
  end if;

  if v_booking.updated_at is distinct from p_expected_updated_at then
    raise exception 'Die Buchung wurde inzwischen geändert.' using errcode = 'P0975';
  end if;

  if p_target = 'booking' then
    if exists (select 1 from jsonb_object_keys(p_values) k where k <> 'guest_sheet_number') then
      raise exception 'Ungültige Eingabe.' using errcode = '22023';
    end if;
    begin
      update public.bookings set guest_sheet_number = nullif(btrim(v ->> 'guest_sheet_number'), '')
      where id = p_booking_id
      returning updated_at into v_updated;
    exception when check_violation then
      raise exception 'Ungültige Eingabe.' using errcode = '22023';
    end;
    return v_updated;
  end if;

  -- Mitreisende: dieselbe Regel wie im Buchungsformular (Höchstzahl, Geburtsdatum, Ortstaxe neu rechnen)
  if jsonb_typeof(v -> 'companions') is distinct from 'array' then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;
  begin
    perform private.save_companions(p_booking_id, p_expected_updated_at, v -> 'companions');
  exception
    when sqlstate 'P0808' then raise exception 'Zu viele Mitreisende.' using errcode = 'P0979';
    when sqlstate 'P0803' then raise exception 'Die Buchung wurde inzwischen geändert.' using errcode = 'P0975';
    when sqlstate 'P0807' or check_violation or not_null_violation or invalid_datetime_format then
      raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end;
  select updated_at into v_updated from public.bookings where id = p_booking_id;
  return v_updated;
end;
$$;

create function public.save_guest_sheet_field(p_booking_id uuid, p_target text, p_values jsonb, p_expected_updated_at timestamptz)
returns timestamptz language sql security invoker set search_path = ''
as $$ select private.save_guest_sheet_field(p_booking_id, p_target, p_values, p_expected_updated_at); $$;

-- ---------------------------------------------------------------------------
-- Altes Gästeblatt hochladen (Mitglieder)
-- p_input: booking_id, pdf_path, sheet_number, signed_on, marketing_consent, previous_sheet_id
-- ---------------------------------------------------------------------------
create function private.register_guest_sheet_upload(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_guest public.guests;
  v_path text := p_input ->> 'pdf_path';
  v_number text := nullif(btrim(coalesce(p_input ->> 'sheet_number', '')), '');
  v_signed_on date;
  v_consent boolean := coalesce((p_input ->> 'marketing_consent')::boolean, false);
  v_previous uuid := nullif(p_input ->> 'previous_sheet_id', '')::uuid;
  v_current uuid;
  v_id uuid;
begin
  begin
    v_signed_on := nullif(p_input ->> 'signed_on', '')::date;
  exception when others then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end;
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  select * into v_booking from public.bookings where id = (p_input ->> 'booking_id')::uuid for update;
  if v_booking.id is null then
    raise exception 'Buchung nicht gefunden.' using errcode = '42501';
  end if;
  if exists (select 1 from public.tenants t where t.id = v_booking.tenant_id and t.status = 'deactivated') then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  if not private.is_member(v_booking.tenant_id) then
    raise exception 'Buchung nicht gefunden.' using errcode = '42501';
  end if;
  if not private.guest_sheet_expected(v_booking) then
    raise exception 'Für diese Buchung ist kein Gästeblatt vorgesehen.' using errcode = 'P0976';
  end if;
  if (v_number is not null and length(v_number) > 30) or (v_signed_on is not null and (v_signed_on > private.today_vienna() or v_signed_on < date '1900-01-01')) then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;
  if v_path is null or v_path !~ '\.pdf$' or private.guest_sheet_file_tenant(v_path) is distinct from v_booking.tenant_id
      or not exists (select 1 from storage.objects o where o.bucket_id = 'guest-sheets' and o.name = v_path)
      or exists (select 1 from public.guest_sheets s where s.pdf_path = v_path) then
    raise exception 'Die Datei wurde nicht gefunden.' using errcode = 'P0980';
  end if;
  select id into v_current from public.guest_sheets where booking_id = v_booking.id and replaced_at is null;
  if v_current is distinct from v_previous then
    raise exception 'Für diese Buchung wurde inzwischen ein Gästeblatt gespeichert.' using errcode = 'P0973';
  end if;
  if v_booking.guest_id is not null then
    select * into v_guest from public.guests where id = v_booking.guest_id;
  end if;
  -- Marketing nur mit verknüpftem, nicht anonymisiertem Gast
  v_consent := v_consent and v_guest.id is not null and v_guest.anonymized_at is null;

  v_id := gen_random_uuid();
  if v_current is not null then
    update public.guest_sheets set replaced_at = now() where id = v_current;
  end if;
  insert into public.guest_sheets (id, tenant_id, booking_id, guest_id, kind, sheet_number, marketing_consent, pdf_path, signed_on)
  values (v_id, v_booking.tenant_id, v_booking.id, v_guest.id, 'uploaded', v_number, v_consent, v_path, v_signed_on);
  if v_current is not null then
    update public.guest_sheets set replaced_by = v_id where id = v_current;
  end if;
  if v_booking.guest_sheet_number is distinct from v_number then
    update public.bookings set guest_sheet_number = v_number where id = v_booking.id;
  end if;
  if v_consent then
    perform private.note_marketing_consent(v_guest.id, coalesce(v_signed_on::timestamp at time zone 'Europe/Vienna', now()), v_id);
  end if;
  return v_id;
end;
$$;

create function public.register_guest_sheet_upload(p_input jsonb)
returns uuid language sql security invoker set search_path = ''
as $$ select private.register_guest_sheet_upload(p_input); $$;

-- ---------------------------------------------------------------------------
-- Gästeblatt fertigstellen (nur der Server: PDF und Unterschriften liegt er vorher ab)
-- p_input: tenant_id, booking_id, guest_id, actor_id, booking_updated_at, guest_updated_at, previous_sheet_id, sheet_number,
-- marketing_consent, snapshot, signed_at_1, signed_at_2, signature_1_path, signature_2_path, pdf_path, pdf_sha256
-- ---------------------------------------------------------------------------
create function public.finish_guest_sheet(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := nullif(p_input ->> 'actor_id', '')::uuid;
  v_tenant uuid := (p_input ->> 'tenant_id')::uuid;
  v_booking public.bookings;
  v_guest public.guests;
  v_previous uuid := nullif(p_input ->> 'previous_sheet_id', '')::uuid;
  v_current uuid;
  v_consent boolean := coalesce((p_input ->> 'marketing_consent')::boolean, false);
  v_signed_2 timestamptz := (p_input ->> 'signed_at_2')::timestamptz;
  v_id uuid := gen_random_uuid();
begin
  if v_actor is null or v_tenant is null then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;
  -- Im Namen der Person: Mitgliedschaft und Änderungsprotokoll
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_actor, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.tenants t where t.id = v_tenant and t.status = 'deactivated') then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  if not private.is_member(v_tenant) then
    raise exception 'Kein Mitglied.' using errcode = '42501';
  end if;
  select * into v_booking from public.bookings where id = (p_input ->> 'booking_id')::uuid and tenant_id = v_tenant for update;
  if v_booking.id is null or not private.guest_sheet_expected(v_booking) then
    raise exception 'Für diese Buchung ist kein Gästeblatt vorgesehen.' using errcode = 'P0976';
  end if;
  if v_booking.guest_id is null or v_booking.guest_id is distinct from (p_input ->> 'guest_id')::uuid then
    raise exception 'Kein Gast verknüpft.' using errcode = 'P0977';
  end if;
  select * into v_guest from public.guests where id = v_booking.guest_id for update;
  if v_guest.anonymized_at is not null then
    raise exception 'Der Gast ist anonymisiert.' using errcode = 'P0978';
  end if;
  if v_booking.updated_at is distinct from (p_input ->> 'booking_updated_at')::timestamptz
      or v_guest.updated_at is distinct from (p_input ->> 'guest_updated_at')::timestamptz then
    raise exception 'Buchung oder Gast wurden inzwischen geändert.' using errcode = 'P0975';
  end if;
  if not coalesce(private.guest_sheet_complete(v_booking.id), false) then
    raise exception 'Pflichtangaben fehlen.' using errcode = 'P0974';
  end if;
  select id into v_current from public.guest_sheets where booking_id = v_booking.id and replaced_at is null;
  if v_current is distinct from v_previous then
    raise exception 'Für diese Buchung wurde inzwischen ein Gästeblatt gespeichert.' using errcode = 'P0973';
  end if;

  if v_current is not null then
    update public.guest_sheets set replaced_at = now() where id = v_current;
  end if;
  insert into public.guest_sheets (
    id, tenant_id, booking_id, guest_id, kind, sheet_number, marketing_consent, snapshot, signed_at_1, signed_at_2,
    signature_1_path, signature_2_path, pdf_path, pdf_sha256
  )
  values (
    v_id, v_tenant, v_booking.id, v_guest.id, 'signed', nullif(btrim(coalesce(p_input ->> 'sheet_number', '')), ''), v_consent,
    p_input -> 'snapshot', (p_input ->> 'signed_at_1')::timestamptz, v_signed_2,
    p_input ->> 'signature_1_path', p_input ->> 'signature_2_path', p_input ->> 'pdf_path', p_input ->> 'pdf_sha256'
  );
  if v_current is not null then
    update public.guest_sheets set replaced_by = v_id where id = v_current;
  end if;
  if v_consent then
    perform private.note_marketing_consent(v_guest.id, v_signed_2, v_id);
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Abreise-Nachtrag: Wer nach der Unterschrift die tatsächliche Abreise an der Buchung speichert, steht am aktuellen Blatt
-- ---------------------------------------------------------------------------
create function private.note_guest_sheet_departure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.guest_sheets set departure_noted_at = now(), departure_noted_by = auth.uid()
  where booking_id = new.id and kind = 'signed' and replaced_at is null;
  return null;
end;
$$;
create trigger guest_sheet_departure after update of departure on public.bookings
  for each row when (old.departure is distinct from new.departure)
  execute function private.note_guest_sheet_departure();

-- ===========================================================================
-- Bestehende Funktionen (jeweils letzte Fassung, nur um PROJ-26 ergänzt)
-- ===========================================================================

-- Gast löschen: mit Gästeblatt (PROJ-26) nur anonymisieren
create or replace function private.delete_guest(p_guest_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest public.guests;
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

  -- Mit Buchungen (auch stornierten) oder Rechnungen (PROJ-37, 7 Jahre Aufbewahrung) anonymisieren
  if exists (select 1 from public.bookings where guest_id = p_guest_id)
      or exists (select 1 from public.invoices where guest_id = p_guest_id)
      -- PROJ-26: Gästeblätter (7 Jahre Aufbewahrung)
      or exists (select 1 from public.guest_sheets where guest_id = p_guest_id) then
    perform private.anonymize_guest(p_guest_id);
    return 'anonymized';
  end if;

  delete from public.guests where id = p_guest_id;
  -- Es bleibt nur der Vermerk „gelöscht“ mit Person und Zeitpunkt
  perform private.purge_audit_personal_data('guests', p_guest_id);
  return 'deleted';
end;
$$;

-- Anonymisieren: auch die Marketing-Einwilligung entfernen; Gästeblätter bleiben unverändert (PROJ-26)
create or replace function private.anonymize_guest(p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_companions uuid[];
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
    -- PROJ-26: Marketing-Einwilligung
    marketing_consent_at = null,
    marketing_consent_sheet_id = null,
    -- PROJ-50: Verknüpfung; die alten Firmenspalten (Sicherung) ebenfalls leeren
    company_id = null,
    company_name = null,
    company_vat_id = null,
    company_address_line1 = null,
    company_address_line2 = null,
    company_postal_code = null,
    company_city = null,
    company_country = null,
    note = null,
    -- PROJ-29 (die Ausweisbilder löscht danach der Server aus dem Speicher)
    title_prefix = null,
    title_suffix = null,
    gender = 'unspecified',
    document_type = null,
    document_number = null,
    document_issued_on = null,
    document_authority = null,
    document_country = null,
    document_front_path = null,
    document_back_path = null,
    anonymized_at = now()
  where id = p_guest_id;
  delete from public.guest_duplicate_dismissals where guest_a = p_guest_id or guest_b = p_guest_id;
  perform private.purge_audit_personal_data('guests', p_guest_id);

  -- PROJ-8: Mitreisende aller Buchungen dieses Gastes entfernen (samt Altwerten im Protokoll);
  -- Anzahl und Alter der Personen bleiben an der Buchung
  select array_agg(c.id) into v_companions
  from public.booking_companions c join public.bookings b on b.id = c.booking_id
  where b.guest_id = p_guest_id;
  if v_companions is not null then
    delete from public.booking_companions where id = any (v_companions);
    update public.audit_log set old_data = null, new_data = null
    where table_name = 'booking_companions' and record_id = any (v_companions);
  end if;
end;
$$;

-- Gäste zusammenführen: Gästeblätter umhängen, jüngste Marketing-Einwilligung behalten (PROJ-26)
create or replace function private.merge_guests(p_keep uuid, p_remove uuid, p_choice jsonb)
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
  -- PROJ-29
  b_titles boolean := p_choice ->> 'titles' = 'b';
  b_gender boolean := p_choice ->> 'gender' = 'b';
  b_document boolean := p_choice ->> 'document' = 'b';
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

  -- PROJ-29: Buchungen umhängen und den anderen Gast zuerst entfernen, damit seine Ausweisbilder
  -- (wenn gewählt) an den verbleibenden Gast wandern können (ein Bild hängt immer nur an einem Gast)
  update public.bookings set guest_id = p_keep where guest_id = p_remove;
  -- PROJ-37: Rechnungen hängen danach am verbleibenden Gast
  update public.invoices set guest_id = p_keep where guest_id = p_remove;
  -- PROJ-26: Gästeblätter hängen am verbleibenden Gast
  update public.guest_sheets set guest_id = p_keep where guest_id = p_remove;
  delete from public.guests where id = p_remove;

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
    -- PROJ-50: Verknüpfung mit der Firma statt Firmenfelder
    company_id = case when b_company then v_remove.company_id else v_keep.company_id end,
    note = case when b_note then v_remove.note else v_keep.note end,
    -- PROJ-26: die jüngere Marketing-Einwilligung gilt
    marketing_consent_at = case when coalesce(v_remove.marketing_consent_at, '-infinity') > coalesce(v_keep.marketing_consent_at, '-infinity')
      then v_remove.marketing_consent_at else v_keep.marketing_consent_at end,
    marketing_consent_sheet_id = case when coalesce(v_remove.marketing_consent_at, '-infinity') > coalesce(v_keep.marketing_consent_at, '-infinity')
      then v_remove.marketing_consent_sheet_id else v_keep.marketing_consent_sheet_id end,
    title_prefix = case when b_titles then v_remove.title_prefix else v_keep.title_prefix end,
    title_suffix = case when b_titles then v_remove.title_suffix else v_keep.title_suffix end,
    gender = case when b_gender then v_remove.gender else v_keep.gender end,
    -- Reisedokument als Ganzes (Angaben und beide Bilder)
    document_type = case when b_document then v_remove.document_type else v_keep.document_type end,
    document_number = case when b_document then v_remove.document_number else v_keep.document_number end,
    document_issued_on = case when b_document then v_remove.document_issued_on else v_keep.document_issued_on end,
    document_authority = case when b_document then v_remove.document_authority else v_keep.document_authority end,
    document_country = case when b_document then v_remove.document_country else v_keep.document_country end,
    document_front_path = case when b_document then v_remove.document_front_path else v_keep.document_front_path end,
    document_back_path = case when b_document then v_remove.document_back_path else v_keep.document_back_path end
  where id = p_keep;

  -- Verknüpfung im Protokoll: „zusammengeführt mit …“ beim verbleibenden Gast
  insert into public.audit_log (tenant_id, table_name, record_id, action, old_data, new_data, actor_id, actor_label)
  values (
    v_keep.tenant_id, 'guests', p_keep, 'update', null,
    jsonb_build_object('merged_from', p_remove),
    auth.uid(), 'user'
  );
end;
$$;

-- Kunde löschen: auch Gästeblätter in der Aufbewahrungsfrist sperren (PROJ-26)
create or replace function private.admin_delete_tenant(p_tenant_id uuid, p_confirm_name text)
returns table (user_id uuid, invited_email text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants;
  v_orphans uuid[];
  v_invitees text[];
begin
  perform private.require_admin();
  v_tenant := private.lock_tenant(p_tenant_id, false);
  if v_tenant.status <> 'deactivated' then
    raise exception 'Nur deaktivierte Kunden lassen sich endgültig löschen.' using errcode = 'P0012';
  end if;
  if btrim(coalesce(p_confirm_name, '')) <> btrim(v_tenant.name) then
    raise exception 'Der eingetippte Name stimmt nicht mit dem Kundennamen überein.' using errcode = 'P0013';
  end if;
  if exists (
    select 1 from public.invoices i
    where i.tenant_id = p_tenant_id and i.origin = 'issued'
      and i.invoice_date >= make_date(extract(year from private.today_vienna())::integer - 7, 1, 1)
  ) then
    raise exception 'Ausgestellte Rechnungen fallen noch unter die Aufbewahrungspflicht.' using errcode = 'P0019';
  end if;

  -- PROJ-26: Gästeblätter 7 Jahre aufbewahren
  if exists (
    select 1 from public.guest_sheets s
    where s.tenant_id = p_tenant_id and s.created_at >= make_date(extract(year from private.today_vienna())::integer - 7, 1, 1)
  ) then
    raise exception 'Gästeblätter fallen noch unter die Aufbewahrungspflicht.' using errcode = 'P0021';
  end if;

  select coalesce(array_agg(m.user_id), '{}') into v_orphans
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  where m.tenant_id = p_tenant_id
    and not p.is_operator_admin
    and not exists (
      select 1 from public.memberships other where other.user_id = m.user_id and other.tenant_id <> p_tenant_id
    )
    and not exists (
      select 1 from public.invitations i
      where lower(i.email) = lower(p.email) and i.status = 'open' and i.tenant_id <> p_tenant_id
    );

  select coalesce(array_agg(distinct i.email), '{}') into v_invitees
  from public.invitations i
  where i.tenant_id = p_tenant_id and i.status = 'open' and i.kind = 'new_account';

  -- Kaskade: Mitgliedschaften, Einladungen und künftig alle Fachdaten mit tenant_id
  delete from public.tenants where id = p_tenant_id;
  -- Änderungsprotokoll dieses Kunden (auch die Einträge, die die Kaskade eben geschrieben hat)
  delete from public.audit_log where tenant_id = p_tenant_id;
  -- Betreiber-Protokoll: Personenangaben entfernen, Einträge als Nachweis behalten
  update public.operator_log set target_email = null where tenant_id = p_tenant_id;
  perform private.log_operator(p_tenant_id, v_tenant.name, 'deleted');

  return query
    select o, null::text from unnest(v_orphans) as o
    union all
    select null::uuid, e from unnest(v_invitees) as e;
end;
$$;

-- Auswertung „Gästeherkunft“ (PROJ-18): Herkunftsland laut Adresse, sonst Staatsangehörigkeit (PROJ-26)
create or replace function private.statistics_booking_parts(p_tenant_ids uuid[], p_months date[])
returns table (
  tenant_id uuid,
  apartment_id uuid,
  -- Herkunftsland des Hauptgasts; „ZZ“ ohne Hauptgast
  country text,
  month date,
  nights integer,
  revenue_cents bigint,
  revenue_vat_cents bigint,
  fee_cents bigint,
  fee_vat_cents bigint,
  guest_nights integer,
  arrivals integer,
  bookings integer,
  stay_nights integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with owned as (
    select t.id from unnest(p_tenant_ids) as t(id) where private.has_role(t.id, 'owner')
  ),
  bounds as (
    select min(m) as lo, (max(m) + interval '1 month')::date as hi from unnest(p_months) as m
  ),
  bk as materialized (
    select
      b.id,
      b.tenant_id,
      b.apartment_id,
      b.arrival,
      b.departure,
      b.cancelled_at,
      (coalesce(b.adults, 0) + coalesce(cardinality(b.child_ages), 0))::integer as persons,
      coalesce(g.address_country, g.country, 'ZZ') as country,
      (b.departure - b.arrival) as n,
      -- Kleinunternehmer am maßgeblichen Tag (PROJ-36): Stornotag in österreichischer Zeit, sonst die Abreise
      private.small_business_on(
        b.tenant_id,
        case when b.cancelled_at is null then b.departure else (b.cancelled_at at time zone 'Europe/Vienna')::date end
      ) as small
    from public.bookings b
    join owned o on o.id = b.tenant_id
    cross join bounds bo
    left join public.guests g on g.id = b.guest_id
    where b.kind = 'booking'
      and b.departure > b.arrival
      and b.arrival < bo.hi
      and b.departure > bo.lo
  ),
  lines as (
    -- Positionen für Umsatz und USt: verrechnete Übernachtung und Zusatzkosten ohne Ortstaxe
    select k.id, a.nights_vat_rate as rate, coalesce(a.billed_nights_cents, a.nights_cents)::bigint as amount
    from bk k
    join public.booking_amounts a on a.id = k.id
    where k.cancelled_at is null
    union all
    select k.id, c.vat_rate, c.amount_cents::bigint
    from bk k
    join public.booking_charges c on c.booking_id = k.id and c.tenant_id = k.tenant_id
    where k.cancelled_at is null and not c.tourist_tax
  ),
  per_rate as (
    select l.id, l.rate, sum(l.amount) as gross from lines l group by l.id, l.rate
  ),
  totals as materialized (
    select
      k.id, k.tenant_id, k.apartment_id, k.arrival, k.persons, k.country, k.n,
      coalesce(sum(r.gross), 0)::bigint as total,
      (case when k.small then 0 else coalesce(sum(round(r.gross::numeric * r.rate / (100 + r.rate))), 0) end)::bigint as vat
    from bk k
    left join per_rate r on r.id = k.id
    where k.cancelled_at is null
    group by k.id, k.tenant_id, k.apartment_id, k.arrival, k.persons, k.country, k.n, k.small
  ),
  parts as (
    select
      t.*,
      m.month::date as month,
      -- Nächte vor Monatsbeginn bzw. bis Monatsende
      least(greatest(m.month::date - t.arrival, 0), t.n) as j0,
      least(greatest((m.month + interval '1 month')::date - t.arrival, 0), t.n) as j1,
      date_trunc('month', t.arrival::timestamp)::date as arrival_month
    from totals t
    cross join lateral generate_series(
      date_trunc('month', t.arrival::timestamp),
      date_trunc('month', (t.arrival + t.n - 1)::timestamp),
      interval '1 month'
    ) as m(month)
  ),
  stays as (
    select
      p.tenant_id,
      p.apartment_id,
      p.country,
      p.month,
      (p.j1 - p.j0)::integer as nights,
      -- gleichmäßig je Nacht (ganzzahlig), der Rest in der letzten Nacht
      ((p.total / p.n) * (p.j1 - p.j0) + case when p.j1 = p.n then p.total - (p.total / p.n) * p.n else 0 end)::bigint as revenue_cents,
      ((p.vat / p.n) * (p.j1 - p.j0) + case when p.j1 = p.n then p.vat - (p.vat / p.n) * p.n else 0 end)::bigint as revenue_vat_cents,
      0::bigint as fee_cents,
      0::bigint as fee_vat_cents,
      (p.persons * (p.j1 - p.j0))::integer as guest_nights,
      (case when p.month = p.arrival_month then p.persons else 0 end)::integer as arrivals,
      (case when p.month = p.arrival_month then 1 else 0 end)::integer as bookings,
      (case when p.month = p.arrival_month then p.n else 0 end)::integer as stay_nights
    from parts p
    where p.month = any(p_months)
  ),
  fees as (
    -- Stornierte Buchungen mit Stornogebühr: im Monat der Anreise
    select
      k.tenant_id,
      k.apartment_id,
      k.country,
      date_trunc('month', k.arrival::timestamp)::date as month,
      0 as nights,
      0::bigint as revenue_cents,
      0::bigint as revenue_vat_cents,
      a.cancellation_fee_cents::bigint as fee_cents,
      (case when k.small then 0
        else round(a.cancellation_fee_cents::numeric * a.cancellation_fee_vat_rate / (100 + a.cancellation_fee_vat_rate)) end)::bigint as fee_vat_cents,
      0 as guest_nights,
      0 as arrivals,
      0 as bookings,
      0 as stay_nights
    from bk k
    join public.booking_amounts a on a.id = k.id
    where k.cancelled_at is not null
      and coalesce(a.cancellation_fee_cents, 0) <> 0
      and date_trunc('month', k.arrival::timestamp)::date = any(p_months)
  )
  select * from stays
  union all
  select * from fees;
$$;

-- Kundenstammdaten: E-Mail und Telefon (PROJ-26)
create or replace function private.update_tenant_master_data(p_tenant_id uuid, p_expected_updated_at timestamptz, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.tenants;
  v_new public.tenants;
  v_changed text[] := '{}';
  v_column text;
  v_vat jsonb := p_data -> 'vat_status';
  v_vat_old jsonb;
  v_vat_new jsonb;
  -- PROJ-38: Logo; fehlt der Schlüssel, bleibt es unverändert, null entfernt es
  v_logo_given boolean := p_data ? 'logo_path';
  v_logo text := nullif(btrim(coalesce(p_data ->> 'logo_path', '')), '');
  -- PROJ-46: Bankkonten; fehlt der Schlüssel, bleiben sie unverändert
  v_bank jsonb := p_data -> 'bank_accounts';
  v_bank_rows jsonb;
  v_bank_old jsonb;
  v_bank_new jsonb;
  v_max_position integer;
begin
  -- Inhaber dieses (aktiven) Kunden oder Admin mit 2FA; Mitarbeiter und fremde Inhaber nicht
  if not (private.is_admin() or private.has_role(p_tenant_id, 'owner')) then
    raise exception 'Keine Berechtigung für diese Kundendaten.' using errcode = '42501';
  end if;
  v_old := private.lock_tenant(p_tenant_id, true);
  if v_old.updated_at is distinct from p_expected_updated_at then
    raise exception 'Die Kundendaten wurden inzwischen geändert.' using errcode = 'P0017';
  end if;

  -- Bereinigen wie im Formular: Leerzeichen am Rand weg, leer = nicht angegeben, UID ohne Leerzeichen in Großbuchstaben
  v_new := v_old;
  v_new.name := btrim(coalesce(p_data ->> 'name', ''));
  v_new.name_line2 := nullif(btrim(p_data ->> 'name_line2'), '');
  v_new.address_line1 := nullif(btrim(p_data ->> 'address_line1'), '');
  v_new.address_line2 := nullif(btrim(p_data ->> 'address_line2'), '');
  v_new.postal_code := nullif(btrim(p_data ->> 'postal_code'), '');
  v_new.city := nullif(btrim(p_data ->> 'city'), '');
  v_new.country := nullif(upper(btrim(p_data ->> 'country')), '');
  v_new.vat_id := nullif(upper(regexp_replace(coalesce(p_data ->> 'vat_id', ''), '\s', '', 'g')), '');
  v_new.tax_number := nullif(btrim(p_data ->> 'tax_number'), '');
  v_new.register_number := nullif(btrim(p_data ->> 'register_number'), '');
  -- PROJ-26: Kontakt für Gäste; fehlt der Schlüssel, bleibt der Wert
  if p_data ? 'email' then
    v_new.email := nullif(lower(btrim(coalesce(p_data ->> 'email', ''))), '');
  end if;
  if p_data ? 'phone' then
    v_new.phone := nullif(btrim(coalesce(p_data ->> 'phone', '')), '');
  end if;
  -- Logo (PROJ-38): ein neuer Speicherort muss im Ordner dieses Kunden liegen und als PNG hochgeladen sein
  if v_logo_given then
    if v_logo is not null and v_logo is distinct from v_old.logo_path and (
      private.logo_tenant(v_logo) is distinct from p_tenant_id
      or not exists (select 1 from storage.objects o where o.bucket_id = 'tenant-logos' and o.name = v_logo)
    ) then
      raise exception 'Das Logo wurde nicht gefunden.' using errcode = 'P0018';
    end if;
    v_new.logo_path := v_logo;
  end if;

  foreach v_column in array array[
    'name', 'name_line2', 'address_line1', 'address_line2', 'postal_code', 'city', 'country', 'vat_id', 'tax_number',
    'register_number', 'logo_path', 'email', 'phone'
  ] loop
    if (to_jsonb(v_old) -> v_column) is distinct from (to_jsonb(v_new) -> v_column) then
      v_changed := v_changed || v_column;
    end if;
  end loop;

  -- Kleinunternehmer-Status (PROJ-36). Fehlt der Schlüssel, bleibt der Verlauf unverändert.
  if v_vat is not null then
    if jsonb_typeof(v_vat) <> 'array' or jsonb_array_length(v_vat) > 50 or exists (
      select 1 from jsonb_array_elements(v_vat) e
      where jsonb_typeof(e) <> 'object'
         or jsonb_typeof(e -> 'small_business') is distinct from 'boolean'
         or coalesce(e ->> 'valid_from', '') !~ '^\d{4}-\d{2}-\d{2}$'
    ) then
      raise exception 'Ungültiger Umsatzsteuer-Status.' using errcode = '22023';
    end if;
    -- Vergleich in fester Reihenfolge; ungültige Kalendertage (z. B. 2026-02-30) scheitern hier beim Umwandeln
    select coalesce(jsonb_agg(jsonb_build_array(v.valid_from, v.small_business) order by v.valid_from), '[]'::jsonb)
      into v_vat_old
      from public.vat_status_changes v where v.tenant_id = p_tenant_id;
    select coalesce(jsonb_agg(jsonb_build_array(d, b) order by d, b), '[]'::jsonb)
      into v_vat_new
      from (
        select (e ->> 'valid_from')::date d, (e ->> 'small_business')::boolean b
        from jsonb_array_elements(v_vat) e
      ) x;
    if v_vat_old is distinct from v_vat_new then
      v_changed := v_changed || 'vat_status'::text;
    end if;
  end if;

  -- Bankkonten (PROJ-46): vollständige Liste aller Konten des Kunden, je Konto mit fester Kennung
  if v_bank is not null then
    if jsonb_typeof(v_bank) <> 'array' or jsonb_array_length(v_bank) > 20 or exists (
      select 1 from jsonb_array_elements(v_bank) e
      where jsonb_typeof(e) <> 'object'
         or coalesce(e ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or jsonb_typeof(e -> 'account_holder') is distinct from 'string'
         or jsonb_typeof(e -> 'iban') is distinct from 'string'
         or jsonb_typeof(e -> 'is_primary') is distinct from 'boolean'
         or jsonb_typeof(e -> 'archived') is distinct from 'boolean'
    ) or (select count(distinct e ->> 'id') from jsonb_array_elements(v_bank) e) <> jsonb_array_length(v_bank) then
      raise exception 'Ungültige Bankkonten.' using errcode = '22023';
    end if;
    -- Kennungen anderer Kunden sind nicht erlaubt
    if exists (
      select 1 from jsonb_array_elements(v_bank) e
      join public.bank_accounts b on b.id = (e ->> 'id')::uuid
      where b.tenant_id <> p_tenant_id
    ) then
      raise exception 'Ungültige Bankkonten.' using errcode = '22023';
    end if;

    -- Bereinigen wie im Formular; ord = Reihenfolge in der Liste (für neue Konten)
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', (e ->> 'id')::uuid,
        'label', nullif(btrim(e ->> 'label'), ''),
        'account_holder', btrim(e ->> 'account_holder'),
        'iban', upper(regexp_replace(e ->> 'iban', '\s', '', 'g')),
        'bic', nullif(upper(regexp_replace(coalesce(e ->> 'bic', ''), '\s', '', 'g')), ''),
        'bank_name', nullif(btrim(e ->> 'bank_name'), ''),
        'note', nullif(btrim(e ->> 'note'), ''),
        'is_primary', (e ->> 'is_primary')::boolean,
        'archived', (e ->> 'archived')::boolean,
        'ord', o
      )), '[]'::jsonb)
      into v_bank_rows
      from jsonb_array_elements(v_bank) with ordinality t(e, o);

    -- Primär-Regel: gibt es Konten, ist genau eines primär, und das primäre ist nicht archiviert
    if jsonb_array_length(v_bank_rows) > 0 and (
      (select count(*) from jsonb_array_elements(v_bank_rows) x where (x ->> 'is_primary')::boolean) <> 1
      or exists (select 1 from jsonb_array_elements(v_bank_rows) x where (x ->> 'is_primary')::boolean and (x ->> 'archived')::boolean)
    ) then
      raise exception 'Genau ein aktives Bankkonto muss primär sein.' using errcode = 'P0019';
    end if;

    -- Vergleich ohne Reihenfolge (die Position bestehender Konten ändert sich nie)
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id, 'label', b.label, 'account_holder', b.account_holder, 'iban', b.iban, 'bic', b.bic,
        'bank_name', b.bank_name, 'note', b.note, 'is_primary', b.is_primary, 'archived', b.archived_at is not null
      ) order by b.id), '[]'::jsonb)
      into v_bank_old
      from public.bank_accounts b where b.tenant_id = p_tenant_id;
    select coalesce(jsonb_agg(x - 'ord' order by (x ->> 'id')::uuid), '[]'::jsonb)
      into v_bank_new
      from jsonb_array_elements(v_bank_rows) x;
    if v_bank_old is distinct from v_bank_new then
      v_changed := v_changed || 'bank_accounts'::text;
    end if;
  end if;

  -- Speichern ohne Änderung: kein Fehler, kein Protokolleintrag
  if cardinality(v_changed) = 0 then
    return jsonb_build_object('unused_logo', null);
  end if;

  -- Prüfregeln der Tabelle greifen hier (z. B. leerer Name, UID-Format).
  -- Auch bei reiner Verlaufs- oder Kontenänderung: setzt „zuletzt geändert am“ (Trigger), damit der Konfliktschutz greift.
  update public.tenants set
    name = v_new.name,
    name_line2 = v_new.name_line2,
    address_line1 = v_new.address_line1,
    address_line2 = v_new.address_line2,
    postal_code = v_new.postal_code,
    city = v_new.city,
    country = v_new.country,
    vat_id = v_new.vat_id,
    tax_number = v_new.tax_number,
    register_number = v_new.register_number,
    email = v_new.email,
    phone = v_new.phone,
    logo_path = v_new.logo_path
  where id = p_tenant_id;

  if 'vat_status' = any(v_changed) then
    -- Verlauf vollständig ersetzen; ein doppeltes Datum scheitert an der Eindeutigkeit (23505)
    delete from public.vat_status_changes where tenant_id = p_tenant_id;
    insert into public.vat_status_changes (tenant_id, valid_from, small_business)
    select p_tenant_id, (e ->> 'valid_from')::date, (e ->> 'small_business')::boolean
    from jsonb_array_elements(v_vat) e;
  end if;

  if 'bank_accounts' = any(v_changed) then
    -- Fehlende Konten löschen; verwendet eine Wohnung das Konto, scheitert das am Fremdschlüssel (23503)
    delete from public.bank_accounts b
    where b.tenant_id = p_tenant_id
      and not exists (select 1 from jsonb_array_elements(v_bank_rows) x where (x ->> 'id')::uuid = b.id);

    -- Erst das bisherige primäre Konto freigeben, sonst stößt der Wechsel an die Eindeutigkeit
    update public.bank_accounts b set is_primary = false
    where b.tenant_id = p_tenant_id and b.is_primary
      and not exists (
        select 1 from jsonb_array_elements(v_bank_rows) x where (x ->> 'id')::uuid = b.id and (x ->> 'is_primary')::boolean
      );

    -- Bestehende Konten ändern; der Zeitpunkt des Archivierens bleibt erhalten
    update public.bank_accounts b set
      label = r.label,
      account_holder = r.account_holder,
      iban = r.iban,
      bic = r.bic,
      bank_name = r.bank_name,
      note = r.note,
      is_primary = r.is_primary,
      archived_at = case when r.archived then coalesce(b.archived_at, now()) end
    from jsonb_to_recordset(v_bank_rows) as r(
      id uuid, label text, account_holder text, iban text, bic text, bank_name text, note text, is_primary boolean, archived boolean
    )
    where b.id = r.id and b.tenant_id = p_tenant_id
      and (b.label, b.account_holder, b.iban, b.bic, b.bank_name, b.note, b.is_primary, b.archived_at is not null)
        is distinct from (r.label, r.account_holder, r.iban, r.bic, r.bank_name, r.note, r.is_primary, r.archived);

    -- Neue Konten hinten anfügen (Reihenfolge des Anlegens)
    select coalesce(max(position), -1) into v_max_position from public.bank_accounts where tenant_id = p_tenant_id;
    insert into public.bank_accounts (id, tenant_id, label, account_holder, iban, bic, bank_name, note, is_primary, archived_at, position)
    select r.id, p_tenant_id, r.label, r.account_holder, r.iban, r.bic, r.bank_name, r.note, r.is_primary,
           case when r.archived then now() end,
           v_max_position + row_number() over (order by r.ord)
    from jsonb_to_recordset(v_bank_rows) as r(
      id uuid, label text, account_holder text, iban text, bic text, bank_name text, note text, is_primary boolean, archived boolean, ord integer
    )
    where not exists (select 1 from public.bank_accounts b where b.id = r.id);

    -- Wohnungen archivierter Konten (auch archivierte Wohnungen) auf „Primäres Konto“ zurückstellen
    update public.apartments a set bank_account_id = null
    where a.tenant_id = p_tenant_id
      and a.bank_account_id in (select b.id from public.bank_accounts b where b.tenant_id = p_tenant_id and b.archived_at is not null);
  end if;

  insert into public.operator_log (tenant_id, tenant_name, action, actor_id, actor_name, changed_fields)
  select p_tenant_id, v_new.name, 'master_data', (select auth.uid()), coalesce(p.display_name, p.email), v_changed
  from (select 1) one
  left join public.profiles p on p.id = (select auth.uid());

  -- Ersetztes bzw. entferntes Logo: der Server löscht die Datei
  return jsonb_build_object(
    'unused_logo', case when v_old.logo_path is distinct from v_new.logo_path then v_old.logo_path end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte der Funktionen
-- ---------------------------------------------------------------------------
revoke execute on function private.protect_guest_sheet() from public, anon, authenticated;
revoke execute on function private.note_guest_sheet_departure() from public, anon, authenticated;
revoke execute on function private.guest_sheet_file_tenant(text) from public, anon;
revoke execute on function private.guest_sheet_expected(public.bookings) from public, anon, authenticated;
revoke execute on function private.guest_sheet_complete(uuid) from public, anon, authenticated;
revoke execute on function private.guest_sheet_companions(uuid) from public, anon;
revoke execute on function private.note_marketing_consent(uuid, timestamptz, uuid) from public, anon, authenticated;
revoke execute on function private.rich_doc_text(jsonb) from public, anon, authenticated;
revoke execute on function private.check_guest_sheet_text(jsonb) from public, anon, authenticated;
revoke execute on function private.save_guest_sheet_texts(uuid, timestamptz, jsonb, jsonb) from public, anon;
revoke execute on function public.save_guest_sheet_texts(uuid, timestamptz, jsonb, jsonb) from public, anon;
revoke execute on function private.save_guest_sheet_field(uuid, text, jsonb, timestamptz) from public, anon;
revoke execute on function public.save_guest_sheet_field(uuid, text, jsonb, timestamptz) from public, anon;
revoke execute on function private.register_guest_sheet_upload(jsonb) from public, anon;
revoke execute on function public.register_guest_sheet_upload(jsonb) from public, anon;
revoke execute on function public.finish_guest_sheet(jsonb) from public, anon, authenticated;
revoke execute on function public.unused_guest_sheet_files(integer) from public, anon, authenticated;

-- Speicherregel und Lesesicht laufen mit den Rechten der Person
grant execute on function private.guest_sheet_file_tenant(text) to authenticated, service_role;
grant execute on function private.guest_sheet_companions(uuid) to authenticated, service_role;
grant execute on function private.save_guest_sheet_texts(uuid, timestamptz, jsonb, jsonb) to authenticated;
grant execute on function public.save_guest_sheet_texts(uuid, timestamptz, jsonb, jsonb) to authenticated;
grant execute on function private.save_guest_sheet_field(uuid, text, jsonb, timestamptz) to authenticated;
grant execute on function public.save_guest_sheet_field(uuid, text, jsonb, timestamptz) to authenticated;
grant execute on function private.register_guest_sheet_upload(jsonb) to authenticated;
grant execute on function public.register_guest_sheet_upload(jsonb) to authenticated;
grant execute on function public.finish_guest_sheet(jsonb) to service_role;
grant execute on function public.unused_guest_sheet_files(integer) to service_role;
