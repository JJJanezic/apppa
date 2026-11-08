-- PROJ-16: Ortstaxen-Berichte
-- * Rechenkern private.tourist_tax_parts: die Verteilung der Ortstaxe aus PROJ-14 (ganze Personennächte über die
--   vereinnahmten Nächte, sonst anteilig in Cent) je Position und Monat, zusätzlich mit Nächten und Personennächten.
--   Unverändert übernommen aus 20261107222638_dashboard_tourist_tax_units.sql.
-- * private.tourist_tax_monthly (Dashboard) summiert nur noch den Kern: gleiche Ergebnisse wie bisher.
-- * private.tourist_tax_report (Bericht): je Buchung und Gemeinde Betrag, Personennächte, befreite Personennächte und
--   Kennzeichen im Zeitraum. Nur Inhaber (Prüfung im Kern).

create function private.tourist_tax_parts(p_tenant_ids uuid[], p_from date, p_to date)
returns table (
  tenant_id uuid,
  booking_id uuid,
  charge_id uuid,
  municipality_code text,
  month date,
  cents bigint,
  -- Nächte des Verteilzeitraums in diesem Monat
  nights integer,
  -- Personennächte in diesem Monat; null, wenn der Betrag kein Vielfaches des Tarifs je Person und Nacht ist
  person_nights integer,
  -- 'rate' (Tarif je Person und Nacht), 'percent' (Prozent-Tarif), 'legacy' (ohne Tarif-Verweis: Alt-Position)
  kind text
)
language sql
stable
security definer
set search_path = ''
as $$
  with owned as (
    select t.id from unnest(p_tenant_ids) as t(id) where private.has_role(t.id, 'owner')
  ),
  charges as (
    select
      c.tenant_id,
      c.id as charge_id,
      c.booking_id,
      c.amount_cents::bigint as amount,
      b.arrival,
      b.apartment_id,
      p.municipality_code,
      r.id as rate_id,
      r.method as rate_method,
      r.valid_from as rate_from,
      case when r.method = 'per_person_night' then r.amount_cents end as rate_unit,
      -- Ende der vereinnahmten Nächte: mit Tarif die tatsächliche Abreise, ohne Tarif die spätere Abreise
      case when r.id is null then greatest(b.departure, b.planned_departure) else b.departure end as stay_end,
      (select min(n.valid_from) from public.apartment_tourist_tax_rates n
        where n.apartment_id = r.apartment_id and n.tenant_id = r.tenant_id and n.valid_from > r.valid_from) as rate_until
    from public.booking_charges c
    join owned o on o.id = c.tenant_id
    join public.bookings b on b.id = c.booking_id and b.tenant_id = c.tenant_id
    join public.apartments ap on ap.id = b.apartment_id
    join public.properties p on p.id = ap.property_id
    left join public.apartment_tourist_tax_rates r on r.id = c.tourist_tax_rate_id
    where c.tourist_tax
      and b.kind = 'booking'
      and b.cancelled_at is null
      and b.arrival <= p_to
      and greatest(b.departure, b.planned_departure, b.arrival + 1) > p_from
  ),
  spans as (
    -- Verteilzeitraum: Schnitt aus vereinnahmten Nächten und Tarifzeitraum; ohne Tarif oder ohne Schnitt die ganzen Nächte
    select ch.tenant_id, ch.charge_id, ch.booking_id, ch.amount, ch.municipality_code, ch.apartment_id, ch.rate_id,
      ch.rate_method, ch.rate_unit,
      case when s.span_end > s.span_start then s.span_start else ch.arrival end as start_day,
      greatest(case when s.span_end > s.span_start then s.span_end else ch.stay_end end
               - case when s.span_end > s.span_start then s.span_start else ch.arrival end, 0) as nights
    from charges ch
    cross join lateral (
      select
        case when ch.rate_from is null then null else greatest(ch.arrival, ch.rate_from) end as span_start,
        case when ch.rate_from is null then null else least(ch.stay_end, coalesce(ch.rate_until, ch.stay_end)) end as span_end
    ) s
  ),
  units as (
    -- Einheit: Tarif der Position; ohne Tarif-Verweis der Personen-Tarif der Wohnung am ersten Tag
    select sp.*, u.unit,
      case when sp.nights > 0 and u.unit > 0 and sp.amount > 0 and sp.amount % u.unit = 0 then sp.amount / u.unit end as total_person_nights
    from spans sp
    cross join lateral (
      select case
        when sp.rate_id is not null then sp.rate_unit
        else (select r2.amount_cents from public.apartment_tourist_tax_rates r2
              where r2.apartment_id = sp.apartment_id and r2.method = 'per_person_night' and r2.valid_from <= sp.start_day
              order by r2.valid_from desc limit 1)
      end as unit
    ) u
  ),
  parts as (
    select
      un.tenant_id, un.charge_id, un.booking_id, un.municipality_code, un.rate_id, un.rate_method,
      m.month::date as month,
      un.amount, un.nights, un.unit, un.total_person_nights,
      -- Nächte vor Monatsbeginn bzw. bis Monatsende (begrenzt auf den Verteilzeitraum)
      least(greatest(m.month::date - un.start_day, 0), un.nights) as j0,
      least(greatest((m.month + interval '1 month')::date - un.start_day, 0), un.nights) as j1
    from units un
    cross join lateral generate_series(
      date_trunc('month', un.start_day::timestamp),
      date_trunc('month', (un.start_day + greatest(un.nights - 1, 0))::timestamp),
      interval '1 month'
    ) as m(month)
  ),
  person_nights as (
    -- ganze Personennächte: bis Nacht j aufgelaufen = q·j + Rest-Nächte am Ende (q = Personennächte je Nacht, Rest r)
    select pa.*,
      case
        when pa.nights = 0 then 0
        when pa.total_person_nights is not null then
            ((pa.total_person_nights / pa.nights) * pa.j1 + greatest(0, pa.j1 - (pa.nights - pa.total_person_nights % pa.nights)))
          - ((pa.total_person_nights / pa.nights) * pa.j0 + greatest(0, pa.j0 - (pa.nights - pa.total_person_nights % pa.nights)))
      end as month_person_nights
    from parts pa
  )
  select
    pn.tenant_id,
    pn.booking_id,
    pn.charge_id,
    pn.municipality_code,
    pn.month,
    (case
      when pn.nights = 0 then pn.amount
      when pn.total_person_nights is not null then pn.unit * pn.month_person_nights
      -- sonst anteilig in Cent (aufgelaufen, gerundet)
      else round(pn.amount::numeric * pn.j1 / pn.nights) - round(pn.amount::numeric * pn.j0 / pn.nights)
    end)::bigint as cents,
    (pn.j1 - pn.j0)::integer as nights,
    pn.month_person_nights::integer as person_nights,
    case when pn.rate_id is null then 'legacy' when pn.rate_method = 'per_person_night' then 'rate' else 'percent' end as kind
  from person_nights pn
  where pn.month between date_trunc('month', p_from::timestamp)::date and p_to;
