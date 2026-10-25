-- PROJ-8: Manuelle Buchungen
--
-- * Eine Tabelle für Buchungen, Optionen und Sperren je Kunde (Art „kind“). Lesen: Mitglieder und Admin.
--   Geschrieben wird nur über geschützte Funktionen, die Rolle, Warnungen, Preisvorschlag und Nummer gemeinsam
--   prüfen (alles oder nichts). Einzige Ausnahme: Sperren löschen, direkt erlaubt nur für Inhaber.
-- * Beträge und Zusatzkosten in eigenen Tabellen, die nur Inhaber (und der Admin) lesen: Zugriffsregeln wirken
--   je Zeile, nicht je Spalte. Mitreisende als eigene Tabelle (für alle Mitglieder lesbar).
-- * Zustand (aktiv / verfallen / storniert) wird berechnet: verfallen = Option mit Ablaufdatum vor heute (Wien).
-- * Zeiträume [Anreise, Abreise): der Abreisetag ist nicht belegt (Wechseltag).
-- * Wohnung und Gast verweisen mit Löschsperre (NO ACTION): Wohnungen mit Buchungen lassen sich nicht löschen
--   (PROJ-6), Gäste mit Buchungen werden anonymisiert statt gelöscht (PROJ-7). Das Löschen eines ganzen Kunden
--   entfernt alles in einer Anweisung und bleibt möglich.
-- * Anschlüsse an PROJ-6/7: Reinigungsgebühr je Wohnung; Zusammenführen hängt Buchungen um; Anonymisieren
--   entfernt die Mitreisenden; die Gästeliste zählt Aufenthalte.
--
-- Fehlercodes für die App (src/app/(app)/buchungen/actions.ts):
--   P0801 keine Berechtigung · P0802 nicht gefunden · P0803 inzwischen geändert · P0804 Gast anonymisiert
--   P0805 nicht mehr aktiv · P0806 Wohnung archiviert · P0807 ungültige Eingabe · P0808 zu viele Mitreisende

-- ---------------------------------------------------------------------------
-- Wohnungen: Reinigungsgebühr; Schlüssel für Verweise mit gleicher Kundenkennung
-- ---------------------------------------------------------------------------
alter table public.apartments
  add column cleaning_fee_cents integer check (cleaning_fee_cents between 0 and 1000000),
  add constraint apartments_id_tenant_key unique (id, tenant_id);
comment on column public.apartments.cleaning_fee_cents is 'Reinigungsgebühr in Cent (PROJ-8); wird neuen Buchungen als Position „Reinigung“ vorgeschlagen.';
grant insert (cleaning_fee_cents), update (cleaning_fee_cents) on public.apartments to authenticated;

-- Heutiges Datum in Wien (Optionen verfallen nach ihrem Ablaufdatum)
create function private.today_vienna()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Europe/Vienna')::date; $$;

