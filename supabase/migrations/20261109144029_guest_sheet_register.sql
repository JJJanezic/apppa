-- PROJ-26, Überarbeitung Liste „Gästeblätter“ (refine 2026-11-09):
-- * guest_sheet_register: Buchungen mit Gästeblattnummer (Art „Buchung“, nicht storniert, ohne „Wohnsitz angemeldet“)
--   mit dem aktuellen Blatt, falls vorhanden; Sortierwerte für „absteigend nach der Zahl am Ende der Nummer“.
-- * guest_sheet_missing neu: Buchungen ohne Gästeblattnummer (bisher: ohne Blatt), dazu Wohnung und Gast-Kennung.
-- Beide mit den Rechten der lesenden Person (RLS von Buchungen, Gästen, Blättern, Wohnungen).

create view public.guest_sheet_register
with (security_invoker = true)
as
select
  b.id as booking_id,
  b.tenant_id,
  b.number as booking_number,
  b.guest_sheet_number as sheet_number,
  -- Zahl am Ende (Nummern ohne Ziffer am Ende: null, stehen zuletzt), Vorsatz ohne Groß-/Kleinschreibung
  case when b.guest_sheet_number ~ '[0-9]$' then substring(b.guest_sheet_number from '([0-9]+)$')::numeric end as sort_value,
  lower(coalesce(substring(b.guest_sheet_number from '^(.*?)[0-9]+$'), b.guest_sheet_number)) as sort_prefix,
  s.id as sheet_id,
  s.kind as sheet_kind,
  b.guest_id,
  g.anonymized_at is not null as guest_anonymized,
  g.last_name,
  g.first_name,
  g.title_prefix,
  g.title_suffix,
  b.arrival,
  b.departure,
  b.apartment_id,
  p.name as property_name,
  a.name as apartment_name,
  concat_ws(' ', b.guest_sheet_number, b.number, g.last_name, g.first_name) as search_text
from public.bookings b
join public.apartments a on a.id = b.apartment_id
join public.properties p on p.id = a.property_id
left join public.guests g on g.id = b.guest_id
left join public.guest_sheets s on s.booking_id = b.id and s.replaced_at is null
where b.kind = 'booking' and b.cancelled_at is null and not b.residence_registered and b.guest_sheet_number is not null;

drop view public.guest_sheet_missing;

create view public.guest_sheet_missing
with (security_invoker = true)
as
select
  b.id as booking_id,
  b.tenant_id,
  b.number as booking_number,
  b.arrival,
  b.departure,
  b.apartment_id,
  b.guest_id,
  g.anonymized_at is not null as guest_anonymized,
  g.last_name,
  g.first_name,
  g.title_prefix,
  g.title_suffix,
  p.name as property_name,
  a.name as apartment_name,
  concat_ws(' ', b.number, g.last_name, g.first_name) as search_text
from public.bookings b
join public.apartments a on a.id = b.apartment_id
join public.properties p on p.id = a.property_id
left join public.guests g on g.id = b.guest_id
where b.kind = 'booking' and b.cancelled_at is null and not b.residence_registered and b.guest_sheet_number is null;

revoke all on public.guest_sheet_register, public.guest_sheet_missing from anon;
grant select on public.guest_sheet_register, public.guest_sheet_missing to authenticated;