$$;

-- Dashboard (PROJ-14): Summe des Kerns je Kunde, Gemeinde und Monat (Ergebnis wie bisher)
create or replace function private.tourist_tax_monthly(p_tenant_ids uuid[], p_from date, p_to date)
returns table (tenant_id uuid, municipality_id text, municipality_name text, month date, amount_cents bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select pt.tenant_id, pt.municipality_code, mu.name, pt.month, sum(pt.cents)::bigint
  from private.tourist_tax_parts(p_tenant_ids, p_from, p_to) pt
  join public.municipalities mu on mu.code = pt.municipality_code
  group by pt.tenant_id, pt.municipality_code, mu.name, pt.month;
$$;

-- Bericht (PROJ-16): je Buchung und Gemeinde die Werte im Zeitraum
create function private.tourist_tax_report(p_tenant_id uuid, p_from date, p_to date)
returns table (
  booking_id uuid,
  booking_number text,
  guest_last_name text,
  guest_first_name text,
  guest_anonymized boolean,
  property_name text,
  apartment_name text,
  municipality_id text,
  municipality_name text,
  arrival date,
  departure date,
  persons integer,
  amount_cents bigint,
  taxable_person_nights integer,
  known_taxable_person_nights integer,
  exempt_person_nights integer,
  unknown_positions integer,
  partial boolean,
  legacy boolean,
  percent boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with agg as (
    select
      pt.booking_id,
      pt.municipality_code,
      sum(pt.cents)::bigint as amount,
      coalesce(sum(pt.person_nights), 0)::integer as known_pn,
      -- Positionen ohne bekannte Personennächte (Alt-Position, Prozent-Tarif, frei geänderter Betrag)
      count(distinct pt.charge_id) filter (where pt.person_nights is null)::integer as unknown,
      bool_or(pt.kind = 'legacy') as any_legacy,
      bool_or(pt.kind = 'legacy' and pt.person_nights is null) as legacy_unknown,
      bool_or(pt.kind = 'percent') as any_percent,
      -- Nächte der Verteilzeiträume im Zeitraum (Grundlage der befreiten Personennächte)
      sum(pt.nights)::integer as span_nights
    from private.tourist_tax_parts(array[p_tenant_id], p_from, p_to) pt
    group by pt.booking_id, pt.municipality_code
  )
  select
    b.id,
    b.number,
    g.last_name,
    g.first_name,
    g.anonymized_at is not null,
    pr.name,
    ap.name,
    a.municipality_code,
    mu.name,
    b.arrival,
    b.departure,
    pe.persons,
    a.amount,
    case when a.unknown = 0 then a.known_pn end,
    a.known_pn,
    -- Personen × Nächte des Verteilzeitraums minus abgabepflichtige Personennächte; nur wenn alles bekannt, nie unter 0
    case when a.unknown = 0 and not a.any_legacy then greatest(pe.persons * a.span_nights - a.known_pn, 0) end,
    a.unknown,
    b.arrival < p_from or b.departure > p_to + 1,
    a.legacy_unknown,
    a.any_percent
  from agg a
  join public.bookings b on b.id = a.booking_id
  join public.apartments ap on ap.id = b.apartment_id
  join public.properties pr on pr.id = ap.property_id
  join public.municipalities mu on mu.code = a.municipality_code
  left join public.guests g on g.id = b.guest_id
  cross join lateral (select (coalesce(b.adults, 0) + coalesce(cardinality(b.child_ages), 0))::integer as persons) pe
  order by mu.name, b.arrival, b.number_year, b.number_seq;
$$;

create function public.tourist_tax_report(p_tenant_id uuid, p_from date, p_to date)
returns table (
  booking_id uuid,
  booking_number text,
  guest_last_name text,
  guest_first_name text,
  guest_anonymized boolean,
  property_name text,
  apartment_name text,
  municipality_id text,
  municipality_name text,
  arrival date,
  departure date,
  persons integer,
  amount_cents bigint,
  taxable_person_nights integer,
  known_taxable_person_nights integer,
  exempt_person_nights integer,
  unknown_positions integer,
  partial boolean,
  legacy boolean,
  percent boolean
)
language sql stable security invoker set search_path = ''
as $$ select * from private.tourist_tax_report(p_tenant_id, p_from, p_to); $$;

-- Rechte: der Kern nur intern (über die Definer-Funktionen), der Bericht wie das Dashboard für angemeldete Personen
revoke execute on function private.tourist_tax_parts(uuid[], date, date) from public, anon, authenticated;
revoke execute on function private.tourist_tax_report(uuid, date, date) from public, anon;
revoke execute on function public.tourist_tax_report(uuid, date, date) from public, anon;
grant execute on function private.tourist_tax_report(uuid, date, date) to authenticated;
grant execute on function public.tourist_tax_report(uuid, date, date) to authenticated;