-- ---------------------------------------------------------------------------
-- Buchungen, Optionen, Sperren
-- ---------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  apartment_id uuid not null,
  kind text not null check (kind in ('booking', 'option', 'block')),
  -- von Hand nur „direct“; booking.com und Airbnb kommen mit dem Import (PROJ-11)
  channel text not null default 'direct' check (channel in ('direct')),
  number_year integer,
  number_seq integer check (number_seq > 0),
  number text generated always as (
    case
      when number_seq is null then null
      when number_seq < 10000 then number_year::text || '-' || lpad(number_seq::text, 4, '0')
      else number_year::text || '-' || number_seq::text
    end
  ) stored,
  arrival date not null,
  departure date not null,
  check_in time,
  check_out time,
  guest_id uuid,
  adults integer,
  child_ages integer[] not null default '{}',
  block_reason text check (block_reason in ('owner_use', 'renovation', 'other')),
  option_until date,
  note text check (note is null or length(note) <= 2000),
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text check (cancel_reason is null or length(cancel_reason) <= 500),
  -- wer trotz Überschneidung oder Überbelegung gespeichert hat
  override_at timestamptz,
  override_by uuid,
  -- ein Mitarbeiter hat Zeitraum oder Wohnung geändert: Inhaber soll den Preis prüfen
  price_review boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,

  constraint bookings_id_tenant_key unique (id, tenant_id),
  constraint bookings_number_key unique (tenant_id, number_year, number_seq),
  -- NO ACTION (Prüfung am Ende der Anweisung): Löschsperre, aber Löschen des ganzen Kunden bleibt möglich
  constraint bookings_apartment_fkey foreign key (apartment_id, tenant_id) references public.apartments (id, tenant_id),
  constraint bookings_guest_fkey foreign key (guest_id, tenant_id) references public.guests (id, tenant_id),
  constraint bookings_period_check check (departure > arrival and departure - arrival <= 365),
  constraint bookings_children_check check (
    cardinality(child_ages) <= 50 and 0 <= all (child_ages) and 17 >= all (child_ages)
  ),
  -- Buchung/Option: Gast, Personen, Nummer; Sperre: Grund, ohne Gast, Personen und Nummer
  constraint bookings_kind_fields_check check (
    case kind
      when 'block' then guest_id is null and adults is null and cardinality(child_ages) = 0
        and block_reason is not null and number_seq is null and cancelled_at is null
      else guest_id is not null and adults between 1 and 50 and adults + cardinality(child_ages) <= 50
        and block_reason is null and number_year is not null and number_seq is not null
    end
  ),
  constraint bookings_option_check check ((kind = 'option') = (option_until is not null)),
  constraint bookings_block_note_check check (block_reason is distinct from 'other' or note is not null)
);
comment on table public.bookings is 'Buchungen, Optionen und Sperren je Kunde (PROJ-8). Schreiben nur über Funktionen; Sperren löschen nur Inhaber.';

create index bookings_tenant_arrival_idx on public.bookings (tenant_id, arrival);
create index bookings_apartment_period_idx on public.bookings (apartment_id, tenant_id, arrival, departure);
create index bookings_guest_idx on public.bookings (guest_id, tenant_id) where guest_id is not null;
create index bookings_number_trgm_idx on public.bookings using gin (number extensions.gin_trgm_ops) where number is not null;

-- Beträge je Buchung bzw. Option (id = Buchung), nur für Inhaber
create table public.booking_amounts (
  id uuid primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  nights_cents integer not null check (nights_cents between 0 and 100000000),
  cancellation_fee_cents integer check (cancellation_fee_cents between 0 and 100000000),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint booking_amounts_booking_fkey foreign key (id, tenant_id) references public.bookings (id, tenant_id) on delete cascade
);
comment on table public.booking_amounts is 'Übernachtungspreis und Stornogebühr je Buchung (PROJ-8), nur für Inhaber lesbar.';
create index booking_amounts_tenant_idx on public.booking_amounts (tenant_id);

-- Zusatzkosten-Positionen, nur für Inhaber
create table public.booking_charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  booking_id uuid not null,
  position integer not null check (position between 1 and 20),
  label text not null check (label = btrim(label) and length(label) between 1 and 100),
  amount_cents integer not null check (amount_cents between 0 and 100000000),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint booking_charges_booking_fkey foreign key (booking_id, tenant_id) references public.bookings (id, tenant_id) on delete cascade
);
comment on table public.booking_charges is 'Zusatzkosten-Positionen je Buchung (PROJ-8), nur für Inhaber lesbar.';
create index booking_charges_booking_idx on public.booking_charges (booking_id, tenant_id, position);
create index booking_charges_tenant_idx on public.booking_charges (tenant_id);

-- Mitreisende je Buchung (beim Anonymisieren des Hauptgastes entfernt)
create table public.booking_companions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  booking_id uuid not null,
  position integer not null check (position between 1 and 49),
  first_name text not null check (first_name = btrim(first_name) and length(first_name) between 1 and 100),
  last_name text not null check (last_name = btrim(last_name) and length(last_name) between 1 and 100),
  birth_date date check (birth_date between '1900-01-01' and '2100-01-01'),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint booking_companions_booking_fkey foreign key (booking_id, tenant_id) references public.bookings (id, tenant_id) on delete cascade
);
comment on table public.booking_companions is 'Mitreisende je Buchung (PROJ-8); Meldedaten ergänzt PROJ-26.';
create index booking_companions_booking_idx on public.booking_companions (booking_id, tenant_id, position);
create index booking_companions_tenant_idx on public.booking_companions (tenant_id);

