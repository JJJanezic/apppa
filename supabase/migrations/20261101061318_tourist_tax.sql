-- PROJ-15: Ortstaxe je Wohnung
-- * apartment_tourist_tax_rates: Tarife je Wohnung mit „gültig ab“ (Betrag pro Person und Nacht oder Prozent vom
--   Übernachtungspreis netto/brutto, Altersbefreiung, USt-Satz); nur Inhaber (und Admin) lesen, Schreiben nur über
--   save_tourist_tax_rates
-- * bookings: Abgabe-Zustand (pending = noch nicht berechnet, auto, manual) und „Hauptgast befreit“;
--   booking_companions: „befreit“; booking_charges: Kennzeichen Abgabe-Position, Tarif-Verweis, Personennächte
-- * Rechenregel tourist_tax_lines (gleiche Fälle wie src/lib/tourist-tax.test.ts), Kleinunternehmer-Regel
--   small_business_on (wie vatStatusOn in src/lib/vat-status.ts), apply_tourist_tax ersetzt die Abgabe-Positionen
-- * save_booking und save_companions rechnen im Zustand „automatisch“ selbst

-- ---------------------------------------------------------------------------
-- Tarife
-- ---------------------------------------------------------------------------
create table public.apartment_tourist_tax_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  apartment_id uuid not null,
  valid_from date not null check (valid_from between '2000-01-01' and '2100-12-31'),
  label text not null check (label = btrim(label) and length(label) between 1 and 100),
  method text not null check (method in ('per_person_night', 'percent')),
  amount_cents integer,
  percent_rate numeric(5, 2),
  base text,
  exempt_under_age integer,
  vat_rate numeric(5, 2) not null default 0 check (vat_rate between 0 and 100),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint apartment_tourist_tax_rates_apartment_fkey foreign key (apartment_id, tenant_id)
    references public.apartments (id, tenant_id) on delete cascade,
  -- Felder je Berechnungsart: Betrag (0–1.000 €) mit optionaler Altersgrenze 1–18, oder Prozentsatz (> 0 bis 100) mit Basis
  constraint apartment_tourist_tax_rates_fields_check check (
    (method = 'per_person_night' and amount_cents between 0 and 100000 and percent_rate is null and base is null
      and (exempt_under_age is null or exempt_under_age between 1 and 18))
    or (method = 'percent' and amount_cents is null and percent_rate > 0 and percent_rate <= 100
      and base in ('net', 'gross') and exempt_under_age is null)
  ),
  -- je Wohnung jedes Datum einmal; erst am Ende des Vorgangs geprüft (Tausch von Daten beim Ersetzen der Liste)
  constraint apartment_tourist_tax_rates_apartment_day_key unique (apartment_id, valid_from) deferrable initially deferred
);
comment on table public.apartment_tourist_tax_rates is
  'Ortstaxe-Tarife je Wohnung mit „gültig ab“ (PROJ-15). Nur Inhaber und Admin lesen; Schreiben nur über save_tourist_tax_rates.';
create index apartment_tourist_tax_rates_tenant_idx on public.apartment_tourist_tax_rates (tenant_id);
create index apartment_tourist_tax_rates_apartment_tenant_idx on public.apartment_tourist_tax_rates (apartment_id, tenant_id);

revoke all on public.apartment_tourist_tax_rates from anon, authenticated;
grant select on public.apartment_tourist_tax_rates to authenticated;
alter table public.apartment_tourist_tax_rates enable row level security;
create policy "Inhaber und Admin lesen Ortstaxe-Tarife"
  on public.apartment_tourist_tax_rates for select to authenticated
  using (private.has_role(tenant_id, 'owner') or (select private.is_admin()));
-- kein insert/update/delete: nur über private.save_tourist_tax_rates
select private.enable_tenant_table('public.apartment_tourist_tax_rates');

-- ---------------------------------------------------------------------------
-- Buchungen, Mitreisende, Zusatzkosten
-- ---------------------------------------------------------------------------
-- Bestehende Buchungen: „noch nicht berechnet“; neue: „automatisch“
alter table public.bookings
  add column tourist_tax_mode text not null default 'pending'
    constraint bookings_tourist_tax_mode_check check (tourist_tax_mode in ('pending', 'auto', 'manual')),
  add column main_guest_tourist_tax_exempt boolean not null default false;
