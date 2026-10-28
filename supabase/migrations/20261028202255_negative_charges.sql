-- PROJ-32: Negative Beträge bei Zusatzkosten (Rabatt, Gutschrift).
-- Zusatzkosten-Positionen von -1.000.000,00 bis 1.000.000,00 € (in Cent). Übernachtungspreis (vereinbart und
-- abgerechnet), Stornogebühr und Wohnungspreise bleiben ab 0. Der Endbetrag wird nicht gespeichert und darf
-- dadurch unter 0 fallen. Bestehende Positionen sind alle ≥ 0, keine Datenmigration nötig.

alter table public.booking_charges drop constraint booking_charges_amount_cents_check;
alter table public.booking_charges
  add constraint booking_charges_amount_cents_check check (amount_cents between -100000000 and 100000000);

comment on column public.booking_charges.amount_cents is
  'Betrag der Position in Cent, -1.000.000,00 bis 1.000.000,00 € (negativ = Rabatt/Gutschrift, PROJ-32).';
