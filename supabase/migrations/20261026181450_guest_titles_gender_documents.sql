-- PROJ-29: Gast-Erweiterung – Titel, Geschlecht, Reisedokument mit Ausweisbildern.
--
-- * Gäste: Titel vor/nach dem Namen, Geschlecht (Standard „keine Angabe“), höchstens ein Reisedokument
--   (Art, Nummer, Ausstellungsdatum, Behörde, Staat) mit Bildern der Vorder- und Rückseite.
-- * Ausweisbilder liegen im privaten Speicherbereich „guest-documents“ unter <Kunde>/<zufällig>.jpg (nur JPEG,
--   höchstens 2 MB). Am Gast steht nur der Speicherort. Ein Bild hängt höchstens an einem Gast.
-- * Lesen dürfen Mitglieder (und der Betreiber-Admin mit 2FA) nur Bilder, die an einem Gast ihres Kunden hängen,
--   dazu den eigenen frischen Upload (Vorschau vor dem Speichern). Hochladen: Mitglieder in den eigenen Ordner.
--   Ändern und Löschen im Speicher nur der Server (geheimer Schlüssel).
-- * Bilder löschen die Server-Aktionen nach gelungener Änderung; eine tägliche Bereinigung entfernt Dateien,
--   die älter als 24 Stunden sind und an keinem Gast hängen.
-- * Bestehende Zugriffsregeln für Gäste bleiben unverändert; Mitarbeiter ändern bestehende Gäste weiterhin nicht.

-- ---------------------------------------------------------------------------
-- Gäste: neue Spalten und Prüfregeln
-- ---------------------------------------------------------------------------
alter table public.guests
  add column title_prefix text
    check (title_prefix is null or (title_prefix = btrim(title_prefix) and length(title_prefix) between 1 and 50)),
  add column title_suffix text
    check (title_suffix is null or (title_suffix = btrim(title_suffix) and length(title_suffix) between 1 and 50)),
  add column gender text not null default 'unspecified'
    check (gender in ('male', 'female', 'diverse', 'inter', 'open', 'unspecified')),
  add column document_type text
    check (document_type is null or document_type in ('passport', 'id_card', 'driving_licence')),
  add column document_number text
    check (document_number is null or (document_number = btrim(document_number) and length(document_number) between 1 and 30)),
  add column document_issued_on date
    check (document_issued_on is null or document_issued_on >= date '1900-01-01'),
  add column document_authority text
    check (document_authority is null or (document_authority = btrim(document_authority) and length(document_authority) between 1 and 100)),
  add column document_country text
    check (document_country is null or document_country ~ '^[A-Z]{2}$'),
  -- Speicherort im Ordner des eigenen Kunden
  add column document_front_path text
    check (document_front_path is null or document_front_path ~ ('^' || tenant_id::text || '/[0-9a-f-]{36}\.jpg$')),
  add column document_back_path text
    check (document_back_path is null or document_back_path ~ ('^' || tenant_id::text || '/[0-9a-f-]{36}\.jpg$')),
  -- Sobald etwas vom Dokument erfasst ist, sind Art und Nummer Pflicht
  add constraint guests_document_complete check (
    (document_type is not null and document_number is not null)
    or num_nonnulls(document_type, document_number, document_issued_on, document_authority, document_country,
      document_front_path, document_back_path) = 0
  ),
  add constraint guests_document_sides_distinct check (document_front_path is distinct from document_back_path or document_front_path is null),
  -- Anonymisierte Gäste haben weder Titel noch Dokument
  add constraint guests_anonymized_no_document check (
    anonymized_at is null
    or (gender = 'unspecified' and num_nonnulls(title_prefix, title_suffix, document_type, document_number,
      document_issued_on, document_authority, document_country, document_front_path, document_back_path) = 0)
  );

-- Ein Bild gehört höchstens einem Gast (Kreuzprüfung Vorder-/Rückseite im Trigger unten)
create unique index guests_document_front_path_key on public.guests (document_front_path) where document_front_path is not null;
create unique index guests_document_back_path_key on public.guests (document_back_path) where document_back_path is not null;

grant insert (
  title_prefix, title_suffix, gender, document_type, document_number, document_issued_on, document_authority,
  document_country, document_front_path, document_back_path
) on public.guests to authenticated;
grant update (
  title_prefix, title_suffix, gender, document_type, document_number, document_issued_on, document_authority,
  document_country, document_front_path, document_back_path
) on public.guests to authenticated;

-- ---------------------------------------------------------------------------
-- Speicherbereich für Ausweisbilder
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guest-documents', 'guest-documents', false, 2097152, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];