alter table public.bookings alter column tourist_tax_mode set default 'auto';
comment on column public.bookings.tourist_tax_mode is
  'Ortstaxe (PROJ-15): pending = noch nicht berechnet (Bestand vor PROJ-15), auto = rechnet beim Speichern, manual = vom Inhaber überschrieben.';
comment on column public.bookings.main_guest_tourist_tax_exempt is 'Hauptgast für diesen Aufenthalt von der Ortstaxe befreit (PROJ-15).';

alter table public.booking_companions add column tourist_tax_exempt boolean not null default false;
comment on column public.booking_companions.tourist_tax_exempt is 'Mitreisender für diesen Aufenthalt von der Ortstaxe befreit (PROJ-15).';

alter table public.booking_charges
  add column tourist_tax boolean not null default false,
  add column tourist_tax_rate_id uuid references public.apartment_tourist_tax_rates (id) on delete set null,
  add column tax_person_nights integer check (tax_person_nights >= 0),
  add constraint booking_charges_tourist_tax_check check (tourist_tax or (tourist_tax_rate_id is null and tax_person_nights is null));
comment on column public.booking_charges.tourist_tax is 'Abgabe-Position der Ortstaxe (PROJ-15).';
comment on column public.booking_charges.tourist_tax_rate_id is 'Tarif-Eintrag der Abgabe-Position; null, wenn der Eintrag entfernt wurde.';
comment on column public.booking_charges.tax_person_nights is 'Abgabepflichtige Personennächte (Betrags-Tarife), Grundlage für PROJ-16.';
create index booking_charges_tourist_tax_rate_idx on public.booking_charges (tourist_tax_rate_id) where tourist_tax_rate_id is not null;

-- ---------------------------------------------------------------------------
-- Regeln
-- ---------------------------------------------------------------------------
-- Kleinunternehmer an einem Tag (PROJ-36): jüngster Eintrag am oder vor dem Tag, sonst „mit Umsatzsteuer“
create function private.small_business_on(p_tenant_id uuid, p_day date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select v.small_business from public.vat_status_changes v
    where v.tenant_id = p_tenant_id and v.valid_from <= p_day
    order by v.valid_from desc limit 1
  ), false);
$$;

-- Abgabe-Kennzeichen einer gesendeten Position: { rate_id, person_nights } oder null. Tarif nur, wenn er zum Kunden gehört.
create function private.tourist_tax_mark(p_tenant_id uuid, p_value jsonb)
returns table (tourist_tax boolean, rate_id uuid, person_nights integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p_value) is distinct from 'object' then
    return query select false, null::uuid, null::integer;
    return;
  end if;
  return query
  select true,
    (select r.id from public.apartment_tourist_tax_rates r
     where r.id = private.json_uuid(p_value ->> 'rate_id') and r.tenant_id = p_tenant_id),
    case when (p_value ->> 'person_nights') ~ '^[0-9]{1,6}$' then (p_value ->> 'person_nights')::integer end;
end;
$$;

-- Berechnungsgrundlage einer Buchung (ohne Tarife: Tarifänderungen ziehen nicht nach)
create function private.tourist_tax_basis(p_booking_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'apartment', b.apartment_id, 'arrival', b.arrival, 'departure', b.departure, 'planned', b.planned_departure,
    'adults', b.adults, 'children', b.child_ages, 'residence', b.residence_registered,
    'main_exempt', b.main_guest_tourist_tax_exempt, 'guest', b.guest_id,
    'guest_birth', (select g.birth_date from public.guests g where g.id = b.guest_id and g.tenant_id = b.tenant_id),
    'companions', (select coalesce(jsonb_agg(jsonb_build_array(c.birth_date, c.tourist_tax_exempt) order by c.position), '[]'::jsonb)
                   from public.booking_companions c where c.booking_id = b.id),
    'billed', a.billed_nights_cents, 'nights_vat', a.nights_vat_rate
  )
  from public.bookings b
  left join public.booking_amounts a on a.id = b.id
  where b.id = p_booking_id;
