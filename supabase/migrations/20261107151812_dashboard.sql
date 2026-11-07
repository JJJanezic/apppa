-- PROJ-14: Dashboard über alle Kunden der Person
-- Nichts Neues gespeichert, nur Lesefunktionen. Projektmuster (PROJ-43): Kern in private (security definer), der die
-- Mitgliedschaft bzw. Inhaber-Rolle je Kunde einmal prüft und danach ohne RLS je Zeile liest; public ist nur die Hülle mit
-- den Rechten der Person. Fremde oder nicht erlaubte Kunden in der Liste werden still übergangen (wie die RLS).
-- * dashboard_billing_states: Abrechnungsstand je Buchung (für „Heute“, alle Mitglieder)
-- * dashboard_unbilled: abgereiste bzw. stornierte Buchungen mit Stornogebühr ohne (Schluss-)Rechnung (nur Inhaber)
-- * dashboard_open_invoices: offene und teilweise bezahlte Rechnungen mit nächster Fälligkeit (alle Mitglieder)
-- * tourist_tax_monthly: Ortstaxe je Kunde, Gemeinde und Monat, anteilig je Nacht (nur Inhaber; auch für PROJ-16)

-- ---------------------------------------------------------------------------
-- Indizes
-- ---------------------------------------------------------------------------
-- Heute/Kacheln: Abreise ab heute je Kunde (die Anreise allein grenzt nur nach oben ein)
create index bookings_tenant_departure_idx on public.bookings (tenant_id, departure);
-- Ortstaxe: nur Abgabe-Positionen
create index booking_charges_tourist_tax_idx on public.booking_charges (tenant_id, booking_id) where tourist_tax;

-- ---------------------------------------------------------------------------
-- Abrechnungsstand einer Buchung (ohne eigene Rechteprüfung: nur aus den Funktionen unten aufrufen)
-- billed: nicht stornierte, in der App ausgestellte Rechnung der Art „Rechnung“ oder „Schlussrechnung“, oder eine
--         nacherfasste Rechnung (zu ihr gibt es keine Gutschrift, PROJ-44)
-- final_missing: nur nicht stornierte Teilrechnungen
-- missing: sonst (Entwürfe zählen nicht)
-- ---------------------------------------------------------------------------
create function private.billing_state(p_booking_id uuid, p_tenant_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.invoices i
      where i.booking_id = p_booking_id and i.tenant_id = p_tenant_id
        and (
          i.origin = 'backfilled'
          or (i.origin = 'issued' and i.kind in ('invoice', 'final')
              and not exists (select 1 from public.invoices c where c.credited_invoice_id = i.id))
        )
    ) then 'billed'
    when exists (
      select 1 from public.invoices i
      where i.booking_id = p_booking_id and i.tenant_id = p_tenant_id
        and i.origin = 'issued' and i.kind = 'partial'
        and not exists (select 1 from public.invoices c where c.credited_invoice_id = i.id)
    ) then 'final_missing'
    else 'missing'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Abrechnungsstand für gegebene Buchungen (nur Buchungen von Kunden, bei denen die Person Mitglied ist)
-- ---------------------------------------------------------------------------
create function private.dashboard_billing_states(p_booking_ids uuid[])
returns table (booking_id uuid, billing text)
language sql
stable
security definer
set search_path = ''
as $$
  with allowed as (
    select distinct b.tenant_id from public.bookings b where b.id = any(p_booking_ids)
  )
  select b.id, private.billing_state(b.id, b.tenant_id)
  from public.bookings b
  join allowed a on a.tenant_id = b.tenant_id and private.is_member(a.tenant_id)
  where b.id = any(p_booking_ids)
    and coalesce(cardinality(p_booking_ids), 0) <= 500;
$$;

