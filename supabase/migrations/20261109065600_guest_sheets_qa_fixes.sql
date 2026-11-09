-- PROJ-26 QA-Korrekturen
-- BUG-3: Nach dem Anonymisieren eines Gastes zeigte ein unterschriebenes Blatt „Buchung nach der Unterschrift geändert“, weil
-- das Anonymisieren die Mitreisenden der Buchung entfernt. Die Lesesicht vergleicht die Mitreisenden nur bei nicht
-- anonymisiertem Gast. Sonst unverändert gegenüber 20261109055811_guest_sheets.sql.

create or replace view public.guest_sheet_list
with (security_invoker = true)
as
select
  s.id,
  s.tenant_id,
  s.booking_id,
  s.guest_id,
  s.kind,
  s.sheet_number,
  s.marketing_consent,
  s.snapshot,
  s.signature_1_path,
  s.signature_2_path,
  s.pdf_path,
  s.signed_at_2 as signed_at,
  s.signed_on,
  s.replaced_at,
  s.departure_noted_at,
  s.created_at,
  cp.display_name as created_by_name,
  np.display_name as departure_noted_by_name,
  b.number as booking_number,
  b.cancelled_at is not null as booking_cancelled,
  b.arrival,
  b.departure,
  g.last_name,
  g.first_name,
  g.title_prefix,
  g.title_suffix,
  p.name as property_name,
  a.name as apartment_name,
  -- Buchung nach der Unterschrift geändert: Ankunft, geplante Abreise, Hauptgast oder Mitreisende weichen ab (Gastdaten nicht)
  coalesce(s.kind = 'signed' and (
    s.snapshot -> 'stay' ->> 'arrival' is distinct from b.arrival::text
    or s.snapshot -> 'stay' ->> 'plannedDeparture' is distinct from b.planned_departure::text
    or s.guest_id is distinct from b.guest_id
    -- Anonymisieren entfernt die Mitreisenden der Buchung (PROJ-7); das ist keine Änderung der Buchung (BUG-3 aus QA)
    or (g.anonymized_at is null and s.snapshot -> 'companions' is distinct from private.guest_sheet_companions(b.id))
  ), false) as changed,
  concat_ws(' ', s.sheet_number, b.number, g.last_name, g.first_name) as search_text
from public.guest_sheets s
join public.bookings b on b.id = s.booking_id
join public.apartments a on a.id = b.apartment_id
join public.properties p on p.id = a.property_id
left join public.guests g on g.id = s.guest_id
left join public.profiles cp on cp.id = s.created_by
left join public.profiles np on np.id = s.departure_noted_by;
