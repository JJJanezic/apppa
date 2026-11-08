-- PROJ-18 Statistische Auswertungen: Rechenkern und Lesefunktionen (keine neuen Tabellen)
--
-- Regeln (Spec „Rechenregeln“):
-- * Belegt: Nächte aus Buchungen (Art „booking“, nicht storniert) von der Anreise bis zur tatsächlichen Abreise; eine Nacht
--   gehört zum Monat, in dem sie beginnt. Überschneiden sich Buchungen, zählt die Nacht einmal.
-- * Gesperrt: Nächte aus Sperren (nicht storniert), die nicht zugleich gebucht sind.
-- * Verfügbar: je Wohnung ab dem ersten Tag des Monats der ersten Buchung (sonst ab Anlage) bis zum Tag der Archivierung,
--   dazu belegte/gesperrte Nächte außerhalb dieses Zeitraums (Auslastung nie über 100 %), minus gesperrte Nächte.
-- * Umsatz: verrechneter Übernachtungspreis und Zusatzkosten ohne Ortstaxe, brutto, gleichmäßig je Nacht, Rest in der
--   letzten Nacht. Enthaltene USt je Buchung wie im Buchungsdetail (Brutto je Satz → USt auf den Cent), dann ebenso
--   verteilt; Kleinunternehmer am maßgeblichen Tag (Abreise bzw. Stornotag) → 0.
-- * Stornogebühr: im Monat der Anreise, mit eigenem Satz; keine Nächte.
-- * Gäste: Gästenächte = Personen × Nächte im Monat; Ankünfte und Buchungen nach Anreisemonat.
-- Alle Funktionen rechnen nur für Kunden, bei denen die Person Inhaber ist; sonst leer.

-- ---------------------------------------------------------------------------
-- Monate eines Zeitraums und dieselben Monate des Vorjahres (höchstens ein Jahr Zeitraum)
-- ---------------------------------------------------------------------------
create function private.statistics_months(p_from date, p_to date)
returns date[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(x.m order by x.m), '{}')
  from (
    select g::date as m
    from generate_series(date_trunc('month', p_from::timestamp), date_trunc('month', p_to::timestamp), interval '1 month') as g
    where p_from <= p_to and p_to - p_from <= 366
    union
    select (g - interval '1 year')::date
    from generate_series(date_trunc('month', p_from::timestamp), date_trunc('month', p_to::timestamp), interval '1 month') as g
    where p_from <= p_to and p_to - p_from <= 366
  ) as x;
$$;

