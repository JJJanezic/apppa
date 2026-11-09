-- PROJ-26 Erweiterung, Korrekturen aus der QA (2026-11-09):
-- * BUG-6: Der Schalter „Gästeblätter nacherfassen“ liegt in einer eigenen Tabelle guest_sheet_options statt am Kunden.
--   Umschalten ändert damit nicht mehr den Stand der Stammdaten (Formular auf der Kundenseite des Betreibers blieb sonst
--   nicht erhalten). Bestehende Werte werden übernommen, die Spalte tenants.guest_sheet_backfill_enabled entfällt.
-- * BUG-7: save_booking übernimmt eine Gästeblattnummer nur bei eingeschaltetem Schalter (auch bei direkten Aufrufen).
-- Sonst unverändert gegenüber 20261109110308_guest_sheet_numbering.sql.

create table public.guest_sheet_options (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  backfill_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
comment on table public.guest_sheet_options is
  'Einstellungen → Gästeblatt (PROJ-26): Schalter „Gästeblätter nacherfassen“ (Feld „Gästeblattnummer“ im Buchungsformular, Hochladen).';

insert into public.guest_sheet_options (tenant_id, backfill_enabled)
select t.id, true from public.tenants t where t.guest_sheet_backfill_enabled;

revoke all on public.guest_sheet_options from anon, authenticated;
grant select on public.guest_sheet_options to authenticated;
alter table public.guest_sheet_options enable row level security;
create policy "Mitglieder und Admin lesen Gästeblatt-Optionen" on public.guest_sheet_options for select to authenticated
  using (private.is_member(tenant_id) or (select private.is_admin()));
select private.enable_tenant_table('public.guest_sheet_options');

create or replace function private.save_guest_sheet_backfill(p_tenant_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_guest_sheet_numbering_editor(p_tenant_id);
  if p_enabled is null then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;
  insert into public.guest_sheet_options (tenant_id, backfill_enabled) values (p_tenant_id, p_enabled)
  on conflict (tenant_id) do update set backfill_enabled = excluded.backfill_enabled
  where public.guest_sheet_options.backfill_enabled is distinct from excluded.backfill_enabled;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hochladen: Schalter aus guest_sheet_options
-- ---------------------------------------------------------------------------
create or replace function private.register_guest_sheet_upload(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_guest public.guests;
  v_path text := p_input ->> 'pdf_path';
  v_number text;
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
  -- PROJ-26 (2026-11-09): nur mit „Gästeblätter nacherfassen“; die Lfd.-Nr. kommt aus der Buchung
  if not exists (select 1 from public.guest_sheet_options o where o.tenant_id = v_booking.tenant_id and o.backfill_enabled) then
    raise exception 'Hochladen ist nur mit „Gästeblätter nacherfassen“ möglich.' using errcode = 'P0987';
  end if;
  v_number := v_booking.guest_sheet_number;
  if (v_signed_on is not null and (v_signed_on > private.today_vienna() or v_signed_on < date '1900-01-01')) then
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
  if v_consent then
    perform private.note_marketing_consent(v_guest.id, coalesce(v_signed_on::timestamp at time zone 'Europe/Vienna', now()), v_id);
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Buchung speichern: Gästeblattnummer nur mit Schalter (BUG-7)
-- ---------------------------------------------------------------------------
create or replace function private.save_booking(p_input jsonb, p_confirm boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tenant uuid := (p_input ->> 'tenant_id')::uuid;
  v_id uuid := nullif(p_input ->> 'id', '')::uuid;
  v_apartment_id uuid := nullif(p_input ->> 'apartment_id', '')::uuid;
  v_arrival date := (p_input ->> 'arrival')::date;
  -- PROJ-30: departure = tatsächliche Abreise (Belegung), planned_departure = vereinbarte (Preis)
  v_departure date := (p_input ->> 'departure')::date;
  v_planned date := (p_input ->> 'planned_departure')::date;
  v_sheet text := nullif(btrim(p_input ->> 'guest_sheet_number'), '');
  -- PROJ-26 (2026-11-09): ohne Schlüssel bleibt die Nummer unverändert (Schalter „Gästeblätter nacherfassen“ aus)
  -- QA BUG-7: nur mit „Gästeblätter nacherfassen“; sonst gilt eine mitgeschickte Nummer als nicht mitgeschickt
  v_sheet_given boolean := p_input ? 'guest_sheet_number' and coalesce((
    select o.backfill_enabled from public.guest_sheet_options o where o.tenant_id = (p_input ->> 'tenant_id')::uuid), false);
  v_source text := coalesce(p_input ->> 'source', 'none');
  v_source_custom text := case when coalesce(p_input ->> 'source', 'none') = 'custom' then nullif(btrim(p_input ->> 'source_custom'), '') end;
  -- PROJ-47: Plattform-Nummer nur bei booking.com/Airbnb, alle Leerzeichen entfernt; sonst gelöscht
  v_platform text := case when coalesce(p_input ->> 'source', 'none') in ('booking_com', 'airbnb')
    then nullif(regexp_replace(coalesce(p_input ->> 'platform_number', ''), '\s', '', 'g'), '') end;
  v_residence boolean := coalesce((p_input ->> 'residence_registered')::boolean, false);
  -- PROJ-15: Ortstaxe – Häkchen (alle Mitglieder), Zustand und Neuberechnung (nur Inhaber)
  v_main_exempt boolean := coalesce((p_input ->> 'main_guest_tourist_tax_exempt')::boolean, false);
  v_mode_in text := nullif(p_input ->> 'tourist_tax_mode', '');
  v_recalc boolean := coalesce((p_input ->> 'tourist_tax_recalculate')::boolean, false);
  v_mode text;
  v_basis jsonb;
  v_tax_rows jsonb;
  v_adults integer := (p_input ->> 'adults')::integer;
  v_child_ages integer[] := coalesce(
    array(select jsonb_array_elements_text(coalesce(p_input -> 'child_ages', '[]'::jsonb))::integer), '{}');
  v_guest_id uuid := nullif(p_input ->> 'guest_id', '')::uuid;
  v_new_guest jsonb := case when jsonb_typeof(p_input -> 'new_guest') = 'object' then p_input -> 'new_guest' end;
  -- Preisregel bei Verlängerung (PROJ-30, 2026-10-30): nur vom Inhaber; fehlt sie, gilt beim Anlegen „total“,
  -- beim Ändern bleibt die gespeicherte (ungültige Werte → 22023)
  v_pricing text := private.extension_pricing(p_input -> 'amounts' ->> 'nights_extension_pricing');
  v_amounts jsonb := p_input -> 'amounts';
  v_charges jsonb;
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
  v_duplicates jsonb;
begin
  if v_tenant is null or not private.is_member(v_tenant) then
    raise exception 'Keine Berechtigung.' using errcode = 'P0801';
  end if;
  v_owner := private.has_role(v_tenant, 'owner');
  if v_mode_in is not null and v_mode_in not in ('pending', 'auto', 'manual') then
    raise exception 'Ungültiger Ortstaxe-Zustand.' using errcode = '22023';
  end if;
  v_recalc := v_recalc and v_owner;
  if v_platform is not null and v_platform !~ '^[A-Za-z0-9-]{1,30}$' then
    raise exception 'Ungültige Plattform-Nummer.' using errcode = 'P0807';
  end if;

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
    -- Ortstaxe (PROJ-15): Berechnungsgrundlage und Abgabe-Positionen vor dem Speichern. Zustand nur vom Inhaber;
    -- zurück auf „noch nicht berechnet“ geht nicht; aus „noch nicht berechnet“ nach „automatisch“ nur mit Neuberechnung
    v_basis := private.tourist_tax_basis(v_id);
    v_tax_rows := private.tourist_tax_rows(v_id);
    v_mode := case
      when not v_owner or v_mode_in is null then v_old.tourist_tax_mode
      when v_mode_in = 'pending' then v_old.tourist_tax_mode
      else v_mode_in
    end;
    if v_old.tourist_tax_mode = 'pending' and v_mode = 'auto' then
      v_recalc := true;
    end if;
  else
    -- Neue Buchungen rechnen automatisch; „von Hand“ nur vom Inhaber
    v_mode := case when v_owner and v_mode_in = 'manual' then 'manual' else 'auto' end;
    v_kind := p_input ->> 'kind';
    if v_kind is null or v_kind not in ('booking', 'option') then
      raise exception 'Ungültige Art.' using errcode = 'P0807';
    end if;
    perform private.lock_apartment(v_apartment_id);
  end if;
  if not v_sheet_given then
    v_sheet := v_old.guest_sheet_number;
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

  if v_adults is null or v_departure is null or v_planned is null or v_arrival is null or v_arrival > private.booking_max_date() then
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
  -- PROJ-30: doppelte Gästeblattnummer ist eine eigene Warnung, die alle Mitglieder bestätigen dürfen
  -- PROJ-26 (2026-11-09): nur in derselben Gemeinde und nur bei eingegebener Nummer
  v_duplicates := case when v_sheet_given then private.guest_sheet_duplicates(v_tenant, v_sheet, v_id, v_apartment.id) else '[]'::jsonb end;
  if (v_override and not (v_owner and coalesce(p_confirm, false)))
      or (jsonb_array_length(v_duplicates) > 0 and not coalesce((p_input ->> 'confirm_guest_sheet_number')::boolean, false)) then
    return jsonb_build_object('status', 'warnings', 'warnings', v_warnings || jsonb_build_object('guest_sheet_duplicates', v_duplicates));
  end if;

  -- Neuer Gast entsteht im selben Vorgang (auch für Mitarbeiter, Entscheidung PROJ-7)
  if v_new_guest is not null then
    insert into public.guests (
      tenant_id, last_name, first_name, country, email, phone, language, birth_date, street, postal_code, city,
      address_country, marketing_source, marketing_custom, company_id, note,
      title_prefix, title_suffix, gender, document_type, document_number, document_issued_on, document_authority,
      document_country, document_front_path, document_back_path
    ) values (
      v_tenant, v_new_guest ->> 'last_name', v_new_guest ->> 'first_name', v_new_guest ->> 'country',
      v_new_guest ->> 'email', v_new_guest ->> 'phone', v_new_guest ->> 'language',
      (v_new_guest ->> 'birth_date')::date, v_new_guest ->> 'street', v_new_guest ->> 'postal_code',
      v_new_guest ->> 'city', v_new_guest ->> 'address_country', v_new_guest ->> 'marketing_source',
      -- PROJ-50: bestehende Firma (company_id) oder neue Firma (new_company) im selben Vorgang
      v_new_guest ->> 'marketing_custom', private.guest_company_from_input(v_tenant, v_new_guest),
      v_new_guest ->> 'note',
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
      tenant_id, apartment_id, kind, number_year, number_seq, arrival, planned_departure, departure, check_in, check_out, guest_id,
      adults, child_ages, option_until, guest_sheet_number, residence_registered, source, source_custom,
      platform_number, note, override_at, override_by, price_review, tourist_tax_mode, main_guest_tourist_tax_exempt
    ) values (
      v_tenant, v_apartment.id, v_kind, extract(year from v_arrival)::integer, v_seq, v_arrival, v_planned, v_departure,
      -- ohne Angabe die Zeiten der Wohnung
      coalesce((p_input ->> 'check_in')::time, v_apartment.check_in),
      coalesce((p_input ->> 'check_out')::time, v_apartment.check_out),
      v_guest_id, v_adults, v_child_ages, v_option_until, v_sheet, v_residence, v_source, v_source_custom,
      v_platform, nullif(btrim(p_input ->> 'note'), ''),
      case when v_override then now() end, case when v_override then auth.uid() end,
      -- Mitarbeiter-Buchung ohne Preis der Wohnung: Inhaber soll den Preis setzen
      not v_owner and private.suggested_nights_cents(v_apartment, v_adults, v_child_ages, v_planned - v_arrival) is null,
      v_mode, v_main_exempt
    ) returning id into v_id;

    if v_owner then
      -- Umsatzsteuersätze Pflicht, als exakte Dezimalzahl geprüft (PROJ-35)
      insert into public.booking_amounts (id, tenant_id, nights_cents, nights_vat_rate, nights_extension_pricing)
      values (v_id, v_tenant, (v_amounts ->> 'nights_cents')::integer, private.vat_rate(v_amounts ->> 'nights_vat_rate'),
        coalesce(v_pricing, 'total'));
      insert into public.booking_charges (tenant_id, booking_id, position, label, amount_cents, vat_rate,
        tourist_tax, tourist_tax_rate_id, tax_person_nights)
      select v_tenant, v_id, c.ord, btrim(c.value ->> 'label'), (c.value ->> 'amount_cents')::integer, private.vat_rate(c.value ->> 'vat_rate'),
        t.tourist_tax, t.rate_id, t.person_nights
      from jsonb_array_elements(coalesce(v_amounts -> 'charges', '[]'::jsonb)) with ordinality as c(value, ord)
      cross join lateral private.tourist_tax_mark(v_tenant, c.value -> 'tourist_tax') t;
    else
      -- Preisvorschlag für Mitarbeiter je nach Preisart der Wohnung (PROJ-27) und Reinigungsgebühr
      -- Vorschlag für den geplanten Zeitraum (PROJ-30)
      v_suggested := private.suggested_nights_cents(v_apartment, v_adults, v_child_ages, v_planned - v_arrival);
      insert into public.booking_amounts (id, tenant_id, nights_cents)
      values (v_id, v_tenant, coalesce(v_suggested, 0));
      if v_apartment.cleaning_fee_cents is not null then
        -- Endreinigung 10 % (PROJ-35; Bezeichnung seit PROJ-8 refine 2026-11-05); die Übernachtung erhält den Standard 10 %
        insert into public.booking_charges (tenant_id, booking_id, position, label, amount_cents, vat_rate)
        values (v_tenant, v_id, 1, 'Endreinigung', v_apartment.cleaning_fee_cents, 10.00);
      end if;
    end if;
  else
    -- „Preis prüfen“: Anreise, geplante Abreise oder Wohnung geändert, bei Personenpreisen auch Erwachsene oder
    -- Kinderalter (PROJ-27). Die tatsächliche Abreise allein nicht: der Preis folgt der gespeicherten Preisregel (PROJ-30)
    v_changed := v_old.arrival <> v_arrival or v_old.planned_departure <> v_planned or v_old.apartment_id <> v_apartment.id
      or (v_apartment.price_mode = 'person'
        and (v_old.adults is distinct from v_adults or v_old.child_ages is distinct from v_child_ages));
    update public.bookings set
      apartment_id = v_apartment.id,
      arrival = v_arrival,
      planned_departure = v_planned,
      departure = v_departure,
      -- Zeiten sind optional: null = keine Zeit (BUG-2)
      check_in = (p_input ->> 'check_in')::time,
      check_out = (p_input ->> 'check_out')::time,
      guest_id = v_guest_id,
      adults = v_adults,
      child_ages = v_child_ages,
      option_until = v_option_until,
      guest_sheet_number = v_sheet,
      residence_registered = v_residence,
      main_guest_tourist_tax_exempt = v_main_exempt,
      tourist_tax_mode = v_mode,
      source = v_source,
      source_custom = v_source_custom,
      platform_number = v_platform,
      note = nullif(btrim(p_input ->> 'note'), ''),
      override_at = case when v_override then now() end,
      override_by = case when v_override then auth.uid() end,
      price_review = case when v_owner then false when v_changed then true else price_review end
    where id = v_id;

    -- Beträge setzen nur Inhaber; Änderungen von Mitarbeitern lassen den Preis unverändert
    if v_owner then
      insert into public.booking_amounts as a (id, tenant_id, nights_cents, nights_vat_rate, nights_extension_pricing)
      values (v_id, v_tenant, (v_amounts ->> 'nights_cents')::integer, private.vat_rate(v_amounts ->> 'nights_vat_rate'),
        coalesce(v_pricing, 'total'))
      on conflict (id) do update set
        nights_cents = excluded.nights_cents,
        nights_vat_rate = excluded.nights_vat_rate,
        nights_extension_pricing = coalesce(v_pricing, a.nights_extension_pricing);

      -- PROJ-40: Zusatzkosten abgleichen. Gültig ist eine Kennung nur, wenn sie zu dieser Buchung gehört und zum
      -- ersten Mal vorkommt; alle anderen Positionen entstehen neu.
      select coalesce(jsonb_agg(jsonb_build_object(
        'ord', x.ord,
        'value', x.value,
        'id', case when x.rn = 1 and exists (
          select 1 from public.booking_charges bc where bc.id = x.cid and bc.booking_id = v_id
        ) then x.cid end
      ) order by x.ord), '[]'::jsonb)
      into v_charges
      from (
        select c.ord, c.value, private.json_uuid(c.value ->> 'id') as cid,
          row_number() over (partition by private.json_uuid(c.value ->> 'id') order by c.ord) as rn
        from jsonb_array_elements(coalesce(v_amounts -> 'charges', '[]'::jsonb)) with ordinality as c(value, ord)
      ) x;

      delete from public.booking_charges bc
      where bc.booking_id = v_id
        and not exists (select 1 from jsonb_array_elements(v_charges) e where private.json_uuid(e ->> 'id') = bc.id);

      update public.booking_charges bc set
        position = (e ->> 'ord')::integer,
        label = btrim(e -> 'value' ->> 'label'),
        amount_cents = (e -> 'value' ->> 'amount_cents')::integer,
        vat_rate = private.vat_rate(e -> 'value' ->> 'vat_rate'),
        tourist_tax = t.tourist_tax,
        tourist_tax_rate_id = t.rate_id,
        tax_person_nights = t.person_nights
      from jsonb_array_elements(v_charges) e
      cross join lateral private.tourist_tax_mark(v_tenant, e -> 'value' -> 'tourist_tax') t
      where bc.booking_id = v_id and bc.id = private.json_uuid(e ->> 'id')
        and (bc.position, bc.label, bc.amount_cents, bc.vat_rate, bc.tourist_tax, bc.tourist_tax_rate_id, bc.tax_person_nights)
          is distinct from (
          (e ->> 'ord')::integer, btrim(e -> 'value' ->> 'label'), (e -> 'value' ->> 'amount_cents')::integer,
          private.vat_rate(e -> 'value' ->> 'vat_rate'), t.tourist_tax, t.rate_id, t.person_nights
        );

      insert into public.booking_charges (tenant_id, booking_id, position, label, amount_cents, vat_rate,
        tourist_tax, tourist_tax_rate_id, tax_person_nights)
      select v_tenant, v_id, (e ->> 'ord')::integer, btrim(e -> 'value' ->> 'label'), (e -> 'value' ->> 'amount_cents')::integer,
        private.vat_rate(e -> 'value' ->> 'vat_rate'), t.tourist_tax, t.rate_id, t.person_nights
      from jsonb_array_elements(v_charges) e
      cross join lateral private.tourist_tax_mark(v_tenant, e -> 'value' -> 'tourist_tax') t
      where private.json_uuid(e ->> 'id') is null;
    end if;
  end if;

  -- Abgerechneter Übernachtungspreis nach jedem Speichern, für Inhaber und Mitarbeiter (PROJ-30)
  perform private.refresh_billed_nights(v_id);

  -- Ortstaxe (PROJ-15). „Automatisch“: neu rechnen bei neuer Buchung, „Abgabe (neu) berechnen“, geänderter
  -- Berechnungsgrundlage oder veränderten Abgabe-Positionen (gesendete Beträge werden so nie übernommen).
  -- Tarifänderungen allein ziehen nicht nach. „Von Hand“: Mitarbeiter-Änderung der Grundlage → „Preis prüfen“.
  if v_mode = 'auto' and (v_old.id is null or v_recalc
      or private.tourist_tax_basis(v_id) is distinct from v_basis
      or private.tourist_tax_rows(v_id) is distinct from v_tax_rows) then
    perform private.apply_tourist_tax(v_id);
  elsif v_mode = 'manual' and v_old.id is not null and not v_owner and private.tourist_tax_basis(v_id) is distinct from v_basis then
    update public.bookings set price_review = true where id = v_id;
  end if;

  return jsonb_build_object('status', 'saved', 'id', v_id);
end;
$function$;

alter table public.tenants drop column guest_sheet_backfill_enabled;
