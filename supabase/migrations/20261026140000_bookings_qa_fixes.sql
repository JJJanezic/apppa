-- PROJ-8: Korrekturen aus der QA (2026-10-25). Zugriffsregeln (RLS) und Rechte bleiben unverändert.
--
-- * BUG-2: Check-in-/Check-out-Zeit sind optional. Beim Ändern gilt der übergebene Wert (null = keine Zeit);
--   beim Anlegen bleibt die Zeit der Wohnung der Ersatz.
-- * BUG-4: Regeln, die bisher nur die App prüfte, gelten auch in der Datenbank: Anreise und Ablaufdatum der Option
--   höchstens 3 Jahre voraus, Geburtsdatum der Mitreisenden nicht in der Zukunft, keine leeren Kinderalter.
-- * BUG-5: Gleiche Sperr-Reihenfolge wie confirm_option (erst Wohnung, dann Eintrag), damit gleichzeitiges
--   Bearbeiten und Bestätigen derselben Option nicht verklemmt.

-- Leere Einträge (null) in child_ages bestehen „0 <= all(...)“; ausdrücklich ausschließen
alter table public.bookings
  add constraint bookings_child_ages_not_null_check check (array_position(child_ages, null) is null);

-- Spätestes erlaubtes Datum für Anreise und Ablaufdatum (wie src/lib/validation/bookings.ts: heute + 3 Jahre + 1 Tag)
create function private.booking_max_date()
returns date
language sql
stable
set search_path = ''
as $$ select private.today_vienna() + (365 * 3 + 1); $$;

revoke execute on function private.booking_max_date() from public, anon;
grant execute on function private.booking_max_date() to authenticated;