$$;

-- Gespeicherte Abgabe-Positionen zum Vergleichen (ohne Reihenfolge)
create function private.tourist_tax_rows(p_booking_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_array(c.label, c.amount_cents, c.vat_rate, c.tourist_tax_rate_id, c.tax_person_nights)
    order by c.label, c.amount_cents, c.vat_rate, c.tourist_tax_rate_id, c.tax_person_nights), '[]'::jsonb)
  from public.booking_charges c
  where c.booking_id = p_booking_id and c.tourist_tax;
$$;

-- Rechenregel (gleich src/lib/tourist-tax.ts): je berührtem Tarif-Eintrag eine Position, aufsteigend nach „gültig ab“.
-- Betrag pro Person und Nacht: tatsächliche Nächte; Personen = Erwachsene + Kinder; Hauptgast und Mitreisende mit
-- Häkchen zählen nie, mit Geburtsdatum unter der Altersgrenze an diesem Tag nicht; alle übrigen zahlen.
-- Prozent: abgerechnete Nächte (bis zur späteren Abreise), abgerechneter Übernachtungspreis gleichmäßig verteilt,
-- netto = brutto × 100 / (100 + USt der Übernachtung), bei Kleinunternehmern brutto; je Position auf Cent gerundet.
create function private.tourist_tax_lines(p_booking_id uuid)
returns table (rate_id uuid, valid_from date, label text, amount_cents integer, vat_rate numeric, person_nights integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_b public.bookings;
  v_persons integer;
  v_billed bigint;
  v_nights_vat numeric;
  v_billable integer;
  v_small boolean;
begin
  select * into v_b from public.bookings where id = p_booking_id;
  if v_b.id is null or v_b.kind = 'block' or v_b.residence_registered or v_b.arrival >= v_b.departure then
    return;
  end if;
  v_persons := coalesce(v_b.adults, 0) + cardinality(v_b.child_ages);
  select a.billed_nights_cents, a.nights_vat_rate into v_billed, v_nights_vat from public.booking_amounts a where a.id = v_b.id;
  v_billed := greatest(coalesce(v_billed, 0), 0);
  v_billable := greatest(v_b.departure, v_b.planned_departure) - v_b.arrival;
  v_small := private.small_business_on(v_b.tenant_id, v_b.departure);

  return query
  with people as (
    select p.birth_date, p.exempt
    from (
      select 0 as ord, (select g.birth_date from public.guests g where g.id = v_b.guest_id and g.tenant_id = v_b.tenant_id) as birth_date,
        v_b.main_guest_tourist_tax_exempt as exempt
      union all
      select c.position, c.birth_date, c.tourist_tax_exempt from public.booking_companions c where c.booking_id = v_b.id
    ) p
    order by p.ord
    limit v_persons
  ),
  rates as (
    select r.* from public.apartment_tourist_tax_rates r where r.apartment_id = v_b.apartment_id and r.tenant_id = v_b.tenant_id
  ),
  stay as (
    select (v_b.arrival + i) as day, r.id, r.valid_from, r.label, r.method, r.amount_cents, r.exempt_under_age, r.vat_rate
    from generate_series(0, v_b.departure - v_b.arrival - 1) i
    join lateral (select * from rates r where r.valid_from <= v_b.arrival + i order by r.valid_from desc limit 1) r on true
  ),
  per_person as (
    select s.id, s.valid_from, s.label, s.vat_rate, max(s.amount_cents) as amount_cents,
      sum(
        greatest(v_persons - (select count(*) from people), 0)
        + (select count(*) from people p
           where not p.exempt
             and not (s.exempt_under_age is not null and p.birth_date is not null
                      and extract(year from age(s.day, p.birth_date)) < s.exempt_under_age))
      )::integer as person_nights
    from stay s
    where s.method = 'per_person_night'
    group by s.id, s.valid_from, s.label, s.vat_rate
  ),
  billed as (
    select r.id, r.valid_from, r.label, r.vat_rate, r.percent_rate, r.base, count(*)::integer as nights
    from generate_series(0, v_billable - 1) i
    join lateral (select * from rates r where r.valid_from <= v_b.arrival + i order by r.valid_from desc limit 1) r on true
    where r.method = 'percent'
    group by r.id, r.valid_from, r.label, r.vat_rate, r.percent_rate, r.base
  ),
  percent as (
    select x.id, x.valid_from, x.label, x.vat_rate,
      round(
        (v_billed::numeric * x.nights * (x.percent_rate * 100) * case when x.net then 10000 else 1 end)
        / (v_billable::numeric * 10000 * case when x.net then 10000 + coalesce(v_nights_vat, 10) * 100 else 1 end)
      )::integer as amount_cents
    from (select bl.*, bl.base = 'net' and not v_small as net from billed bl) x
    where v_billable > 0
  )
  select pp.id, pp.valid_from, pp.label, pp.person_nights * pp.amount_cents, pp.vat_rate, pp.person_nights
  from per_person pp where pp.person_nights * pp.amount_cents > 0
  union all
  select pc.id, pc.valid_from, pc.label, pc.amount_cents, pc.vat_rate, null::integer
  from percent pc where pc.amount_cents > 0
  order by 2;
end;
$$;

-- Abgabe-Positionen einer Buchung durch die berechneten ersetzen: an der Stelle der bisherigen ersten, sonst am Ende;
-- übrige Positionen behalten ihre Reihenfolge. Bisherige Kennungen werden der Reihe nach weiterverwendet (Verknüpfung
-- mit Rechnungsentwürfen, PROJ-40).
create function private.apply_tourist_tax(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_lines jsonb;
  v_old uuid[];
  v_n integer;
  v_at integer;
  v_line jsonb;
  i integer;
begin
  select tenant_id into v_tenant from public.bookings where id = p_booking_id;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.valid_from), '[]'::jsonb) into v_lines from private.tourist_tax_lines(p_booking_id) l;
  v_n := jsonb_array_length(v_lines);
  select coalesce(array_agg(c.id order by c.position, c.id), '{}') into v_old
  from public.booking_charges c where c.booking_id = p_booking_id and c.tourist_tax;
  select count(*) into v_at
  from public.booking_charges c
  where c.booking_id = p_booking_id and not c.tourist_tax
    and (cardinality(v_old) = 0
      or c.position < (select min(t.position) from public.booking_charges t where t.booking_id = p_booking_id and t.tourist_tax));

  delete from public.booking_charges where id = any (v_old[v_n + 1:]);

  update public.booking_charges c
  set position = case when x.rn <= v_at then x.rn else x.rn + v_n end
  from (
    select o.id, row_number() over (order by o.position, o.id)::integer as rn
    from public.booking_charges o where o.booking_id = p_booking_id and not o.tourist_tax
  ) x
  where c.id = x.id and c.position is distinct from (case when x.rn <= v_at then x.rn else x.rn + v_n end);

  for i in 0 .. v_n - 1 loop
    v_line := v_lines -> i;
    if i < cardinality(v_old) then
      update public.booking_charges c set
        position = v_at + i + 1,
        label = v_line ->> 'label',
        amount_cents = (v_line ->> 'amount_cents')::integer,
        vat_rate = (v_line ->> 'vat_rate')::numeric,
        tourist_tax_rate_id = (v_line ->> 'rate_id')::uuid,
        tax_person_nights = (v_line ->> 'person_nights')::integer
      where c.id = v_old[i + 1]
        and (c.position, c.label, c.amount_cents, c.vat_rate, c.tourist_tax_rate_id, c.tax_person_nights) is distinct from (
          v_at + i + 1, v_line ->> 'label', (v_line ->> 'amount_cents')::integer, (v_line ->> 'vat_rate')::numeric,
          (v_line ->> 'rate_id')::uuid, (v_line ->> 'person_nights')::integer);
    else
      insert into public.booking_charges (tenant_id, booking_id, position, label, amount_cents, vat_rate,
        tourist_tax, tourist_tax_rate_id, tax_person_nights)
      values (v_tenant, p_booking_id, v_at + i + 1, v_line ->> 'label', (v_line ->> 'amount_cents')::integer,
        (v_line ->> 'vat_rate')::numeric, true, (v_line ->> 'rate_id')::uuid, (v_line ->> 'person_nights')::integer);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tarife speichern (Liste als Ganzes; unveränderte Einträge bleiben unberührt)
