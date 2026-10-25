-- PROJ-27: Personenpreise und Kapazität nach Erwachsenen. Zugriffsregeln (RLS) bleiben unverändert.
--
-- * Wohnungen: „höchstens Erwachsene“ (optional), Preisart „Wohnung“ (bisher, Vorgabe für alle bestehenden)
--   oder „Personen“ mit Erwachsenenpreis und bis zu 3 Kinderstufen (bis einschließlich Alter, Preis pro Nacht).
-- * Die Wohnung liefert nur den rechnerischen Vorschlag; gespeichert wird an der Buchung der vereinbarte Preis.
-- * Kapazitätswarnung: Personen > gesamt oder Erwachsene > Grenze. Mitarbeiter-Buchungen erhalten den Vorschlag
--   nach Preisart; ändern Mitarbeiter bei Personenpreisen Erwachsene oder Kinderalter, gilt „Preis prüfen“.
-- * Gleiche Rechnung wie suggestedNightsCents in src/lib/bookings.ts (Tests vergleichen beide).

-- Kinderstufen: höchstens 3, je { to_age 0–17, price_cents 0–1.000.000 }, to_age streng aufsteigend
create function private.valid_child_prices(p_tiers jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_tier jsonb;
  v_previous integer := -1;
begin
  if p_tiers is null or jsonb_typeof(p_tiers) <> 'array' or jsonb_array_length(p_tiers) > 3 then
    return false;
  end if;
  for v_tier in select value from jsonb_array_elements(p_tiers) loop
    if jsonb_typeof(v_tier) <> 'object'
      or (select count(*) from jsonb_object_keys(v_tier)) <> 2
      or jsonb_typeof(v_tier -> 'to_age') is distinct from 'number'
      or jsonb_typeof(v_tier -> 'price_cents') is distinct from 'number' then
      return false;
    end if;
    if (v_tier ->> 'to_age')::numeric <> trunc((v_tier ->> 'to_age')::numeric)
      or (v_tier ->> 'price_cents')::numeric <> trunc((v_tier ->> 'price_cents')::numeric)
      or (v_tier ->> 'to_age')::numeric not between 0 and 17
      or (v_tier ->> 'price_cents')::numeric not between 0 and 1000000
      or (v_tier ->> 'to_age')::integer <= v_previous then
      return false;
    end if;
    v_previous := (v_tier ->> 'to_age')::integer;
  end loop;
  return true;
end;
$$;

alter table public.apartments
  add column max_adults integer,
  add column price_mode text not null default 'apartment',
  add column adult_price_cents integer check (adult_price_cents between 0 and 1000000),
  add column child_prices jsonb not null default '[]'::jsonb,
  add constraint apartments_max_adults_check check (max_adults is null or max_adults between 1 and max_guests),
  add constraint apartments_price_mode_check check (price_mode in ('apartment', 'person')),
  add constraint apartments_person_price_check check (price_mode <> 'person' or adult_price_cents is not null),
  add constraint apartments_child_prices_check check (private.valid_child_prices(child_prices));
comment on column public.apartments.max_adults is 'Höchstens Erwachsene (PROJ-27); leer = nur die Personenzahl gilt.';
comment on column public.apartments.price_mode is 'Preisart (PROJ-27): apartment = price_cents pro Nacht, person = Personenpreise.';
comment on column public.apartments.adult_price_cents is 'Erwachsenenpreis pro Nacht in Cent (Preisart person).';
comment on column public.apartments.child_prices is 'Kinderstufen [{to_age, price_cents}] aufsteigend; ältere Kinder zahlen den Erwachsenenpreis.';

-- Gleiche Spaltenrechte wie Standardpreis und Reinigungsgebühr (schreiben laut Regel nur Inhaber)
grant insert (max_adults, price_mode, adult_price_cents, child_prices),
  update (max_adults, price_mode, adult_price_cents, child_prices) on public.apartments to authenticated;

-- Rechnerischer Übernachtungspreis (Vorschlag) in Cent; null, wenn die Wohnung keinen Preis hat
create function private.suggested_nights_cents(p_apartment public.apartments, p_adults integer, p_child_ages integer[], p_nights integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_apartment.price_mode = 'person' then
      case when p_apartment.adult_price_cents is null then null else (
        p_nights * (
          coalesce(p_adults, 0) * p_apartment.adult_price_cents
          + coalesce((
            select sum(coalesce((
              select (t.value ->> 'price_cents')::integer
              from jsonb_array_elements(p_apartment.child_prices) with ordinality as t(value, ord)
              where (t.value ->> 'to_age')::integer >= age
              order by t.ord
              limit 1
            ), p_apartment.adult_price_cents))
            from unnest(coalesce(p_child_ages, '{}'::integer[])) as age
          ), 0)
        )
      )::integer end
    else (p_apartment.price_cents::bigint * p_nights)::integer
  end;
$$;

revoke execute on function private.valid_child_prices(jsonb) from public, anon;
grant execute on function private.valid_child_prices(jsonb) to authenticated;
revoke execute on function private.suggested_nights_cents(public.apartments, integer, integer[], integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Warnungen: zusätzlich Erwachsene gegen die Erwachsenen-Grenze
-- ---------------------------------------------------------------------------
drop function public.booking_warnings(uuid, uuid, date, date, integer, uuid);
drop function private.booking_warnings(uuid, uuid, date, date, integer, uuid);
drop function private.booking_warnings_for(uuid, uuid, date, date, integer, uuid);

create function private.booking_warnings_for(
  p_tenant_id uuid,
  p_apartment_id uuid,
  p_arrival date,
  p_departure date,
  p_persons integer,
  p_adults integer,
  p_exclude uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'conflicts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'kind', b.kind,
        'number', b.number,
        'guest_name', case when g.id is null then null when g.first_name is null then g.last_name
          else g.last_name || ', ' || g.first_name end,
        'block_reason', b.block_reason,
        'arrival', b.arrival,
        'departure', b.departure
      ) order by b.arrival)
      from public.bookings b
      left join public.guests g on g.id = b.guest_id
      where b.tenant_id = p_tenant_id
        and b.apartment_id = p_apartment_id
        and b.id is distinct from p_exclude
        and b.cancelled_at is null
        and (b.kind <> 'option' or b.option_until >= private.today_vienna())
        and b.arrival < p_departure
        and b.departure > p_arrival
    ), '[]'::jsonb),
    'over_capacity', (
      select case when coalesce(p_persons, 0) > a.max_guests or coalesce(p_adults, 0) > a.max_adults
        then jsonb_build_object('persons', p_persons, 'max_guests', a.max_guests, 'adults', p_adults, 'max_adults', a.max_adults) end
      from public.apartments a
      where a.id = p_apartment_id and a.tenant_id = p_tenant_id
    )
  );