-- ---------------------------------------------------------------------------
-- Noch nicht abgerechnet (nur Kunden, bei denen die Person Inhaber ist)
-- Buchungen (keine Optionen/Sperren) mit tatsächlicher Abreise bis p_today; stornierte nur mit Stornogebühr > 0 und
-- Stornodatum (Wien) bis p_today. Älteste zuerst, höchstens p_limit Zeilen; total_count = Anzahl aller Treffer.
-- ---------------------------------------------------------------------------
create function private.dashboard_unbilled(p_tenant_ids uuid[], p_today date, p_limit integer)
returns table (
  booking_id uuid,
  tenant_id uuid,
  last_name text,
  first_name text,
  title_prefix text,
  title_suffix text,
  apartment_name text,
  property_name text,
  due_date date,
  cancelled boolean,
  billing text,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with owned as (
    select t.id from unnest(p_tenant_ids) as t(id) where private.has_role(t.id, 'owner')
  ),
  candidates as (
    select
      b.id,
      b.tenant_id,
      b.guest_id,
      b.apartment_id,
      b.number,
      b.cancelled_at is not null as cancelled,
      case when b.cancelled_at is null then b.departure else (b.cancelled_at at time zone 'Europe/Vienna')::date end as due_date
    from public.bookings b
    join owned o on o.id = b.tenant_id
    left join public.booking_amounts a on a.id = b.id and a.tenant_id = b.tenant_id
    where b.kind = 'booking'
      and (
        (b.cancelled_at is null and b.departure <= p_today)
        or (b.cancelled_at is not null and coalesce(a.cancellation_fee_cents, 0) > 0
            and (b.cancelled_at at time zone 'Europe/Vienna')::date <= p_today)
      )
  ),
  open_ones as (
    select c.*, private.billing_state(c.id, c.tenant_id) as billing
    from candidates c
  ),
  missing as (
    select o.*, count(*) over () as total_count
    from open_ones o
    where o.billing <> 'billed'
  )
  select m.id, m.tenant_id, g.last_name, g.first_name, g.title_prefix, g.title_suffix, ap.name, p.name, m.due_date, m.cancelled,
    m.billing, m.total_count
  from missing m
  join public.apartments ap on ap.id = m.apartment_id
  join public.properties p on p.id = ap.property_id
  left join public.guests g on g.id = m.guest_id
  order by m.due_date, m.number nulls last, m.id
  limit least(greatest(coalesce(p_limit, 5), 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- Offene Rechnungen (Status offen/teilweise; ohne stornierte und Gutschriften) der Kunden, bei denen die Person Mitglied ist
-- next_due: bei in der App ausgestellten Rechnungen die Anzahlungsfrist, solange die Anzahlung nicht beglichen ist, sonst
-- die Restfälligkeit; nacherfasste Rechnungen ohne Fälligkeit
-- ---------------------------------------------------------------------------
create function private.dashboard_open_invoices(p_tenant_ids uuid[])
returns table (
  invoice_id uuid,
  tenant_id uuid,
  number text,
  recipient text,
  invoice_date date,
  apartment_name text,
  property_name text,
  open_cents bigint,
  overdue boolean,
  next_due date
)
language sql
stable
security definer
set search_path = ''
as $$
  with members as (
    select distinct t.id from unnest(p_tenant_ids) as t(id) where private.is_member(t.id)
  )
  select
    l.id,
    m.id,
    l.number,
    l.recipient,
    l.invoice_date,
    ap.name,
    p.name,
    l.open_cents,
    l.overdue,
    case
      when i.origin <> 'issued' or i.issued_snapshot -> 'schedule' is null then null
      when i.issued_snapshot -> 'schedule' ->> 'depositDue' is not null
        and i.issued_snapshot -> 'schedule' ->> 'depositCents' is not null
        and l.settled_cents < (i.issued_snapshot -> 'schedule' ->> 'depositCents')::bigint
        then (i.issued_snapshot -> 'schedule' ->> 'depositDue')::date
      else (i.issued_snapshot -> 'schedule' ->> 'due')::date
    end
  from members m
  cross join lateral private.invoice_list_rows(m.id) l
  join public.invoices i on i.id = l.id
  left join public.bookings b on b.id = l.booking_id
  left join public.apartments ap on ap.id = b.apartment_id
  left join public.properties p on p.id = ap.property_id
  where l.payment_mode = 'payable' and l.payment_status in ('open', 'partial')
  limit 1000;
$$;

-- ---------------------------------------------------------------------------
-- Ortstaxe je Kunde, Gemeinde und Monat (nur Kunden, bei denen die Person Inhaber ist)
-- Grundlage: Positionen mit Ortstaxe-Kennzeichen in nicht stornierten Buchungen (keine Optionen/Sperren).
-- Anteilig je Nacht (Nacht = Tag, an dem sie beginnt; Anreise bis tatsächliche Abreise): Monatsbetrag = bis Monatsende
-- aufgelaufen minus bis Vormonatsende aufgelaufen, jeweils gerundet. So ergibt die Summe genau den Positionsbetrag, und
-- Rundungsreste landen im letzten Monat. Ohne Nächte zählt alles im Anreisemonat. Gemeinde = aktuelle Gemeinde des
-- Objekts. month = Monatserster; nur Monate von p_from bis p_to.
-- ---------------------------------------------------------------------------
create function private.tourist_tax_monthly(p_tenant_ids uuid[], p_from date, p_to date)
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
      greatest(b.departure - b.arrival, 0) as nights,
      p.municipality_code
    from public.booking_charges c
    join owned o on o.id = c.tenant_id
    join public.bookings b on b.id = c.booking_id and b.tenant_id = c.tenant_id
    join public.apartments ap on ap.id = b.apartment_id
    join public.properties p on p.id = ap.property_id
    where c.tourist_tax
      and b.kind = 'booking'
      and b.cancelled_at is null
      and b.arrival <= p_to
      and greatest(b.departure, b.arrival + 1) > p_from
  ),
  parts as (
    -- je Position und Monat: Nächte bis zum Monatsbeginn bzw. bis zum Monatsende (begrenzt auf den Aufenthalt)
    select
      ch.tenant_id,
      ch.municipality_code,
      m.month::date as month,
      case
        when ch.nights = 0 then ch.amount
        else round(ch.amount * least(greatest((m.month + interval '1 month')::date - ch.arrival, 0), ch.nights) / ch.nights)
           - round(ch.amount * least(greatest(m.month::date - ch.arrival, 0), ch.nights) / ch.nights)
      end as cents
    from charges ch
    cross join lateral generate_series(
      date_trunc('month', ch.arrival::timestamp),
      date_trunc('month', (ch.arrival + greatest(ch.nights - 1, 0))::timestamp),
      interval '1 month'
    ) as m(month)
  )
  select pa.tenant_id, pa.municipality_code, mu.name, pa.month, sum(pa.cents)::bigint
  from parts pa
  join public.municipalities mu on mu.code = pa.municipality_code
  where pa.month between date_trunc('month', p_from::timestamp)::date and p_to
  group by pa.tenant_id, pa.municipality_code, mu.name, pa.month;
$$;

-- ---------------------------------------------------------------------------
-- Hüllen mit den Rechten der Person
-- ---------------------------------------------------------------------------
create function public.dashboard_billing_states(p_booking_ids uuid[])
returns table (booking_id uuid, billing text)
language sql stable security invoker set search_path = ''
as $$ select * from private.dashboard_billing_states(p_booking_ids); $$;

create function public.dashboard_unbilled(p_tenant_ids uuid[], p_today date, p_limit integer)
returns table (
  booking_id uuid,
  tenant_id uuid,
  last_name text,
  first_name text,
  title_prefix text,
  title_suffix text,
  apartment_name text,
  property_name text,
  due_date date,
  cancelled boolean,
  billing text,
  total_count bigint
)
language sql stable security invoker set search_path = ''
as $$ select * from private.dashboard_unbilled(p_tenant_ids, p_today, p_limit); $$;

create function public.dashboard_open_invoices(p_tenant_ids uuid[])
returns table (
  invoice_id uuid,
  tenant_id uuid,
  number text,
  recipient text,
  invoice_date date,
  apartment_name text,
  property_name text,
  open_cents bigint,
  overdue boolean,
  next_due date
)
language sql stable security invoker set search_path = ''
as $$ select * from private.dashboard_open_invoices(p_tenant_ids); $$;

create function public.tourist_tax_monthly(p_tenant_ids uuid[], p_from date, p_to date)
returns table (tenant_id uuid, municipality_id text, municipality_name text, month date, amount_cents bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.tourist_tax_monthly(p_tenant_ids, p_from, p_to); $$;

-- ---------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------
revoke execute on function private.billing_state(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.dashboard_billing_states(uuid[]) from public, anon;
revoke execute on function private.dashboard_unbilled(uuid[], date, integer) from public, anon;
revoke execute on function private.dashboard_open_invoices(uuid[]) from public, anon;
revoke execute on function private.tourist_tax_monthly(uuid[], date, date) from public, anon;
revoke execute on function public.dashboard_billing_states(uuid[]) from public, anon;
revoke execute on function public.dashboard_unbilled(uuid[], date, integer) from public, anon;
revoke execute on function public.dashboard_open_invoices(uuid[]) from public, anon;
revoke execute on function public.tourist_tax_monthly(uuid[], date, date) from public, anon;
grant execute on function private.dashboard_billing_states(uuid[]) to authenticated;
grant execute on function private.dashboard_unbilled(uuid[], date, integer) to authenticated;
grant execute on function private.dashboard_open_invoices(uuid[]) to authenticated;
grant execute on function private.tourist_tax_monthly(uuid[], date, date) to authenticated;
grant execute on function public.dashboard_billing_states(uuid[]) to authenticated;
grant execute on function public.dashboard_unbilled(uuid[], date, integer) to authenticated;
grant execute on function public.dashboard_open_invoices(uuid[]) to authenticated;
grant execute on function public.tourist_tax_monthly(uuid[], date, date) to authenticated;