-- ---------------------------------------------------------------------------
create function private.save_tourist_tax_rates(p_apartment_id uuid, p_rates jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_apartment public.apartments;
begin
  select * into v_apartment from public.apartments where id = p_apartment_id for update;
  if v_apartment.id is null or not private.has_role(v_apartment.tenant_id, 'owner') then
    raise exception 'Keine Berechtigung für diese Wohnung.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rates) is distinct from 'array' or jsonb_array_length(p_rates) > 50 then
    raise exception 'Ungültige Tarifliste.' using errcode = '22023';
  end if;

  create temporary table pg_temp.tourist_tax_input on commit drop as
  select
    (select r.id from public.apartment_tourist_tax_rates r
     where r.id = private.json_uuid(e ->> 'id') and r.apartment_id = p_apartment_id) as id,
    (e ->> 'valid_from')::date as valid_from,
    btrim(e ->> 'label') as label,
    e ->> 'method' as method,
    (e ->> 'amount_cents')::integer as amount_cents,
    private.vat_rate(e ->> 'percent_rate', false) as percent_rate,
    nullif(e ->> 'base', '') as base,
    (e ->> 'exempt_under_age')::integer as exempt_under_age,
    private.vat_rate(e ->> 'vat_rate') as vat_rate
  from jsonb_array_elements(p_rates) e;

  delete from public.apartment_tourist_tax_rates r
  where r.apartment_id = p_apartment_id
    and not exists (select 1 from pg_temp.tourist_tax_input i where i.id = r.id);

  update public.apartment_tourist_tax_rates r set
    valid_from = i.valid_from, label = i.label, method = i.method, amount_cents = i.amount_cents,
    percent_rate = i.percent_rate, base = i.base, exempt_under_age = i.exempt_under_age, vat_rate = i.vat_rate
  from pg_temp.tourist_tax_input i
  where r.id = i.id
    and (r.valid_from, r.label, r.method, r.amount_cents, r.percent_rate, r.base, r.exempt_under_age, r.vat_rate)
      is distinct from (i.valid_from, i.label, i.method, i.amount_cents, i.percent_rate, i.base, i.exempt_under_age, i.vat_rate);

  insert into public.apartment_tourist_tax_rates (tenant_id, apartment_id, valid_from, label, method, amount_cents,
    percent_rate, base, exempt_under_age, vat_rate)
  select v_apartment.tenant_id, p_apartment_id, i.valid_from, i.label, i.method, i.amount_cents, i.percent_rate, i.base,
    i.exempt_under_age, i.vat_rate
  from pg_temp.tourist_tax_input i where i.id is null;

  drop table pg_temp.tourist_tax_input;
  -- Doppelte Daten prüft die Regel apartment_tourist_tax_rates_apartment_day_key hier statt erst am Ende
  set constraints public.apartment_tourist_tax_rates_apartment_day_key immediate;
end;
$$;

create function public.save_tourist_tax_rates(p_apartment_id uuid, p_rates jsonb)
returns void
language sql security invoker set search_path = ''
as $$ select private.save_tourist_tax_rates(p_apartment_id, p_rates); $$;

-- ---------------------------------------------------------------------------
-- Buchung speichern und Mitreisende (Ortstaxe ergänzt)
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
      address_country, marketing_source, marketing_custom, company_name, company_vat_id, company_address_line1, company_address_line2,
      company_postal_code, company_city, company_country, note,
      title_prefix, title_suffix, gender, document_type, document_number, document_issued_on, document_authority,
      document_country, document_front_path, document_back_path
    ) values (
      v_tenant, v_new_guest ->> 'last_name', v_new_guest ->> 'first_name', v_new_guest ->> 'country',
      v_new_guest ->> 'email', v_new_guest ->> 'phone', v_new_guest ->> 'language',
      (v_new_guest ->> 'birth_date')::date, v_new_guest ->> 'street', v_new_guest ->> 'postal_code',
      v_new_guest ->> 'city', v_new_guest ->> 'address_country', v_new_guest ->> 'marketing_source',
      v_new_guest ->> 'marketing_custom', v_new_guest ->> 'company_name', v_new_guest ->> 'company_vat_id',
      v_new_guest ->> 'company_address_line1', v_new_guest ->> 'company_address_line2',
      v_new_guest ->> 'company_postal_code', v_new_guest ->> 'company_city', v_new_guest ->> 'company_country',
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
      note, override_at, override_by, price_review, tourist_tax_mode, main_guest_tourist_tax_exempt
    ) values (
      v_tenant, v_apartment.id, v_kind, extract(year from v_arrival)::integer, v_seq, v_arrival, v_planned, v_departure,
      -- ohne Angabe die Zeiten der Wohnung
      coalesce((p_input ->> 'check_in')::time, v_apartment.check_in),
      coalesce((p_input ->> 'check_out')::time, v_apartment.check_out),
      v_guest_id, v_adults, v_child_ages, v_option_until, v_sheet, v_residence, v_source, v_source_custom,
      nullif(btrim(p_input ->> 'note'), ''),
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
        -- Satz der Reinigung 10 % (PROJ-35); die Übernachtung erhält den Standard 10 %
        insert into public.booking_charges (tenant_id, booking_id, position, label, amount_cents, vat_rate)
        values (v_tenant, v_id, 1, 'Reinigung', v_apartment.cleaning_fee_cents, 10.00);
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
$$;


create or replace function private.save_companions(p_booking_id uuid, p_updated_at timestamptz, p_companions jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_basis jsonb;
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

  v_basis := private.tourist_tax_basis(p_booking_id);
  delete from public.booking_companions where booking_id = p_booking_id;
  -- PROJ-15: „Von der Ortstaxe befreit“ je Person
  insert into public.booking_companions (tenant_id, booking_id, position, first_name, last_name, birth_date, tourist_tax_exempt)
  select v_booking.tenant_id, p_booking_id, c.ord, btrim(c.value ->> 'first_name'), btrim(c.value ->> 'last_name'),
    nullif(c.value ->> 'birth_date', '')::date, coalesce((c.value ->> 'tourist_tax_exempt')::boolean, false)
  from jsonb_array_elements(coalesce(p_companions, '[]'::jsonb)) with ordinality as c(value, ord);
  -- Ortstaxe neu rechnen bzw. „Preis prüfen“ (wie beim Speichern der Buchung durch Mitarbeiter)
  if private.tourist_tax_basis(p_booking_id) is distinct from v_basis then
    if v_booking.tourist_tax_mode = 'auto' then
      perform private.apply_tourist_tax(p_booking_id);
    elsif v_booking.tourist_tax_mode = 'manual' and not private.has_role(v_booking.tenant_id, 'owner') then
      update public.bookings set price_review = true where id = p_booking_id;
    end if;
  end if;
  -- Stand der Buchung weiterzählen (Schutz vor Überschreiben im Formular)
  update public.bookings set updated_at = now() where id = p_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------
revoke execute on function private.small_business_on(uuid, date) from public, anon, authenticated;
revoke execute on function private.tourist_tax_mark(uuid, jsonb) from public, anon, authenticated;
revoke execute on function private.tourist_tax_basis(uuid) from public, anon, authenticated;
revoke execute on function private.tourist_tax_rows(uuid) from public, anon, authenticated;
revoke execute on function private.tourist_tax_lines(uuid) from public, anon, authenticated;
revoke execute on function private.apply_tourist_tax(uuid) from public, anon, authenticated;
revoke execute on function private.save_tourist_tax_rates(uuid, jsonb) from public, anon;
revoke execute on function public.save_tourist_tax_rates(uuid, jsonb) from public, anon;
grant execute on function private.save_tourist_tax_rates(uuid, jsonb) to authenticated;
grant execute on function public.save_tourist_tax_rates(uuid, jsonb) to authenticated;
