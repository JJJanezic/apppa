-- PROJ-14 Nachbesserung (BUG-9): Ortstaxe in ganzen Personennächten zum Tarif verteilen
-- Bisher wurde der Betrag einer Position anteilig in Cent auf die Nächte verteilt. Passt der Betrag nicht genau zu den
-- Nächten (z. B. Alt-Position für die vereinbarten Nächte, Gast reiste früher ab), entstanden Monatsbeträge, die keine
-- Vielfachen des Tarifs sind. Neu (Nutzerentscheidung):
-- * Verteilt wird über die Nächte, für die die Abgabe vereinnahmt wurde:
--   - Positionen mit Tarif-Verweis (automatisch berechnet, PROJ-15): Anreise bis tatsächliche Abreise, nur innerhalb des
--     Tarifzeitraums (wie bisher, BUG-8)
--   - Positionen ohne Tarif-Verweis (Alt-Positionen, gelöschter Tarif): Anreise bis zur späteren Abreise (geplant oder
--     tatsächlich); vereinnahmt ist abzuführen
-- * Einheit = Tarif je Person und Nacht (Tarif der Position bzw. bei Alt-Positionen der Tarif der Wohnung zu Beginn).
--   Ist der Betrag ein Vielfaches davon, werden ganze Personennächte verteilt: gleich viele je Nacht, der Rest in die
--   letzten Nächte. Monatsbeträge sind dann immer Vielfache des Tarifs.
-- * Sonst (Prozent-Tarif, frei geänderter Betrag, kein Tarif) wie bisher anteilig in Cent (aufgelaufen, gerundet).

create or replace function private.tourist_tax_monthly(p_tenant_ids uuid[], p_from date, p_to date)
returns table (tenant_id uuid, municipality_id text, municipality_name text, month date, amount_cents bigint)
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
      c.amount_cents::bigint as amount,
      b.arrival,
      b.apartment_id,
      p.municipality_code,
      r.id as rate_id,
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
    select ch.tenant_id, ch.amount, ch.municipality_code, ch.apartment_id, ch.rate_id, ch.rate_unit,
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
      case when sp.nights > 0 and u.unit > 0 and sp.amount > 0 and sp.amount % u.unit = 0 then sp.amount / u.unit end as person_nights
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
      un.tenant_id,
      un.municipality_code,
      m.month::date as month,
      un.amount, un.nights, un.unit, un.person_nights,
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
  cents as (
    select pa.tenant_id, pa.municipality_code, pa.month,
      case
        when pa.nights = 0 then pa.amount
        -- ganze Personennächte: bis Nacht j aufgelaufen = q·j + Rest-Nächte am Ende (q = Personennächte je Nacht, Rest r)
        when pa.person_nights is not null then pa.unit * (
            ((pa.person_nights / pa.nights) * pa.j1 + greatest(0, pa.j1 - (pa.nights - pa.person_nights % pa.nights)))
          - ((pa.person_nights / pa.nights) * pa.j0 + greatest(0, pa.j0 - (pa.nights - pa.person_nights % pa.nights))))
        -- sonst anteilig in Cent (aufgelaufen, gerundet)
        else round(pa.amount::numeric * pa.j1 / pa.nights) - round(pa.amount::numeric * pa.j0 / pa.nights)
      end as cents
    from parts pa
  )
  select ce.tenant_id, ce.municipality_code, mu.name, ce.month, sum(ce.cents)::bigint
  from cents ce
  join public.municipalities mu on mu.code = ce.municipality_code
  where ce.month between date_trunc('month', p_from::timestamp)::date and p_to
  group by ce.tenant_id, ce.municipality_code, mu.name, ce.month;
$$;