-- Nummernkreis je Kunde und Jahr (nur intern; die Zeile sperrt gleichzeitige Vergaben)
create table public.booking_numbers (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  year integer not null check (year between 2000 and 2200),
  last_seq integer not null check (last_seq > 0),
  primary key (tenant_id, year)
);
comment on table public.booking_numbers is 'Zuletzt vergebene Buchungsnummer je Kunde und Jahr (PROJ-8), nur intern.';

-- ---------------------------------------------------------------------------
-- Rechte und Abschottung (Muster PROJ-1)
-- ---------------------------------------------------------------------------
revoke all on public.bookings, public.booking_amounts, public.booking_charges, public.booking_companions,
  public.booking_numbers from anon, authenticated;

grant select on public.bookings, public.booking_amounts, public.booking_charges, public.booking_companions to authenticated;
-- Sperren löschen (Policy: nur Inhaber, nur Sperren); alles andere über die Funktionen unten
grant delete on public.bookings to authenticated;

alter table public.bookings enable row level security;
alter table public.booking_amounts enable row level security;
alter table public.booking_charges enable row level security;
alter table public.booking_companions enable row level security;
alter table public.booking_numbers enable row level security;

create policy "Mitglieder und Admin lesen Buchungen"
  on public.bookings for select to authenticated
  using (private.is_member(tenant_id) or (select private.is_admin()));
create policy "Inhaber löschen Sperren"
  on public.bookings for delete to authenticated
  using (kind = 'block' and private.has_role(tenant_id, 'owner'));

create policy "Inhaber und Admin lesen Beträge"
  on public.booking_amounts for select to authenticated
  using (private.has_role(tenant_id, 'owner') or (select private.is_admin()));
create policy "Inhaber und Admin lesen Zusatzkosten"
  on public.booking_charges for select to authenticated
  using (private.has_role(tenant_id, 'owner') or (select private.is_admin()));
create policy "Mitglieder und Admin lesen Mitreisende"
  on public.booking_companions for select to authenticated
  using (private.is_member(tenant_id) or (select private.is_admin()));
-- booking_numbers: keine Policy → nur die Funktionen

select private.enable_tenant_table('public.bookings');
select private.enable_tenant_table('public.booking_amounts');
select private.enable_tenant_table('public.booking_charges');
select private.enable_tenant_table('public.booking_companions');