-- Kunde eines Speicherorts <Kunde>/<zufällig>.jpg (null bei jedem anderen Format)
create function private.document_tenant(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
    then split_part(p_name, '/', 1)::uuid end;
$$;

-- Hängt das Bild an einem Gast? (beide Bildplätze)
create function private.document_in_use(p_name text, p_except uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.guests g
    where (g.document_front_path = p_name or g.document_back_path = p_name)
      and g.id is distinct from p_except
  );
$$;

-- Darf die angemeldete Person das Bild lesen? Mitglied des Kunden (oder Admin mit 2FA) und das Bild hängt an
-- einem Gast dieses Kunden; den eigenen frischen Upload darf das Mitglied zur Vorschau lesen.
create function private.can_read_document(p_name text, p_owner text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.document_tenant(p_name) is not null
    and (private.is_member(private.document_tenant(p_name)) or private.is_admin())
    and (
      exists (
        select 1 from public.guests g
        where g.tenant_id = private.document_tenant(p_name)
          and (g.document_front_path = p_name or g.document_back_path = p_name)
      )
      or (p_owner is not null and p_owner = (select auth.uid())::text and private.is_member(private.document_tenant(p_name)))
    );
$$;

create policy "Mitglieder laden Ausweisbilder in den eigenen Ordner"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'guest-documents'
    and private.document_tenant(name) is not null
    and private.is_member(private.document_tenant(name))
  );
create policy "Mitglieder und Admin lesen verwendete Ausweisbilder"
  on storage.objects for select to authenticated
  using (bucket_id = 'guest-documents' and private.can_read_document(name, owner_id));
-- Kein Ändern oder Löschen durch Nutzer: dafür gibt es keine Regel (nur der Server mit geheimem Schlüssel)

-- ---------------------------------------------------------------------------
-- Gäste: Prüfungen beim Schreiben (bisheriger Trigger, ergänzt um PROJ-29)
-- ---------------------------------------------------------------------------
create or replace function private.guests_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  if new.birth_date is not null and new.birth_date > (now() at time zone 'Europe/Vienna')::date then
    raise exception 'Das Geburtsdatum darf nicht in der Zukunft liegen.' using errcode = '23514';
  end if;
  -- PROJ-29: Ausstellungsdatum nicht in der Zukunft
  if new.document_issued_on is not null and new.document_issued_on > (now() at time zone 'Europe/Vienna')::date then
    raise exception 'Das Ausstellungsdatum darf nicht in der Zukunft liegen.' using errcode = '23514';
  end if;
  -- PROJ-29: Neu eingetragene Bilder müssen im Speicher liegen und dürfen an keinem anderen Gast hängen
  foreach v_path in array array[new.document_front_path, new.document_back_path] loop
    continue when v_path is null;
    continue when tg_op = 'UPDATE' and v_path in (coalesce(old.document_front_path, ''), coalesce(old.document_back_path, ''));
    if not exists (select 1 from storage.objects o where o.bucket_id = 'guest-documents' and o.name = v_path) then
      raise exception 'Das Ausweisbild wurde nicht gefunden.' using errcode = 'P0705';
    end if;
    if private.document_in_use(v_path, new.id) then
      raise exception 'Das Ausweisbild gehört bereits zu einem anderen Gast.' using errcode = 'P0705';
    end if;
  end loop;

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

-- ---------------------------------------------------------------------------
-- Buchung mit neuem Gast: neue Spalten übernehmen
-- ---------------------------------------------------------------------------
create or replace function private.save_booking(p_input jsonb, p_confirm boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (p_input ->> 'tenant_id')::uuid;
  v_id uuid := nullif(p_input ->> 'id', '')::uuid;
  v_apartment_id uuid := nullif(p_input ->> 'apartment_id', '')::uuid;
  v_arrival date := (p_input ->> 'arrival')::date;
  v_departure date := (p_input ->> 'departure')::date;
  v_adults integer := (p_input ->> 'adults')::integer;
  v_child_ages integer[] := coalesce(
    array(select jsonb_array_elements_text(coalesce(p_input -> 'child_ages', '[]'::jsonb))::integer), '{}');
  v_guest_id uuid := nullif(p_input ->> 'guest_id', '')::uuid;
  v_new_guest jsonb := case when jsonb_typeof(p_input -> 'new_guest') = 'object' then p_input -> 'new_guest' end;
  v_amounts jsonb := p_input -> 'amounts';
  v_owner boolean;
  v_old public.bookings;
  v_apartment public.apartments;
  v_guest public.guests;
  v_kind text;
  v_option_until date;
  v_warnings jsonb;
  v_override boolean;
  v_seq integer;
  v_companions integer;
  v_changed boolean;
  v_suggested integer;
begin
  if v_tenant is null or not private.is_member(v_tenant) then
    raise exception 'Keine Berechtigung.' using errcode = 'P0801';
  end if;
  v_owner := private.has_role(v_tenant, 'owner');

  if v_id is not null then
    -- Sperr-Reihenfolge wie confirm_option: erst bisherige und neue Wohnung, dann die Buchung
    perform private.lock_apartments(array[
      (select b.apartment_id from public.bookings b where b.id = v_id and b.tenant_id = v_tenant),
      v_apartment_id
    ]);
    select * into v_old from public.bookings where id = v_id and tenant_id = v_tenant for update;
    if v_old.id is null or v_old.kind = 'block' then
      raise exception 'Buchung nicht gefunden.' using errcode = 'P0802';
    end if;
    if v_old.cancelled_at is not null or (v_old.kind = 'option' and v_old.option_until < private.today_vienna()) then
      raise exception 'Die Buchung ist nicht mehr aktiv.' using errcode = 'P0805';
    end if;
    if v_old.updated_at is distinct from (p_input ->> 'updated_at')::timestamptz then
      raise exception 'Die Buchung wurde inzwischen geändert.' using errcode = 'P0803';
    end if;
    v_kind := v_old.kind;
  else
    v_kind := p_input ->> 'kind';
    if v_kind is null or v_kind not in ('booking', 'option') then
      raise exception 'Ungültige Art.' using errcode = 'P0807';
    end if;
    perform private.lock_apartment(v_apartment_id);
  end if;
  v_option_until := case when v_kind = 'option' then (p_input ->> 'option_until')::date end;
  if v_kind = 'option' and (v_option_until is null or v_option_until > private.booking_max_date()
      or (v_option_until < private.today_vienna()
        and (v_old.id is null or v_option_until is distinct from v_old.option_until))) then
    raise exception 'Ungültiges Ablaufdatum.' using errcode = 'P0807';
  end if;

  select * into v_apartment from public.apartments where id = v_apartment_id and tenant_id = v_tenant;
  if v_apartment.id is null then
    raise exception 'Wohnung nicht gefunden.' using errcode = 'P0802';
  end if;
  if v_apartment.archived_at is not null and v_apartment.id is distinct from v_old.apartment_id then
    raise exception 'Die Wohnung ist archiviert.' using errcode = 'P0806';
  end if;

  -- Gast: bestehend (nicht anonymisiert, außer er bleibt unverändert) oder neu
  if v_new_guest is null then
    select * into v_guest from public.guests where id = v_guest_id and tenant_id = v_tenant;
    if v_guest.id is null then
      raise exception 'Gast nicht gefunden.' using errcode = 'P0802';
    end if;
    if v_guest.anonymized_at is not null and v_guest.id is distinct from v_old.guest_id then
      raise exception 'Der Gast ist anonymisiert.' using errcode = 'P0804';
    end if;
  end if;

  if v_adults is null or v_departure is null or v_arrival is null or v_arrival > private.booking_max_date() then
    raise exception 'Ungültige Eingabe.' using errcode = 'P0807';
  end if;

  -- Personenzahl nicht unter Hauptgast + bereits erfasste Mitreisende
  if v_old.id is not null then
    select count(*) into v_companions from public.booking_companions where booking_id = v_id;
    if v_companions > v_adults + cardinality(v_child_ages) - 1 then
      raise exception 'Zuerst Mitreisende entfernen.' using errcode = 'P0808';
    end if;
  end if;

  -- Warnungen: Inhaber dürfen bewusst übersteuern, sonst wird nichts gespeichert
  v_warnings := private.booking_warnings_for(v_tenant, v_apartment.id, v_arrival, v_departure,
    v_adults + cardinality(v_child_ages), v_adults, v_id);
  v_override := private.has_warnings(v_warnings);
  if v_override and not (v_owner and coalesce(p_confirm, false)) then
    return jsonb_build_object('status', 'warnings', 'warnings', v_warnings);
  end if;

  -- Neuer Gast entsteht im selben Vorgang (auch für Mitarbeiter, Entscheidung PROJ-7)
  if v_new_guest is not null then
    insert into public.guests (
      tenant_id, last_name, first_name, country, email, phone, language, birth_date, street, postal_code, city,
      address_country, marketing_source, marketing_custom, company_name, company_vat_id, company_billing_address, note,
      title_prefix, title_suffix, gender, document_type, document_number, document_issued_on, document_authority,
      document_country, document_front_path, document_back_path
    ) values (
      v_tenant, v_new_guest ->> 'last_name', v_new_guest ->> 'first_name', v_new_guest ->> 'country',
      v_new_guest ->> 'email', v_new_guest ->> 'phone', v_new_guest ->> 'language',
      (v_new_guest ->> 'birth_date')::date, v_new_guest ->> 'street', v_new_guest ->> 'postal_code',
      v_new_guest ->> 'city', v_new_guest ->> 'address_country', v_new_guest ->> 'marketing_source',
      v_new_guest ->> 'marketing_custom', v_new_guest ->> 'company_name', v_new_guest ->> 'company_vat_id',
      v_new_guest ->> 'company_billing_address', v_new_guest ->> 'note',
      -- PROJ-29: Titel, Geschlecht und Reisedokument (Prüfregeln und Bild-Prüfung übernimmt die Tabelle)
      v_new_guest ->> 'title_prefix', v_new_guest ->> 'title_suffix',
      coalesce(v_new_guest ->> 'gender', 'unspecified'), v_new_guest ->> 'document_type',
      v_new_guest ->> 'document_number', (v_new_guest ->> 'document_issued_on')::date,
      v_new_guest ->> 'document_authority', v_new_guest ->> 'document_country',
      v_new_guest ->> 'document_front_path', v_new_guest ->> 'document_back_path'
    ) returning id into v_guest_id;
  end if;

  if v_old.id is null then
    insert into public.booking_numbers as n (tenant_id, year, last_seq)
    values (v_tenant, extract(year from v_arrival)::integer, 1)
    on conflict (tenant_id, year) do update set last_seq = n.last_seq + 1
    returning last_seq into v_seq;

    insert into public.bookings (
      tenant_id, apartment_id, kind, number_year, number_seq, arrival, departure, check_in, check_out, guest_id,
      adults, child_ages, option_until, note, override_at, override_by, price_review
    ) values (
      v_tenant, v_apartment.id, v_kind, extract(year from v_arrival)::integer, v_seq, v_arrival, v_departure,
      -- ohne Angabe die Zeiten der Wohnung
      coalesce((p_input ->> 'check_in')::time, v_apartment.check_in),
      coalesce((p_input ->> 'check_out')::time, v_apartment.check_out),
      v_guest_id, v_adults, v_child_ages, v_option_until, nullif(btrim(p_input ->> 'note'), ''),
      case when v_override then now() end, case when v_override then auth.uid() end,
      -- Mitarbeiter-Buchung ohne Preis der Wohnung: Inhaber soll den Preis setzen
      not v_owner and private.suggested_nights_cents(v_apartment, v_adults, v_child_ages, v_departure - v_arrival) is null
    ) returning id into v_id;

    if v_owner then
      insert into public.booking_amounts (id, tenant_id, nights_cents)
      values (v_id, v_tenant, (v_amounts ->> 'nights_cents')::integer);
      insert into public.booking_charges (tenant_id, booking_id, position, label, amount_cents)
      select v_tenant, v_id, c.ord, btrim(c.value ->> 'label'), (c.value ->> 'amount_cents')::integer
      from jsonb_array_elements(coalesce(v_amounts -> 'charges', '[]'::jsonb)) with ordinality as c(value, ord);
    else
      -- Preisvorschlag für Mitarbeiter je nach Preisart der Wohnung (PROJ-27) und Reinigungsgebühr
      v_suggested := private.suggested_nights_cents(v_apartment, v_adults, v_child_ages, v_departure - v_arrival);
      insert into public.booking_amounts (id, tenant_id, nights_cents)
      values (v_id, v_tenant, coalesce(v_suggested, 0));
      if v_apartment.cleaning_fee_cents is not null then
        insert into public.booking_charges (tenant_id, booking_id, position, label, amount_cents)
        values (v_tenant, v_id, 1, 'Reinigung', v_apartment.cleaning_fee_cents);
      end if;
    end if;
  else
    -- „Preis prüfen“: Zeitraum oder Wohnung geändert, bei Personenpreisen auch Erwachsene oder Kinderalter (PROJ-27)
    v_changed := v_old.arrival <> v_arrival or v_old.departure <> v_departure or v_old.apartment_id <> v_apartment.id
      or (v_apartment.price_mode = 'person'
        and (v_old.adults is distinct from v_adults or v_old.child_ages is distinct from v_child_ages));
    update public.bookings set
      apartment_id = v_apartment.id,
      arrival = v_arrival,
      departure = v_departure,
      -- Zeiten sind optional: null = keine Zeit (BUG-2)
      check_in = (p_input ->> 'check_in')::time,
      check_out = (p_input ->> 'check_out')::time,
      guest_id = v_guest_id,
      adults = v_adults,
      child_ages = v_child_ages,
      option_until = v_option_until,
      note = nullif(btrim(p_input ->> 'note'), ''),
      override_at = case when v_override then now() end,
      override_by = case when v_override then auth.uid() end,
      price_review = case when v_owner then false when v_changed then true else price_review end
    where id = v_id;

    -- Beträge setzen nur Inhaber; Änderungen von Mitarbeitern lassen den Preis unverändert
    if v_owner then
      insert into public.booking_amounts as a (id, tenant_id, nights_cents)
      values (v_id, v_tenant, (v_amounts ->> 'nights_cents')::integer)
      on conflict (id) do update set nights_cents = excluded.nights_cents;
      delete from public.booking_charges where booking_id = v_id;
      insert into public.booking_charges (tenant_id, booking_id, position, label, amount_cents)
      select v_tenant, v_id, c.ord, btrim(c.value ->> 'label'), (c.value ->> 'amount_cents')::integer
      from jsonb_array_elements(coalesce(v_amounts -> 'charges', '[]'::jsonb)) with ordinality as c(value, ord);
    end if;
  end if;

  return jsonb_build_object('status', 'saved', 'id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Zusammenführen: Titel, Geschlecht und Reisedokument (als Ganzes) wählbar
-- ---------------------------------------------------------------------------
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
    company_name = case when b_company then v_remove.company_name else v_keep.company_name end,
    company_vat_id = case when b_company then v_remove.company_vat_id else v_keep.company_vat_id end,
    company_billing_address = case when b_company then v_remove.company_billing_address else v_keep.company_billing_address end,
    note = case when b_note then v_remove.note else v_keep.note end,
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

-- ---------------------------------------------------------------------------
-- Anonymisieren: neue Angaben leeren
-- ---------------------------------------------------------------------------
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
    company_name = null,
    company_vat_id = null,
    company_billing_address = null,
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

-- ---------------------------------------------------------------------------
-- Gästeliste: Titel für die Namensanzeige (neuer Rückgabetyp → neu anlegen)
-- ---------------------------------------------------------------------------
drop function public.guest_list(uuid, text, text, text, text, integer, integer);

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
  title_prefix text,
  title_suffix text,
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
    select g.*, s.stay_count, s.last_stay
    from public.guests g
    cross join needle n
    left join lateral (
      select
        count(*)::integer as stay_count,
        max(b.arrival) filter (where b.arrival <= private.today_vienna()) as last_stay
      from public.bookings b
      where b.guest_id = g.id and b.tenant_id = g.tenant_id and b.kind = 'booking' and b.cancelled_at is null
    ) s on true
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
  select m.id, m.last_name, m.first_name, m.title_prefix, m.title_suffix, m.company_name, m.country, m.anonymized_at, m.stay_count, m.last_stay,
    count(*) over () as total
  from matches m
  order by
    case when p_sort = 'lastStay' then m.last_stay end desc nulls last,
    lower(m.last_name), lower(coalesce(m.first_name, '')), m.id
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

revoke execute on function public.guest_list(uuid, text, text, text, text, integer, integer) from public, anon;
grant execute on function public.guest_list(uuid, text, text, text, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Tägliche Bereinigung: Ausweisbilder, die älter als 24 Stunden sind und an keinem Gast hängen
-- (Upload ohne Speichern, abgebrochenes Löschen, Reste gelöschter Kunden). Nur für den Server.
-- ---------------------------------------------------------------------------
create function public.unused_guest_documents(p_limit integer default 1000)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'guest-documents'
    and o.created_at < now() - interval '24 hours'
    and not private.document_in_use(o.name)
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

revoke execute on function private.document_tenant(text) from public, anon;
revoke execute on function private.document_in_use(text, uuid) from public, anon, authenticated;
revoke execute on function private.can_read_document(text, text) from public, anon;
revoke execute on function public.unused_guest_documents(integer) from public, anon, authenticated;
grant execute on function private.document_tenant(text) to authenticated, service_role;
grant execute on function private.document_in_use(text, uuid) to service_role;
grant execute on function private.can_read_document(text, text) to authenticated, service_role;
grant execute on function public.unused_guest_documents(integer) to service_role;
