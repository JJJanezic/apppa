-- PROJ-18 Erweiterung (refine 2026-11-08): Auswertungen über mehrere Kunden auf einmal, je Zeile mit Kunde.
--
-- Die Rechenkerne aus 20261108100012_statistics rechnen bereits über mehrere Kunden (nur solche, bei denen die Person
-- Inhaber ist). Neu sind zwei Lesefunktionen, die Seite und Exporte für alle Inhaber-Kunden bzw. einen davon nutzen.
-- statistics_rows und statistics_origin bleiben bestehen: Beim Ausliefern kommt die Datenbank vor dem Code, und die noch
-- laufende alte App-Version ruft sie bis zum Code-Wechsel auf. Sie werden in einer späteren Migration entfernt.

-- Je Kunde, Wohnung und Monat: Zeitraum und dieselben Monate des Vorjahres
create function private.statistics_tenant_rows(p_tenant_ids uuid[], p_from date, p_to date)
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
  select r.tenant_id, r.apartment_id, r.month, r.available_nights, r.occupied_nights, r.blocked_nights, r.revenue_cents,
    r.revenue_vat_cents, r.fee_cents, r.fee_vat_cents, r.guest_nights, r.arrivals, r.bookings, r.stay_nights
  from private.statistics_apartment_months(p_tenant_ids, private.statistics_months(p_from, p_to)) r
  order by r.month, r.tenant_id, r.apartment_id;
$$;

-- Gästeherkunft je Kunde, Wohnung, Land und Zeitraum (gewählter Zeitraum bzw. Vorjahr)
create function private.statistics_tenant_origin(p_tenant_ids uuid[], p_from date, p_to date)
returns table (
  tenant_id uuid,
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
    p.tenant_id,
    p.apartment_id,
    p.country,
    p.month < date_trunc('month', p_from::timestamp)::date as previous,
    sum(p.arrivals)::integer,
    sum(p.guest_nights)::integer,
    sum(p.revenue_cents + p.fee_cents)::bigint
  from private.statistics_booking_parts(p_tenant_ids, private.statistics_months(p_from, p_to)) p
  group by p.tenant_id, p.apartment_id, p.country, p.month < date_trunc('month', p_from::timestamp)::date
  order by 1, 2, 3, 4;
$$;

-- Öffentliche Aufrufe mit den Rechten der Person; die Prüfung liegt in den privaten Funktionen und Kernen
create function public.statistics_tenant_rows(p_tenant_ids uuid[], p_from date, p_to date)
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
language sql stable security invoker set search_path = ''
as $$ select * from private.statistics_tenant_rows(p_tenant_ids, p_from, p_to); $$;

create function public.statistics_tenant_origin(p_tenant_ids uuid[], p_from date, p_to date)
returns table (
  tenant_id uuid,
  apartment_id uuid,
  country text,
  previous boolean,
  arrivals integer,
  guest_nights integer,
  revenue_cents bigint
)
language sql stable security invoker set search_path = ''
as $$ select * from private.statistics_tenant_origin(p_tenant_ids, p_from, p_to); $$;

revoke execute on function private.statistics_tenant_rows(uuid[], date, date) from public, anon;
revoke execute on function private.statistics_tenant_origin(uuid[], date, date) from public, anon;
revoke execute on function public.statistics_tenant_rows(uuid[], date, date) from public, anon;
revoke execute on function public.statistics_tenant_origin(uuid[], date, date) from public, anon;
grant execute on function private.statistics_tenant_rows(uuid[], date, date) to authenticated;
grant execute on function private.statistics_tenant_origin(uuid[], date, date) to authenticated;
grant execute on function public.statistics_tenant_rows(uuid[], date, date) to authenticated;
grant execute on function public.statistics_tenant_origin(uuid[], date, date) to authenticated;