-- ---------------------------------------------------------------------------
-- Kern 1: Beträge und Gäste je Buchung und Monat
-- ---------------------------------------------------------------------------
create function private.statistics_booking_parts(p_tenant_ids uuid[], p_months date[])
returns table (
  tenant_id uuid,
  apartment_id uuid,
  -- Herkunftsland des Hauptgasts; „ZZ“ ohne Hauptgast
  country text,
  month date,
  nights integer,
  revenue_cents bigint,
  revenue_vat_cents bigint,
  fee_cents bigint,
  fee_vat_cents bigint,
  guest_nights integer,
  arrivals integer,
  bookings integer,
  stay_nights integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with owned as (
    select t.id from unnest(p_tenant_ids) as t(id) where private.has_role(t.id, 'owner')
  ),
  bounds as (
    select min(m) as lo, (max(m) + interval '1 month')::date as hi from unnest(p_months) as m
  ),
  bk as materialized (
    select
      b.id,
      b.tenant_id,
      b.apartment_id,
      b.arrival,
      b.departure,
      b.cancelled_at,
      (coalesce(b.adults, 0) + coalesce(cardinality(b.child_ages), 0))::integer as persons,
      coalesce(g.country, 'ZZ') as country,
      (b.departure - b.arrival) as n,
      -- Kleinunternehmer am maßgeblichen Tag (PROJ-36): Stornotag in österreichischer Zeit, sonst die Abreise
      private.small_business_on(
        b.tenant_id,
        case when b.cancelled_at is null then b.departure else (b.cancelled_at at time zone 'Europe/Vienna')::date end
      ) as small
    from public.bookings b
    join owned o on o.id = b.tenant_id
    cross join bounds bo
    left join public.guests g on g.id = b.guest_id
    where b.kind = 'booking'
      and b.departure > b.arrival
      and b.arrival < bo.hi
      and b.departure > bo.lo
  ),
  lines as (
    -- Positionen für Umsatz und USt: verrechnete Übernachtung und Zusatzkosten ohne Ortstaxe
    select k.id, a.nights_vat_rate as rate, coalesce(a.billed_nights_cents, a.nights_cents)::bigint as amount
    from bk k
    join public.booking_amounts a on a.id = k.id
    where k.cancelled_at is null
    union all
    select k.id, c.vat_rate, c.amount_cents::bigint
    from bk k
    join public.booking_charges c on c.booking_id = k.id and c.tenant_id = k.tenant_id
    where k.cancelled_at is null and not c.tourist_tax
  ),
  per_rate as (
    select l.id, l.rate, sum(l.amount) as gross from lines l group by l.id, l.rate
  ),
  totals as materialized (
    select
      k.id, k.tenant_id, k.apartment_id, k.arrival, k.persons, k.country, k.n,
      coalesce(sum(r.gross), 0)::bigint as total,
      (case when k.small then 0 else coalesce(sum(round(r.gross::numeric * r.rate / (100 + r.rate))), 0) end)::bigint as vat
    from bk k
    left join per_rate r on r.id = k.id
    where k.cancelled_at is null
    group by k.id, k.tenant_id, k.apartment_id, k.arrival, k.persons, k.country, k.n, k.small
  ),
  parts as (
    select
      t.*,
      m.month::date as month,
      -- Nächte vor Monatsbeginn bzw. bis Monatsende
      least(greatest(m.month::date - t.arrival, 0), t.n) as j0,
      least(greatest((m.month + interval '1 month')::date - t.arrival, 0), t.n) as j1,
      date_trunc('month', t.arrival::timestamp)::date as arrival_month
    from totals t
    cross join lateral generate_series(
      date_trunc('month', t.arrival::timestamp),
      date_trunc('month', (t.arrival + t.n - 1)::timestamp),
      interval '1 month'
    ) as m(month)
  ),
  stays as (
    select
      p.tenant_id,
      p.apartment_id,
      p.country,
      p.month,
      (p.j1 - p.j0)::integer as nights,
      -- gleichmäßig je Nacht (ganzzahlig), der Rest in der letzten Nacht
      ((p.total / p.n) * (p.j1 - p.j0) + case when p.j1 = p.n then p.total - (p.total / p.n) * p.n else 0 end)::bigint as revenue_cents,
      ((p.vat / p.n) * (p.j1 - p.j0) + case when p.j1 = p.n then p.vat - (p.vat / p.n) * p.n else 0 end)::bigint as revenue_vat_cents,
      0::bigint as fee_cents,
      0::bigint as fee_vat_cents,
      (p.persons * (p.j1 - p.j0))::integer as guest_nights,
      (case when p.month = p.arrival_month then p.persons else 0 end)::integer as arrivals,
      (case when p.month = p.arrival_month then 1 else 0 end)::integer as bookings,
      (case when p.month = p.arrival_month then p.n else 0 end)::integer as stay_nights
    from parts p
    where p.month = any(p_months)
  ),
  fees as (
    -- Stornierte Buchungen mit Stornogebühr: im Monat der Anreise
    select
      k.tenant_id,
      k.apartment_id,
      k.country,
      date_trunc('month', k.arrival::timestamp)::date as month,
      0 as nights,
      0::bigint as revenue_cents,
      0::bigint as revenue_vat_cents,
      a.cancellation_fee_cents::bigint as fee_cents,
      (case when k.small then 0
        else round(a.cancellation_fee_cents::numeric * a.cancellation_fee_vat_rate / (100 + a.cancellation_fee_vat_rate)) end)::bigint as fee_vat_cents,
      0 as guest_nights,
      0 as arrivals,
      0 as bookings,
      0 as stay_nights
    from bk k
    join public.booking_amounts a on a.id = k.id
    where k.cancelled_at is not null
      and coalesce(a.cancellation_fee_cents, 0) <> 0
      and date_trunc('month', k.arrival::timestamp)::date = any(p_months)
  )
  select * from stays
  union all
  select * from fees;
$$;

-- ---------------------------------------------------------------------------
-- Kern 2: Nächte und Beträge je Wohnung und Monat
-- ---------------------------------------------------------------------------
create function private.statistics_apartment_months(p_tenant_ids uuid[], p_months date[])
returns table (
  tenant_id uuid,
  apartment_id uuid,
  month date,
  available_nights integer,
  occupied_nights integer,
  blocked_nights integer,
  revenue_cents bigint,
  revenue_vat_cents bigint,
  fee_cents bigint,
  fee_vat_cents bigint,
  guest_nights integer,
  arrivals integer,
  bookings integer,
  stay_nights integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with owned as (
    select t.id from unnest(p_tenant_ids) as t(id) where private.has_role(t.id, 'owner')
  ),
  months as (
    select distinct m::date as month from unnest(p_months) as m
  ),
  bounds as (
    select min(month) as lo, (max(month) + interval '1 month')::date as hi from months
  ),
  apts as materialized (
    -- Zählbeginn: erster Tag des Monats der ersten Buchung, sonst Tag der Anlage; Ende: Tag der Archivierung (exklusiv)
    select
      ap.id,
      ap.tenant_id,
      coalesce(
        (select date_trunc('month', min(b.arrival)::timestamp)::date
         from public.bookings b
         where b.apartment_id = ap.id and b.tenant_id = ap.tenant_id and b.kind = 'booking' and b.cancelled_at is null),
        (ap.created_at at time zone 'Europe/Vienna')::date
      ) as start_day,
      coalesce((ap.archived_at at time zone 'Europe/Vienna')::date, 'infinity'::date) as end_day
    from public.apartments ap
    join owned o on o.id = ap.tenant_id
  ),
  nights as materialized (
    -- Je Wohnung und Tag: gebucht (Buchung) oder nur gesperrt (Sperre); Doppelbuchungen zählen einmal
    select b.apartment_id, d::date as day, bool_or(b.kind = 'booking') as booked
    from public.bookings b
    join owned o on o.id = b.tenant_id
    cross join bounds bo
    cross join lateral generate_series(
      greatest(b.arrival, bo.lo)::timestamp,
      (least(b.departure, bo.hi) - 1)::timestamp,
      interval '1 day'
    ) as d
    where b.kind in ('booking', 'block')
      and b.cancelled_at is null
      and b.arrival < bo.hi
      and b.departure > bo.lo
    group by b.apartment_id, d::date
  ),
  night_months as (
    select
      n.apartment_id,
      date_trunc('month', n.day::timestamp)::date as month,
      (count(*) filter (where n.booked))::integer as occupied,
      (count(*) filter (where not n.booked))::integer as blocked,
      -- belegte/gesperrte Nächte außerhalb des Zählzeitraums der Wohnung
      (count(*) filter (where n.day < a.start_day or n.day >= a.end_day))::integer as outside
    from nights n
    join apts a on a.id = n.apartment_id
    group by n.apartment_id, date_trunc('month', n.day::timestamp)::date
  ),
  base as (
    select
      a.tenant_id,
      a.id as apartment_id,
      mo.month,
      greatest(0, least((mo.month + interval '1 month')::date, a.end_day) - greatest(mo.month, a.start_day))::integer as days
    from apts a
    cross join months mo
  ),
  money as (
    select
      p.apartment_id,
      p.month,
      sum(p.revenue_cents)::bigint as revenue_cents,
      sum(p.revenue_vat_cents)::bigint as revenue_vat_cents,
      sum(p.fee_cents)::bigint as fee_cents,
      sum(p.fee_vat_cents)::bigint as fee_vat_cents,
      sum(p.guest_nights)::integer as guest_nights,
      sum(p.arrivals)::integer as arrivals,
      sum(p.bookings)::integer as bookings,
      sum(p.stay_nights)::integer as stay_nights
    from private.statistics_booking_parts(p_tenant_ids, p_months) p
    group by p.apartment_id, p.month
  )
  select
    ba.tenant_id,
    ba.apartment_id,
    ba.month,
    (ba.days + coalesce(nm.outside, 0) - coalesce(nm.blocked, 0))::integer,
    coalesce(nm.occupied, 0),
    coalesce(nm.blocked, 0),
    coalesce(mo.revenue_cents, 0),
    coalesce(mo.revenue_vat_cents, 0),
    coalesce(mo.fee_cents, 0),
    coalesce(mo.fee_vat_cents, 0),
    coalesce(mo.guest_nights, 0),
    coalesce(mo.arrivals, 0),
    coalesce(mo.bookings, 0),
    coalesce(mo.stay_nights, 0)
  from base ba
  left join night_months nm on nm.apartment_id = ba.apartment_id and nm.month = ba.month
  left join money mo on mo.apartment_id = ba.apartment_id and mo.month = ba.month
  where ba.days > 0 or nm.apartment_id is not null or mo.apartment_id is not null;
$$;

-- ---------------------------------------------------------------------------
-- Lesefunktionen
-- ---------------------------------------------------------------------------

-- Seite und Exporte: je Wohnung und Monat, Zeitraum und dieselben Monate des Vorjahres
create function private.statistics_rows(p_tenant_id uuid, p_from date, p_to date)
returns table (
  apartment_id uuid,
  month date,
  available_nights integer,
  occupied_nights integer,
  blocked_nights integer,
  revenue_cents bigint,
  revenue_vat_cents bigint,
  fee_cents bigint,
  fee_vat_cents bigint,
  guest_nights integer,
  arrivals integer,
  bookings integer,
  stay_nights integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.apartment_id, r.month, r.available_nights, r.occupied_nights, r.blocked_nights, r.revenue_cents,
    r.revenue_vat_cents, r.fee_cents, r.fee_vat_cents, r.guest_nights, r.arrivals, r.bookings, r.stay_nights
  from private.statistics_apartment_months(array[p_tenant_id], private.statistics_months(p_from, p_to)) r
  order by r.month, r.apartment_id;
$$;

-- Gästeherkunft: je Wohnung, Land und Zeitraum (gewählter Zeitraum bzw. Vorjahr)
create function private.statistics_origin(p_tenant_id uuid, p_from date, p_to date)
returns table (
  apartment_id uuid,
  country text,
  previous boolean,
  arrivals integer,
  guest_nights integer,
  revenue_cents bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.apartment_id,
    p.country,
    p.month < date_trunc('month', p_from::timestamp)::date as previous,
    sum(p.arrivals)::integer,
    sum(p.guest_nights)::integer,
    sum(p.revenue_cents + p.fee_cents)::bigint
  from private.statistics_booking_parts(array[p_tenant_id], private.statistics_months(p_from, p_to)) p
  group by p.apartment_id, p.country, p.month < date_trunc('month', p_from::timestamp)::date
  order by 1, 2, 3;
$$;

-- Dashboard: Auslastung und Umsatz eines Monats je Kunde (nur Inhaber-Kunden)
create function private.dashboard_statistics(p_tenant_ids uuid[], p_month date)
returns table (
  tenant_id uuid,
  available_nights integer,
  occupied_nights integer,
  revenue_cents bigint,
  vat_cents bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.tenant_id,
    sum(r.available_nights)::integer,
    sum(r.occupied_nights)::integer,
    sum(r.revenue_cents + r.fee_cents)::bigint,
    sum(r.revenue_vat_cents + r.fee_vat_cents)::bigint
  from private.statistics_apartment_months(p_tenant_ids, array[date_trunc('month', p_month::timestamp)::date]) r
  group by r.tenant_id
  order by r.tenant_id;
$$;

-- Öffentliche Aufrufe (Datenschnittstelle) mit den Rechten der Person; die Prüfung liegt in den privaten Funktionen
create function public.statistics_rows(p_tenant_id uuid, p_from date, p_to date)
returns table (
  apartment_id uuid,
  month date,
  available_nights integer,
  occupied_nights integer,
  blocked_nights integer,
  revenue_cents bigint,
  revenue_vat_cents bigint,
  fee_cents bigint,
  fee_vat_cents bigint,
  guest_nights integer,
  arrivals integer,
  bookings integer,
  stay_nights integer
)
language sql stable security invoker set search_path = ''
as $$ select * from private.statistics_rows(p_tenant_id, p_from, p_to); $$;

create function public.statistics_origin(p_tenant_id uuid, p_from date, p_to date)
returns table (
  apartment_id uuid,
  country text,
  previous boolean,
  arrivals integer,
  guest_nights integer,
  revenue_cents bigint
)
language sql stable security invoker set search_path = ''
as $$ select * from private.statistics_origin(p_tenant_id, p_from, p_to); $$;

create function public.dashboard_statistics(p_tenant_ids uuid[], p_month date)
returns table (
  tenant_id uuid,
  available_nights integer,
  occupied_nights integer,
  revenue_cents bigint,
  vat_cents bigint
)
language sql stable security invoker set search_path = ''
as $$ select * from private.dashboard_statistics(p_tenant_ids, p_month); $$;

-- Rechte: die Kerne nur intern, die Lesefunktionen für angemeldete Personen (wie PROJ-16)
revoke execute on function private.statistics_months(date, date) from public, anon, authenticated;
revoke execute on function private.statistics_booking_parts(uuid[], date[]) from public, anon, authenticated;
revoke execute on function private.statistics_apartment_months(uuid[], date[]) from public, anon, authenticated;
revoke execute on function private.statistics_rows(uuid, date, date) from public, anon;
revoke execute on function private.statistics_origin(uuid, date, date) from public, anon;
revoke execute on function private.dashboard_statistics(uuid[], date) from public, anon;
revoke execute on function public.statistics_rows(uuid, date, date) from public, anon;
revoke execute on function public.statistics_origin(uuid, date, date) from public, anon;
revoke execute on function public.dashboard_statistics(uuid[], date) from public, anon;
grant execute on function private.statistics_rows(uuid, date, date) to authenticated;
grant execute on function private.statistics_origin(uuid, date, date) to authenticated;
grant execute on function private.dashboard_statistics(uuid[], date) to authenticated;
grant execute on function public.statistics_rows(uuid, date, date) to authenticated;
grant execute on function public.statistics_origin(uuid, date, date) to authenticated;
grant execute on function public.dashboard_statistics(uuid[], date) to authenticated;
