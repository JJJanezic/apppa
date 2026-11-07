-- PROJ-14 Nachbesserung nach der Auslieferung (BUG-7, BUG-8)
-- * BUG-7: Alt-Positionen der Ortstaxe einmalig kennzeichnen. Buchungen von vor PROJ-15 stehen auf „noch nicht berechnet“
--   (tourist_tax_mode = 'pending'); ihre Abgabe wurde als normale Zusatzposition eingetippt (meist „Nächtigungsabgabe“)
--   und zählte deshalb in den Ortstaxe-Summen nicht. Gekennzeichnet werden nur Positionen in solchen Buchungen, deren
--   Bezeichnung einer Ortstaxe entspricht. Ohne Tarif-Verweis und Personennächte (wie Positionen eines gelöschten Tarifs);
--   Bezeichnung, Betrag, USt, Buchungsstatus und Rechnungen bleiben unverändert. Das Buchungsformular behält das Kennzeichen
--   beim Speichern und ersetzt solche Positionen bei „Abgabe berechnen“ (keine Doppelung).
-- * BUG-8: tourist_tax_monthly verteilt eine Position mit Tarif-Verweis nur über die Nächte ihres Tarifzeitraums (ab
--   „gültig ab“ bis vor den nächsten Tarif derselben Wohnung), nicht mehr über den ganzen Aufenthalt. Ohne Tarif-Verweis
--   (Alt-Positionen, gelöschter Tarif) oder ohne Überschneidung weiter über den ganzen Aufenthalt.

-- ---------------------------------------------------------------------------
-- BUG-7: Alt-Positionen kennzeichnen
-- ---------------------------------------------------------------------------
update public.booking_charges c
set tourist_tax = true
from public.bookings b
where b.id = c.booking_id
  and b.tenant_id = c.tenant_id
  and b.tourist_tax_mode = 'pending'
  and not c.tourist_tax
  and (
    lower(btrim(c.label)) in ('nächtigungsabgabe', 'ortstaxe', 'aufenthaltsabgabe', 'tourismusabgabe', 'kurtaxe')
    or exists (
      select 1 from public.apartment_tourist_tax_rates r
      where r.apartment_id = b.apartment_id and r.tenant_id = b.tenant_id and lower(btrim(r.label)) = lower(btrim(c.label))
    )
  );

-- ---------------------------------------------------------------------------
-- BUG-8: Verteilung nach Tarifzeitraum (gleiche Rechte, Rückgabe und Rundungsregel wie bisher)
-- ---------------------------------------------------------------------------
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
      c.amount_cents::numeric as amount,
      b.arrival,
      b.departure,
      p.municipality_code,
      -- Tarifzeitraum der Position: [gültig ab, nächster Tarif derselben Wohnung)
      r.valid_from as rate_from,
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
      and greatest(b.departure, b.arrival + 1) > p_from
  ),
  spans as (
    -- Verteilzeitraum: Schnitt aus Aufenthalt und Tarifzeitraum; ohne Tarif oder ohne Schnitt der ganze Aufenthalt
    select ch.tenant_id, ch.amount, ch.municipality_code,
      case when s.span_end > s.span_start then s.span_start else ch.arrival end as start_day,
      greatest(case when s.span_end > s.span_start then s.span_end else ch.departure end
               - case when s.span_end > s.span_start then s.span_start else ch.arrival end, 0) as nights
    from charges ch
    cross join lateral (
      select
        case when ch.rate_from is null then null else greatest(ch.arrival, ch.rate_from) end as span_start,
        case when ch.rate_from is null then null else least(ch.departure, coalesce(ch.rate_until, ch.departure)) end as span_end
    ) s
  ),
  parts as (
    -- je Position und Monat: aufgelaufen bis Monatsende minus aufgelaufen bis Monatsbeginn, jeweils gerundet
    select
      sp.tenant_id,
      sp.municipality_code,
      m.month::date as month,
      case
        when sp.nights = 0 then sp.amount
        else round(sp.amount * least(greatest((m.month + interval '1 month')::date - sp.start_day, 0), sp.nights) / sp.nights)
           - round(sp.amount * least(greatest(m.month::date - sp.start_day, 0), sp.nights) / sp.nights)
      end as cents
    from spans sp
    cross join lateral generate_series(
      date_trunc('month', sp.start_day::timestamp),
      date_trunc('month', (sp.start_day + greatest(sp.nights - 1, 0))::timestamp),
      interval '1 month'
    ) as m(month)
  )
  select pa.tenant_id, pa.municipality_code, mu.name, pa.month, sum(pa.cents)::bigint
  from parts pa
  join public.municipalities mu on mu.code = pa.municipality_code
  where pa.month between date_trunc('month', p_from::timestamp)::date and p_to
  group by pa.tenant_id, pa.municipality_code, mu.name, pa.month;
$$;
