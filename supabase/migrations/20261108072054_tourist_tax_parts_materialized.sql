-- PROJ-16 Leistung: Zwischenschritte des Rechenkerns einmal berechnen (materialized)
-- Ohne diese Angabe setzt PostgreSQL die Zwischenschritte ineinander ein und vervielfacht dabei die Abfrage nach dem Ende
-- des Tarifzeitraums (je Position hunderte Teilabfragen). Gemessen auf Dev mit 5.000 Ortstaxe-Positionen eines Kunden,
-- ganzes Jahr: 2.200 ms → 63 ms. Ergebnis unverändert; gilt für Bericht und Dashboard (beide nutzen den Kern).

create or replace function private.tourist_tax_parts(p_tenant_ids uuid[], p_from date, p_to date)
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
  charges as materialized (
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
  spans as materialized (
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
  units as materialized (
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

revoke execute on function private.tourist_tax_parts(uuid[], date, date) from public, anon, authenticated;