-- ---------------------------------------------------------------------------
-- Warnungen: Überschneidungen mit aktiven Einträgen derselben Wohnung und Überbelegung
-- ---------------------------------------------------------------------------
create function private.booking_warnings_for(
  p_tenant_id uuid,
  p_apartment_id uuid,
  p_arrival date,
  p_departure date,
  p_persons integer,
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
      select case when coalesce(p_persons, 0) > a.max_guests
        then jsonb_build_object('persons', p_persons, 'max_guests', a.max_guests) end
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
  return private.booking_warnings_for(p_tenant_id, p_apartment_id, p_arrival, p_departure, p_persons, p_exclude);
end;
$$;

create function private.has_warnings(p_warnings jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_array_length(p_warnings -> 'conflicts') > 0 or jsonb_typeof(p_warnings -> 'over_capacity') = 'object';
$$;

-- Gleichzeitige Speichervorgänge für dieselbe Wohnung laufen nacheinander (bis zum Ende des Vorgangs)
create function private.lock_apartment(p_apartment_id uuid)
returns void
language sql
set search_path = ''
as $$ select pg_advisory_xact_lock(hashtextextended('apppa.booking:' || p_apartment_id::text, 0)); $$;

-- ---------------------------------------------------------------------------
-- Buchung bzw. Option speichern (anlegen oder ändern)
--
-- p_input: id, updated_at (beim Ändern), tenant_id, kind ('booking'|'option', nur beim Anlegen), apartment_id,
--   arrival, departure, check_in, check_out, guest_id oder new_guest (Gast-Felder wie public.guests),
--   adults, child_ages, option_until, note, amounts { nights_cents, charges: [{ label, amount_cents }] }
-- Ergebnis: { status: 'saved', id } oder { status: 'warnings', warnings } (nichts gespeichert)
-- ---------------------------------------------------------------------------
create function private.save_booking(p_input jsonb, p_confirm boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (p_input ->> 'tenant_id')::uuid;
  v_id uuid := nullif(p_input ->> 'id', '')::uuid;
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
  end if;
  v_option_until := case when v_kind = 'option' then (p_input ->> 'option_until')::date end;
  if v_kind = 'option' and (v_option_until is null or (v_option_until < private.today_vienna()
      and (v_old.id is null or v_option_until is distinct from v_old.option_until))) then
    raise exception 'Ungültiges Ablaufdatum.' using errcode = 'P0807';
  end if;

  -- Wohnung (gleichzeitige Speichervorgänge je Wohnung nacheinander)
  perform private.lock_apartment((p_input ->> 'apartment_id')::uuid);
  select * into v_apartment from public.apartments where id = (p_input ->> 'apartment_id')::uuid and tenant_id = v_tenant;
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

  if v_adults is null or v_departure is null or v_arrival is null then
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
      check_in = coalesce((p_input ->> 'check_in')::time, check_in),
      check_out = coalesce((p_input ->> 'check_out')::time, check_out),
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
-- Sperre speichern (anlegen oder ändern)
-- p_input: id, updated_at (beim Ändern), tenant_id, apartment_id, arrival, departure, block_reason, note
-- ---------------------------------------------------------------------------
create function private.save_block(p_input jsonb, p_confirm boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (p_input ->> 'tenant_id')::uuid;
  v_id uuid := nullif(p_input ->> 'id', '')::uuid;
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
  if v_id is not null then
    select * into v_old from public.bookings where id = v_id and tenant_id = v_tenant for update;
    if v_old.id is null or v_old.kind <> 'block' then
      raise exception 'Sperre nicht gefunden.' using errcode = 'P0802';
    end if;
    if v_old.updated_at is distinct from (p_input ->> 'updated_at')::timestamptz then
      raise exception 'Die Sperre wurde inzwischen geändert.' using errcode = 'P0803';
    end if;
  end if;

  perform private.lock_apartment((p_input ->> 'apartment_id')::uuid);
  select * into v_apartment from public.apartments where id = (p_input ->> 'apartment_id')::uuid and tenant_id = v_tenant;
  if v_apartment.id is null then
    raise exception 'Wohnung nicht gefunden.' using errcode = 'P0802';
  end if;
  if v_apartment.archived_at is not null and v_apartment.id is distinct from v_old.apartment_id then
    raise exception 'Die Wohnung ist archiviert.' using errcode = 'P0806';
  end if;
  if v_arrival is null or v_departure is null then
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
-- Stornieren (nur Inhaber): Zeitraum wird frei, Grund und Gebühr bleiben
-- ---------------------------------------------------------------------------
create function private.cancel_booking(p_booking_id uuid, p_reason text, p_fee_cents integer)
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
  if not private.has_role(v_booking.tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0801';
  end if;
  if v_booking.cancelled_at is not null then
    raise exception 'Die Buchung ist bereits storniert.' using errcode = 'P0805';
  end if;
  update public.bookings set
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancel_reason = nullif(btrim(p_reason), '')
  where id = p_booking_id;
  insert into public.booking_amounts as a (id, tenant_id, nights_cents, cancellation_fee_cents)
  values (p_booking_id, v_booking.tenant_id, 0, p_fee_cents)
  on conflict (id) do update set cancellation_fee_cents = excluded.cancellation_fee_cents;
end;
$$;

-- ---------------------------------------------------------------------------
-- Option bestätigen (auch eine verfallene, solange der Zeitraum frei ist); gleiche Nummer
-- Ergebnis: { status: 'saved' } oder { status: 'warnings', warnings }
-- ---------------------------------------------------------------------------
create function private.confirm_option(p_booking_id uuid, p_confirm boolean)
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
    v_booking.departure, v_booking.adults + cardinality(v_booking.child_ages), v_booking.id);
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

-- ---------------------------------------------------------------------------
-- Mitreisende speichern (ersetzt die Liste): höchstens Personen minus Hauptgast
-- p_companions: [{ first_name, last_name, birth_date }]
-- ---------------------------------------------------------------------------
create function private.save_companions(p_booking_id uuid, p_updated_at timestamptz, p_companions jsonb)
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

  delete from public.booking_companions where booking_id = p_booking_id;
  insert into public.booking_companions (tenant_id, booking_id, position, first_name, last_name, birth_date)
  select v_booking.tenant_id, p_booking_id, c.ord, btrim(c.value ->> 'first_name'), btrim(c.value ->> 'last_name'),
    nullif(c.value ->> 'birth_date', '')::date
  from jsonb_array_elements(coalesce(p_companions, '[]'::jsonb)) with ordinality as c(value, ord);
  -- Stand der Buchung weiterzählen (Schutz vor Überschreiben im Formular)
  update public.bookings set updated_at = now() where id = p_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notiz eines Eintrags (alle Mitglieder) und Stornogebühr einer stornierten Buchung (nur Inhaber)
-- ---------------------------------------------------------------------------
create function private.save_booking_note(
  p_booking_id uuid,
  p_updated_at timestamptz,
  p_note text,
  p_set_fee boolean,
  p_fee_cents integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null or not private.is_member(v_booking.tenant_id) then
    raise exception 'Buchung nicht gefunden.' using errcode = 'P0802';
  end if;
  if v_booking.updated_at is distinct from p_updated_at then
    raise exception 'Die Buchung wurde inzwischen geändert.' using errcode = 'P0803';
  end if;
  if coalesce(p_set_fee, false) then
    if not private.has_role(v_booking.tenant_id, 'owner') then
      raise exception 'Nur für Inhaber.' using errcode = 'P0801';
    end if;
    if v_booking.cancelled_at is null then
      raise exception 'Nur stornierte Buchungen haben eine Stornogebühr.' using errcode = 'P0807';
    end if;
    update public.booking_amounts set cancellation_fee_cents = p_fee_cents where id = p_booking_id;
  end if;
  update public.bookings set note = nullif(btrim(p_note), '') where id = p_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- PROJ-7 anschließen: Zusammenführen hängt Buchungen um, Löschen prüft Buchungen,
-- Anonymisieren entfernt Mitreisende, Gästeliste zählt Aufenthalte
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

  -- PROJ-8: alle Buchungen des entfernten Gastes gehören jetzt dem verbleibenden
  update public.bookings set guest_id = p_keep where guest_id = p_remove;

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

  -- Mit Buchungen (auch stornierten) anonymisieren, damit Buchungen für Abgabe und Steuer bleiben
  if exists (select 1 from public.bookings where guest_id = p_guest_id) then
    perform private.anonymize_guest(p_guest_id);
    return 'anonymized';
  end if;

  delete from public.guests where id = p_guest_id;
  -- Es bleibt nur der Vermerk „gelöscht“ mit Person und Zeitpunkt
  perform private.purge_audit_personal_data('guests', p_guest_id);
  return 'deleted';
end;
$$;

-- Gästeliste: Aufenthalte = aktive Buchungen (ohne Optionen); letzter = jüngste Anreise bis heute
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
-- Aufrufbar über die API (security invoker; die privaten Funktionen prüfen die Rolle selbst)
-- ---------------------------------------------------------------------------
create function public.booking_warnings(
  p_tenant_id uuid, p_apartment_id uuid, p_arrival date, p_departure date, p_persons integer, p_exclude uuid default null
)
returns jsonb
language sql stable security invoker set search_path = ''
as $$ select private.booking_warnings(p_tenant_id, p_apartment_id, p_arrival, p_departure, p_persons, p_exclude); $$;

create function public.save_booking(p_input jsonb, p_confirm boolean default false)
returns jsonb
language sql security invoker set search_path = ''
as $$ select private.save_booking(p_input, p_confirm); $$;

create function public.save_block(p_input jsonb, p_confirm boolean default false)
returns jsonb
language sql security invoker set search_path = ''
as $$ select private.save_block(p_input, p_confirm); $$;

create function public.cancel_booking(p_booking_id uuid, p_reason text default null, p_fee_cents integer default null)
returns void
language sql security invoker set search_path = ''
as $$ select private.cancel_booking(p_booking_id, p_reason, p_fee_cents); $$;

create function public.confirm_option(p_booking_id uuid, p_confirm boolean default false)
returns jsonb
language sql security invoker set search_path = ''
as $$ select private.confirm_option(p_booking_id, p_confirm); $$;

create function public.save_companions(p_booking_id uuid, p_updated_at timestamptz, p_companions jsonb)
returns void
language sql security invoker set search_path = ''
as $$ select private.save_companions(p_booking_id, p_updated_at, p_companions); $$;

create function public.save_booking_note(
  p_booking_id uuid, p_updated_at timestamptz, p_note text, p_set_fee boolean default false, p_fee_cents integer default null
)
returns void
language sql security invoker set search_path = ''
as $$ select private.save_booking_note(p_booking_id, p_updated_at, p_note, p_set_fee, p_fee_cents); $$;

revoke execute on function private.today_vienna() from public, anon;
revoke execute on function private.booking_warnings_for(uuid, uuid, date, date, integer, uuid) from public, anon, authenticated;
revoke execute on function private.booking_warnings(uuid, uuid, date, date, integer, uuid) from public, anon;
revoke execute on function private.has_warnings(jsonb) from public, anon;
revoke execute on function private.lock_apartment(uuid) from public, anon, authenticated;
revoke execute on function private.save_booking(jsonb, boolean) from public, anon;
revoke execute on function private.save_block(jsonb, boolean) from public, anon;
revoke execute on function private.cancel_booking(uuid, text, integer) from public, anon;
revoke execute on function private.confirm_option(uuid, boolean) from public, anon;
revoke execute on function private.save_companions(uuid, timestamptz, jsonb) from public, anon;
revoke execute on function private.save_booking_note(uuid, timestamptz, text, boolean, integer) from public, anon;
revoke execute on function public.booking_warnings(uuid, uuid, date, date, integer, uuid) from public, anon;
revoke execute on function public.save_booking(jsonb, boolean) from public, anon;
revoke execute on function public.save_block(jsonb, boolean) from public, anon;
revoke execute on function public.cancel_booking(uuid, text, integer) from public, anon;
revoke execute on function public.confirm_option(uuid, boolean) from public, anon;
revoke execute on function public.save_companions(uuid, timestamptz, jsonb) from public, anon;
revoke execute on function public.save_booking_note(uuid, timestamptz, text, boolean, integer) from public, anon;

grant execute on function private.today_vienna() to authenticated;
grant execute on function private.booking_warnings(uuid, uuid, date, date, integer, uuid) to authenticated;
grant execute on function private.has_warnings(jsonb) to authenticated;
grant execute on function private.save_booking(jsonb, boolean) to authenticated;
grant execute on function private.save_block(jsonb, boolean) to authenticated;
grant execute on function private.cancel_booking(uuid, text, integer) to authenticated;
grant execute on function private.confirm_option(uuid, boolean) to authenticated;
grant execute on function private.save_companions(uuid, timestamptz, jsonb) to authenticated;
grant execute on function private.save_booking_note(uuid, timestamptz, text, boolean, integer) to authenticated;
grant execute on function public.booking_warnings(uuid, uuid, date, date, integer, uuid) to authenticated;
grant execute on function public.save_booking(jsonb, boolean) to authenticated;
grant execute on function public.save_block(jsonb, boolean) to authenticated;
grant execute on function public.cancel_booking(uuid, text, integer) to authenticated;
grant execute on function public.confirm_option(uuid, boolean) to authenticated;
grant execute on function public.save_companions(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.save_booking_note(uuid, timestamptz, text, boolean, integer) to authenticated;
