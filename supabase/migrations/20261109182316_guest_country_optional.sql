-- PROJ-7 (refine 2026-11-09): Staatsangehörigkeit des Gastes optional. booking.com meldet sie bei der ersten Verständigung
-- nicht; Buchung und Gast müssen trotzdem gespeichert werden können. Eingetragene Werte prüft die Tabelle weiter auf zwei
-- Großbuchstaben (die bestehende Prüfung lässt „keine Angabe“ zu).
-- Unverändert bleiben:
-- * Gästeblatt (PROJ-26): private.guest_sheet_complete verlangt die Staatsangehörigkeit weiter; ohne sie ist kein Blatt möglich.
-- * Gästeherkunft (PROJ-18): Herkunftsland der Adresse, sonst Staatsangehörigkeit, sonst „ZZ“ (in der App „Unbekannt“).
-- * Schreibende Funktionen (save_guest, save_booking mit neuem Gast, Rechnung nacherfassen, Zusammenführen) übernehmen
--   „keine Angabe“ unverändert; die App schickt nie leeren Text.
alter table public.guests alter column country drop not null;