$$;

-- Vorschau im Formular (nur Mitglieder des Kunden)
create function private.booking_warnings(
  p_tenant_id uuid,
  p_apartment_id uuid,
  p_arrival date,
  p_departure date,
  p_persons integer,
  p_adults integer,
  p_exclude uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_member(p_tenant_id) then
    raise exception 'Keine Berechtigung.' using errcode = 'P0801';
  end if;
  if p_arrival is null or p_departure is null or p_departure <= p_arrival then
    return jsonb_build_object('conflicts', '[]'::jsonb, 'over_capacity', null);
  end if;
  return private.booking_warnings_for(p_tenant_id, p_apartment_id, p_arrival, p_departure, p_persons, p_adults, p_exclude);
end;
$$;

create function public.booking_warnings(
  p_tenant_id uuid, p_apartment_id uuid, p_arrival date, p_departure date, p_persons integer,
  p_adults integer default 0, p_exclude uuid default null
)
returns jsonb
language sql stable security invoker set search_path = ''
as $$ select private.booking_warnings(p_tenant_id, p_apartment_id, p_arrival, p_departure, p_persons, p_adults, p_exclude); $$;

revoke execute on function private.booking_warnings_for(uuid, uuid, date, date, integer, integer, uuid) from public, anon, authenticated;
revoke execute on function private.booking_warnings(uuid, uuid, date, date, integer, integer, uuid) from public, anon;
revoke execute on function public.booking_warnings(uuid, uuid, date, date, integer, integer, uuid) from public, anon;
grant execute on function private.booking_warnings(uuid, uuid, date, date, integer, integer, uuid) to authenticated;
grant execute on function public.booking_warnings(uuid, uuid, date, date, integer, integer, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Speichern und Bestätigen: Erwachsene in der Prüfung, Vorschlag nach Preisart, „Preis prüfen“ bei Personen
-- (Funktionsrümpfe aus 20261026140000_bookings_qa_fixes.sql bzw. 20261026130000_bookings.sql, angepasst)
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

  v_warnings := private.booking_warnings_for(v_tenant, v_apartment.id, v_arrival, v_departure, 0, 0, v_id);
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

create or replace function private.confirm_option(p_booking_id uuid, p_confirm boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_warnings jsonb;
  v_override boolean;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null or not private.is_member(v_booking.tenant_id) then
    raise exception 'Option nicht gefunden.' using errcode = 'P0802';
  end if;
  perform private.lock_apartment(v_booking.apartment_id);
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.kind <> 'option' or v_booking.cancelled_at is not null then
    raise exception 'Die Option ist nicht mehr aktiv.' using errcode = 'P0805';
  end if;
  v_warnings := private.booking_warnings_for(v_booking.tenant_id, v_booking.apartment_id, v_booking.arrival,
    v_booking.departure, v_booking.adults + cardinality(v_booking.child_ages), v_booking.adults, v_booking.id);
  v_override := private.has_warnings(v_warnings);
  if v_override and not (private.has_role(v_booking.tenant_id, 'owner') and coalesce(p_confirm, false)) then
    return jsonb_build_object('status', 'warnings', 'warnings', v_warnings);
  end if;
  update public.bookings set
    kind = 'booking',
    option_until = null,
    override_at = case when v_override then now() else override_at end,
    override_by = case when v_override then auth.uid() else override_by end
  where id = p_booking_id;
  return jsonb_build_object('status', 'saved', 'id', p_booking_id);
end;
$$;
