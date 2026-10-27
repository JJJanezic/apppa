-- PROJ-30: Buchungs-Erweiterung. Abreise geplant / tatsächlich, Gästeblattnummer, „Wohnsitz angemeldet“,
-- Buchungsquelle und abgerechneter Übernachtungspreis.
--
-- * bookings.departure bleibt die Belegung und bedeutet ab jetzt die tatsächliche Abreise; neu ist planned_departure
--   (vereinbart). Bestehende Einträge: beide gleich.
-- * booking_amounts.nights_cents = vereinbarter Preis für den geplanten Zeitraum; neu billed_nights_cents =
--   anteilig bis zur späteren der beiden Abreisen (gleiche Regel wie billedNightsCents in src/lib/bookings.ts).
-- * Doppelte Gästeblattnummer (Groß/Klein egal, auch storniert, nur eigenes Konto) ist eine Warnung, die Inhaber und
--   Mitarbeiter bestätigen dürfen. Überschneidungen übersteuern weiterhin nur Inhaber.

-- ---------------------------------------------------------------------------
-- Spalten und Regeln
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column planned_departure date,
  add column guest_sheet_number text
    constraint bookings_guest_sheet_number_check
    check (guest_sheet_number is null or (guest_sheet_number = btrim(guest_sheet_number) and length(guest_sheet_number) between 1 and 30)),
  add column residence_registered boolean not null default false,
  add column source text not null default 'none'
    constraint bookings_source_check
    check (source in ('website', 'instagram', 'google_ads', 'newsletter', 'referral', 'platform_search', 'booking_com', 'custom', 'none')),
  add column source_custom text
    constraint bookings_source_custom_check
    check (source_custom is null or (source_custom = btrim(source_custom) and length(source_custom) between 1 and 100));

-- Bestehende Einträge: geplante = bisherige Abreise (keine Änderung an Belegung oder Preis)
update public.bookings set planned_departure = departure;

alter table public.bookings
  alter column planned_departure set not null,
  add constraint bookings_planned_period_check check (planned_departure > arrival and planned_departure - arrival <= 365),
  add constraint bookings_source_custom_kind_check check ((source = 'custom') = (source_custom is not null)),
  -- Sperren: keine Meldedaten, keine Quelle, geplante = tatsächliche Abreise
  add constraint bookings_block_extension_check check (
    kind <> 'block' or (planned_departure = departure and source = 'none' and guest_sheet_number is null and not residence_registered)
  );

comment on column public.bookings.departure is 'Tatsächliche Abreise (PROJ-30); bestimmt die Belegung. Nicht mehr belegt (Wechseltag).';
comment on column public.bookings.planned_departure is 'Vereinbarte Abreise (PROJ-30); Grundlage des vereinbarten Preises.';
comment on column public.bookings.guest_sheet_number is 'Gästeblattnummer (PROJ-30), optional, nicht eindeutig (Doppelung nur Warnung).';
comment on column public.bookings.residence_registered is 'Wohnsitz angemeldet (PROJ-30): keine Ortstaxe (Berechnung PROJ-16).';
comment on column public.bookings.source is 'Buchungsquelle (PROJ-30), Angabe des Vermieters; unabhängig von channel und guests.marketing_source.';

-- Doppelungsprüfung und Suche je Kunde, Groß/Klein egal
create index bookings_guest_sheet_idx on public.bookings (tenant_id, lower(guest_sheet_number)) where guest_sheet_number is not null;

alter table public.booking_amounts add column billed_nights_cents integer;
update public.booking_amounts set billed_nights_cents = nights_cents;
alter table public.booking_amounts
  alter column billed_nights_cents set not null,
  add constraint booking_amounts_billed_check check (billed_nights_cents between 0 and 100000000);
comment on column public.booking_amounts.nights_cents is 'Vereinbarter Übernachtungspreis für den geplanten Zeitraum (PROJ-30).';
comment on column public.booking_amounts.billed_nights_cents is 'Abgerechneter Übernachtungspreis (PROJ-30): anteilig bis zur späteren Abreise; setzt save_booking.';

-- Ohne Angabe ist die geplante gleich der tatsächlichen Abreise; Sperren immer (auch bei direktem Schreiben, z. B. Import)
create function private.bookings_departure_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'block' or new.planned_departure is null then
    new.planned_departure := new.departure;
  end if;
  return new;
end;
$$;
revoke execute on function private.bookings_departure_defaults() from public, anon, authenticated;

create trigger bookings_departure_defaults before insert or update on public.bookings
  for each row execute function private.bookings_departure_defaults();

