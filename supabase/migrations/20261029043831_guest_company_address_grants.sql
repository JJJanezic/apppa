-- PROJ-33: Schreibrechte für die neuen Spalten der Firmenanschrift (Gäste vergeben Rechte spaltenweise, PROJ-7)
grant insert (
  company_address_line1, company_address_line2, company_postal_code, company_city, company_country
) on public.guests to authenticated;
grant update (
  company_address_line1, company_address_line2, company_postal_code, company_city, company_country
) on public.guests to authenticated;