-- Wohnungen eines Vorgangs sperren, immer in derselben Reihenfolge (nach id)
create function private.lock_apartments(p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in select distinct a from unnest(p_ids) as a where a is not null order by a loop
    perform private.lock_apartment(v_id);
  end loop;
end;
$$;

revoke execute on function private.lock_apartments(uuid[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Buchung bzw. Option speichern (Ablauf siehe 20261026130000_bookings.sql)
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
    v_adults + cardinality(v_child_ages), v_id);
  v_override := private.has_warnings(v_warnings);
  if v_override and not (v_owner and coalesce(p_confirm, false)) then
    return jsonb_build_object('status', 'warnings', 'warnings', v_warnings);
  end if;

  -- Neuer Gast entsteht im selben Vorgang (auch für Mitarbeiter, Entscheidung PROJ-7)
  if v_new_guest is not null then
    insert into public.guests (
      tenant_id, last_name, first_name, country, email, phone, language, birth_date, street, postal_code, city,
      address_country, marketing_source, marketing_custom, company_name, company_vat_id, company_billing_address, note
    ) values (
      v_tenant, v_new_guest ->> 'last_name', v_new_guest ->> 'first_name', v_new_guest ->> 'country',
      v_new_guest ->> 'email', v_new_guest ->> 'phone', v_new_guest ->> 'language',
      (v_new_guest ->> 'birth_date')::date, v_new_guest ->> 'street', v_new_guest ->> 'postal_code',
      v_new_guest ->> 'city', v_new_guest ->> 'address_country', v_new_guest ->> 'marketing_source',
      v_new_guest ->> 'marketing_custom', v_new_guest ->> 'company_name', v_new_guest ->> 'company_vat_id',
      v_new_guest ->> 'company_billing_address', v_new_guest ->> 'note'
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
      -- Mitarbeiter-Buchung ohne Standardpreis: Inhaber soll den Preis setzen
      not v_owner and v_apartment.price_cents is null
    ) returning id into v_id;

    if v_owner then
      insert into public.booking_amounts (id, tenant_id, nights_cents)
      values (v_id, v_tenant, (v_amounts ->> 'nights_cents')::integer);
      insert into public.booking_charges (tenant_id, booking_id, position, label, amount_cents)
      select v_tenant, v_id, c.ord, btrim(c.value ->> 'label'), (c.value ->> 'amount_cents')::integer
      from jsonb_array_elements(coalesce(v_amounts -> 'charges', '[]'::jsonb)) with ordinality as c(value, ord);
    else
      -- Preisvorschlag für Mitarbeiter: Standardpreis × Nächte und Reinigungsgebühr
      insert into public.booking_amounts (id, tenant_id, nights_cents)
      values (v_id, v_tenant, coalesce(v_apartment.price_cents, 0) * (v_departure - v_arrival));
      if v_apartment.cleaning_fee_cents is not null then
        insert into public.booking_charges (tenant_id, booking_id, position, label, amount_cents)
        values (v_tenant, v_id, 1, 'Reinigung', v_apartment.cleaning_fee_cents);
      end if;
    end if;
  else
    v_changed := v_old.arrival <> v_arrival or v_old.departure <> v_departure or v_old.apartment_id <> v_apartment.id;
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
-- Sperre speichern
-- ---------------------------------------------------------------------------
create or replace function private.save_block(p_input jsonb, p_confirm boolean)
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
  v_owner boolean;
  v_old public.bookings;
  v_apartment public.apartments;
  v_warnings jsonb;
  v_override boolean;
begin
  if v_tenant is null or not private.is_member(v_tenant) then
    raise exception 'Keine Berechtigung.' using errcode = 'P0801';
  end if;
  v_owner := private.has_role(v_tenant, 'owner');
  -- Sperr-Reihenfolge: erst Wohnung(en), dann der Eintrag
  perform private.lock_apartments(array[
    (select b.apartment_id from public.bookings b where b.id = v_id and b.tenant_id = v_tenant),
    v_apartment_id
  ]);
  if v_id is not null then
    select * into v_old from public.bookings where id = v_id and tenant_id = v_tenant for update;
    if v_old.id is null or v_old.kind <> 'block' then
      raise exception 'Sperre nicht gefunden.' using errcode = 'P0802';
    end if;
    if v_old.updated_at is distinct from (p_input ->> 'updated_at')::timestamptz then
      raise exception 'Die Sperre wurde inzwischen geändert.' using errcode = 'P0803';
    end if;
  end if;

  select * into v_apartment from public.apartments where id = v_apartment_id and tenant_id = v_tenant;
  if v_apartment.id is null then
    raise exception 'Wohnung nicht gefunden.' using errcode = 'P0802';
  end if;
  if v_apartment.archived_at is not null and v_apartment.id is distinct from v_old.apartment_id then
    raise exception 'Die Wohnung ist archiviert.' using errcode = 'P0806';
  end if;
  if v_arrival is null or v_departure is null or v_arrival > private.booking_max_date() then
    raise exception 'Ungültige Eingabe.' using errcode = 'P0807';
  end if;

  v_warnings := private.booking_warnings_for(v_tenant, v_apartment.id, v_arrival, v_departure, 0, v_id);
  v_override := private.has_warnings(v_warnings);
  if v_override and not (v_owner and coalesce(p_confirm, false)) then
    return jsonb_build_object('status', 'warnings', 'warnings', v_warnings);
  end if;

  if v_old.id is null then
    insert into public.bookings (tenant_id, apartment_id, kind, arrival, departure, block_reason, note, override_at, override_by)
    values (
      v_tenant, v_apartment.id, 'block', v_arrival, v_departure, p_input ->> 'block_reason',
      nullif(btrim(p_input ->> 'note'), ''),
      case when v_override then now() end, case when v_override then auth.uid() end
    ) returning id into v_id;
  else
    update public.bookings set
      apartment_id = v_apartment.id,
      arrival = v_arrival,
      departure = v_departure,
      block_reason = p_input ->> 'block_reason',
      note = nullif(btrim(p_input ->> 'note'), ''),
      override_at = case when v_override then now() end,
      override_by = case when v_override then auth.uid() end
    where id = v_id;
  end if;
  return jsonb_build_object('status', 'saved', 'id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Mitreisende speichern: zusätzlich Geburtsdatum nicht in der Zukunft
-- ---------------------------------------------------------------------------
create or replace function private.save_companions(p_booking_id uuid, p_updated_at timestamptz, p_companions jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null or v_booking.kind = 'block' or not private.is_member(v_booking.tenant_id) then
    raise exception 'Buchung nicht gefunden.' using errcode = 'P0802';
  end if;
  if v_booking.cancelled_at is not null
    or (v_booking.kind = 'option' and v_booking.option_until < private.today_vienna()) then
    raise exception 'Die Buchung ist nicht mehr aktiv.' using errcode = 'P0805';
  end if;
  if v_booking.updated_at is distinct from p_updated_at then
    raise exception 'Die Buchung wurde inzwischen geändert.' using errcode = 'P0803';
  end if;
  if jsonb_array_length(coalesce(p_companions, '[]'::jsonb)) > v_booking.adults + cardinality(v_booking.child_ages) - 1 then
    raise exception 'Zu viele Mitreisende.' using errcode = 'P0808';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_companions, '[]'::jsonb)) as c(value)
    where nullif(c.value ->> 'birth_date', '')::date > private.today_vienna()
  ) then
    raise exception 'Geburtsdatum in der Zukunft.' using errcode = 'P0807';
  end if;

  delete from public.booking_companions where booking_id = p_booking_id;
  insert into public.booking_companions (tenant_id, booking_id, position, first_name, last_name, birth_date)
  select v_booking.tenant_id, p_booking_id, c.ord, btrim(c.value ->> 'first_name'), btrim(c.value ->> 'last_name'),
    nullif(c.value ->> 'birth_date', '')::date
  from jsonb_array_elements(coalesce(p_companions, '[]'::jsonb)) with ordinality as c(value, ord);
  -- Stand der Buchung weiterzählen (Schutz vor Überschreiben im Formular)
  update public.bookings set updated_at = now() where id = p_booking_id;
end;
$$;