-- ---------------------------------------------------------------------------
-- Abgerechneter Preis
-- ---------------------------------------------------------------------------
-- Vereinbarter Preis anteilig auf die abzurechnenden Nächte, kaufmännisch auf Cent (round(numeric) wie Math.round)
create function private.billed_nights_cents(p_agreed integer, p_planned_nights integer, p_billable_nights integer)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_billed numeric;
begin
  if p_planned_nights < 1 or p_billable_nights <= p_planned_nights then
    return p_agreed;
  end if;
  v_billed := round(p_agreed::numeric * p_billable_nights / p_planned_nights);
  if v_billed > 100000000 then
    raise exception 'Der hochgerechnete Preis übersteigt den Höchstbetrag.' using errcode = 'P0809';
  end if;
  return v_billed::integer;
end;
$$;

create function private.refresh_billed_nights(p_booking_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.booking_amounts a
  set billed_nights_cents = private.billed_nights_cents(
    a.nights_cents, b.planned_departure - b.arrival, greatest(b.departure, b.planned_departure) - b.arrival)
  from public.bookings b
  where a.id = p_booking_id and b.id = a.id and b.tenant_id = a.tenant_id
    and a.billed_nights_cents is distinct from private.billed_nights_cents(
      a.nights_cents, b.planned_departure - b.arrival, greatest(b.departure, b.planned_departure) - b.arrival);
$$;

revoke execute on function private.billed_nights_cents(integer, integer, integer) from public, anon, authenticated;
revoke execute on function private.refresh_billed_nights(uuid) from public, anon, authenticated;

-- Neue Beträge (z. B. aus Tests oder späteren Importen) starten mit dem vereinbarten Preis
alter table public.booking_amounts alter column billed_nights_cents set default 0;
create function private.booking_amounts_billed_default()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.billed_nights_cents := new.nights_cents;
  end if;
  return new;
end;
$$;
revoke execute on function private.booking_amounts_billed_default() from public, anon, authenticated;
create trigger booking_amounts_billed_default before insert on public.booking_amounts
  for each row execute function private.booking_amounts_billed_default();

-- ---------------------------------------------------------------------------
-- Doppelte Gästeblattnummer
-- ---------------------------------------------------------------------------
-- Andere Buchungen/Optionen des Kunden mit derselben Nummer (auch storniert). Trägt die Buchung p_exclude die Nummer
-- schon, gibt es keine Warnung: sie wurde bereits beim ersten Speichern gezeigt und bestätigt.
create function private.guest_sheet_duplicates(p_tenant_id uuid, p_number text, p_exclude uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_key text := lower(nullif(btrim(p_number), ''));
begin
  if v_key is null or exists (
    select 1 from public.bookings e
    where e.id = p_exclude and e.tenant_id = p_tenant_id and lower(e.guest_sheet_number) = v_key
  ) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', b.id,
      'kind', b.kind,
      'number', b.number,
      -- Listen-Schreibweise wie in den Überschneidungs-Warnungen
      'guest_name', case when g.id is null then null else concat_ws(', ', g.last_name,
        nullif(concat_ws(' ', g.title_prefix, g.first_name), ''), g.title_suffix) end,
      'cancelled', b.cancelled_at is not null
    ) order by b.arrival desc)
    from public.bookings b
    left join public.guests g on g.id = b.guest_id
    where b.tenant_id = p_tenant_id
      and lower(b.guest_sheet_number) = v_key
      and b.id is distinct from p_exclude
  ), '[]'::jsonb);
