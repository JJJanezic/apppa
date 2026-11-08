-- PROJ-16: eindeutige Reihenfolge der Berichtszeilen (Buchungs-ID als letzter Schlüssel)
-- Die App lädt den Bericht seitenweise (die Datenschnittstelle liefert höchstens 1.000 Zeilen je Abruf). Ohne eindeutige
-- Reihenfolge könnten Zeilen mit gleicher Anreise und ohne Buchungsnummer doppelt oder gar nicht ankommen.

create or replace function private.tourist_tax_report(p_tenant_id uuid, p_from date, p_to date)
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
  order by mu.name, b.arrival, b.number_year, b.number_seq, b.id;
$$;
