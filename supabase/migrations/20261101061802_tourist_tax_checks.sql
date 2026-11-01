-- PROJ-15: Prüfregel der Ortstaxe-Tarife nullsicher. Ein fehlender Betrag, Prozentsatz oder eine fehlende Basis
-- ergab „unbekannt“ statt „falsch“ und wurde deshalb angenommen.
alter table public.apartment_tourist_tax_rates drop constraint apartment_tourist_tax_rates_fields_check;
alter table public.apartment_tourist_tax_rates add constraint apartment_tourist_tax_rates_fields_check check (
  coalesce(
    (method = 'per_person_night' and amount_cents is not null and amount_cents between 0 and 100000
      and percent_rate is null and base is null
      and (exempt_under_age is null or exempt_under_age between 1 and 18))
    or (method = 'percent' and amount_cents is null and percent_rate is not null and percent_rate > 0 and percent_rate <= 100
      and base is not null and base in ('net', 'gross') and exempt_under_age is null),
    false)
);