end;
$$;
revoke execute on function private.guest_sheet_duplicates(uuid, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Vorschau im Formular: zusätzlich die Gästeblattnummer (neue Signatur ersetzt die alte)
-- ---------------------------------------------------------------------------
drop function public.booking_warnings(uuid, uuid, date, date, integer, integer, uuid);
drop function private.booking_warnings(uuid, uuid, date, date, integer, integer, uuid);

create function private.booking_warnings(
  p_tenant_id uuid,
  p_apartment_id uuid,
  p_arrival date,
  p_departure date,
  p_persons integer,
  p_adults integer,
  p_exclude uuid,
  p_guest_sheet_number text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_duplicates jsonb;
begin
  if not private.is_member(p_tenant_id) then
    raise exception 'Keine Berechtigung.' using errcode = 'P0801';
  end if;
  v_duplicates := private.guest_sheet_duplicates(p_tenant_id, p_guest_sheet_number, p_exclude);
  if p_arrival is null or p_departure is null or p_departure <= p_arrival then
    return jsonb_build_object('conflicts', '[]'::jsonb, 'over_capacity', null, 'guest_sheet_duplicates', v_duplicates);
  end if;
  return private.booking_warnings_for(p_tenant_id, p_apartment_id, p_arrival, p_departure, p_persons, p_adults, p_exclude)
    || jsonb_build_object('guest_sheet_duplicates', v_duplicates);
end;
$$;

create function public.booking_warnings(
  p_tenant_id uuid, p_apartment_id uuid, p_arrival date, p_departure date, p_persons integer,
  p_adults integer default 0, p_exclude uuid default null, p_guest_sheet_number text default null
)
returns jsonb
language sql stable security invoker set search_path = ''
as $$ select private.booking_warnings(p_tenant_id, p_apartment_id, p_arrival, p_departure, p_persons, p_adults, p_exclude, p_guest_sheet_number); $$;

revoke execute on function private.booking_warnings(uuid, uuid, date, date, integer, integer, uuid, text) from public, anon;
revoke execute on function public.booking_warnings(uuid, uuid, date, date, integer, integer, uuid, text) from public, anon;
grant execute on function private.booking_warnings(uuid, uuid, date, date, integer, integer, uuid, text) to authenticated;
grant execute on function public.booking_warnings(uuid, uuid, date, date, integer, integer, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Buchung bzw. Option speichern (Rumpf aus 20261026181450_guest_titles_gender_documents.sql, erweitert)
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
  -- PROJ-30: departure = tatsächliche Abreise (Belegung), planned_departure = vereinbarte (Preis)
  v_departure date := (p_input ->> 'departure')::date;
  v_planned date := (p_input ->> 'planned_departure')::date;
  v_sheet text := nullif(btrim(p_input ->> 'guest_sheet_number'), '');
  v_source text := coalesce(p_input ->> 'source', 'none');
  v_source_custom text := case when coalesce(p_input ->> 'source', 'none') = 'custom' then nullif(btrim(p_input ->> 'source_custom'), '') end;
  v_residence boolean := coalesce((p_input ->> 'residence_registered')::boolean, false);
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
  v_duplicates jsonb;
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
  v_duplicates := private.guest_sheet_duplicates(v_tenant, v_sheet, v_id);
  if (v_override and not (v_owner and coalesce(p_confirm, false)))
      or (jsonb_array_length(v_duplicates) > 0 and not coalesce((p_input ->> 'confirm_guest_sheet_number')::boolean, false)) then
    return jsonb_build_object('status', 'warnings', 'warnings', v_warnings || jsonb_build_object('guest_sheet_duplicates', v_duplicates));
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
      tenant_id, apartment_id, kind, number_year, number_seq, arrival, planned_departure, departure, check_in, check_out, guest_id,
      adults, child_ages, option_until, guest_sheet_number, residence_registered, source, source_custom,
      note, override_at, override_by, price_review
    ) values (
      v_tenant, v_apartment.id, v_kind, extract(year from v_arrival)::integer, v_seq, v_arrival, v_planned, v_departure,
      -- ohne Angabe die Zeiten der Wohnung
      coalesce((p_input ->> 'check_in')::time, v_apartment.check_in),
      coalesce((p_input ->> 'check_out')::time, v_apartment.check_out),
      v_guest_id, v_adults, v_child_ages, v_option_until, v_sheet, v_residence, v_source, v_source_custom,
      nullif(btrim(p_input ->> 'note'), ''),
      case when v_override then now() end, case when v_override then auth.uid() end,
      -- Mitarbeiter-Buchung ohne Preis der Wohnung: Inhaber soll den Preis setzen
      not v_owner and private.suggested_nights_cents(v_apartment, v_adults, v_child_ages, v_planned - v_arrival) is null
    ) returning id into v_id;

    if v_owner then
      insert into public.booking_amounts (id, tenant_id, nights_cents)
      values (v_id, v_tenant, (v_amounts ->> 'nights_cents')::integer);
      insert into public.booking_charges (tenant_id, booking_id, position, label, amount_cents)
      select v_tenant, v_id, c.ord, btrim(c.value ->> 'label'), (c.value ->> 'amount_cents')::integer
      from jsonb_array_elements(coalesce(v_amounts -> 'charges', '[]'::jsonb)) with ordinality as c(value, ord);
    else
      -- Preisvorschlag für Mitarbeiter je nach Preisart der Wohnung (PROJ-27) und Reinigungsgebühr
      -- Vorschlag für den geplanten Zeitraum (PROJ-30)
      v_suggested := private.suggested_nights_cents(v_apartment, v_adults, v_child_ages, v_planned - v_arrival);
      insert into public.booking_amounts (id, tenant_id, nights_cents)
      values (v_id, v_tenant, coalesce(v_suggested, 0));
      if v_apartment.cleaning_fee_cents is not null then
        insert into public.booking_charges (tenant_id, booking_id, position, label, amount_cents)
        values (v_tenant, v_id, 1, 'Reinigung', v_apartment.cleaning_fee_cents);
      end if;
    end if;
  else
    -- „Preis prüfen“: Anreise, geplante Abreise oder Wohnung geändert, bei Personenpreisen auch Erwachsene oder
    -- Kinderalter (PROJ-27). Die tatsächliche Abreise allein nicht: der Preis folgt ihr anteilig (PROJ-30)
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
      source = v_source,
      source_custom = v_source_custom,
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

  -- Abgerechneter Übernachtungspreis nach jedem Speichern, für Inhaber und Mitarbeiter (PROJ-30)
  perform private.refresh_billed_nights(v_id);

  return jsonb_build_object('status', 'saved', 'id', v_id);
end;
$$;
