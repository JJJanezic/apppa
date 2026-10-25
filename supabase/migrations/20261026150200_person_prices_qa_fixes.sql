-- PROJ-27 QA BUG-2: Rechnerischer Vorschlag über dem Höchstbetrag einer Buchung (€ 1.000.000, booking_amounts)
-- bzw. über dem Ganzzahlbereich ließ Mitarbeiter-Buchungen mit einem allgemeinen Fehler scheitern.
-- Jetzt wird in bigint gerechnet; über dem Höchstbetrag gibt es keinen Vorschlag (null). Die Mitarbeiter-Buchung
-- wird dann wie bei einer Wohnung ohne Preis mit € 0 und „Preis prüfen“ gespeichert.
-- Gleiche Regel wie suggestedNightsCents in src/lib/apartments.ts (AMOUNT_MAX_CENTS).

create or replace function private.suggested_nights_cents(p_apartment public.apartments, p_adults integer, p_child_ages integer[], p_nights integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when v.cents > 100000000 then null else v.cents::integer end
  from (
    select case
      when p_apartment.price_mode = 'person' then
        case when p_apartment.adult_price_cents is null then null else (
          p_nights::bigint * (
            coalesce(p_adults, 0)::bigint * p_apartment.adult_price_cents
            + coalesce((
              select sum(coalesce((
                select (t.value ->> 'price_cents')::bigint
                from jsonb_array_elements(p_apartment.child_prices) with ordinality as t(value, ord)
                where (t.value ->> 'to_age')::integer >= age
                order by t.ord
                limit 1
              ), p_apartment.adult_price_cents))
              from unnest(coalesce(p_child_ages, '{}'::integer[])) as age
            ), 0)
          )
        ) end
      else p_apartment.price_cents::bigint * p_nights
    end as cents
  ) v;
$$;

revoke execute on function private.suggested_nights_cents(public.apartments, integer, integer[], integer) from public, anon, authenticated;
