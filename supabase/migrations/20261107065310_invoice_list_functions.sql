-- PROJ-43: Rechnungsliste schnell (ersetzt Lesesicht invoice_list und invoice_list_totals aus 20261107064552)
-- Messung mit 5.000 Rechnungen: Über die Lesesichten prüfte die RLS die Mitgliedschaft je Zeile (private.is_member, teils
-- doppelt); Liste ca. 1,4 s, Summen über 8 s, mit Suche Zeitüberschreitung. Jetzt prüfen zwei Funktionen die Mitgliedschaft
-- einmal je Aufruf und lesen danach nur die Rechnungen dieses Kunden (über den Index Kunde + Datum).
-- * private.invoice_list_rows: Rechnung mit Listen-Status und Zahlungsstand. Gleiche Regel wie public.invoice_payment_status
--   (PROJ-45, unverändert); supabase/tests/invoice-list.integration.test.ts vergleicht beide Zeile für Zeile.
-- * public.invoice_list_page (Seite der Liste) und public.invoice_list_totals (Anzahl und Summen über alle Seiten)

drop function public.invoice_list_totals(uuid, text, integer, text, text, bigint, bigint);
drop view public.invoice_list;

-- ---------------------------------------------------------------------------
-- Zeilen eines Kunden (ohne eigene Rechteprüfung: nur aus den Funktionen unten aufrufen)
-- list_status: draft | issued | backfilled | cancelled | credit_note
-- payment_mode: payable | cancelled | credit | none (Entwurf: null); payment_status nur bei payable
-- ---------------------------------------------------------------------------
create function private.invoice_list_rows(p_tenant_id uuid)
returns table (
  id uuid,
  number text,
  invoice_date date,
  recipient text,
  total_cents bigint,
  origin text,
  kind text,
  pdf_path text,
  booking_id uuid,
  booking_number text,
  list_status text,
  payment_mode text,
  payment_status text,
  overdue boolean,
  settled_cents bigint,
  open_cents bigint,
  refunded_cents bigint
)
language sql
stable
set search_path = ''
as $$
  with base as (
    select
      i.*,
      c.id as credit_id,
      coalesce(pi.received, 0)::bigint + coalesce(pi.commission, 0)::bigint + coalesce(pi.fee, 0)::bigint as settled,
      coalesce(r.refunded, 0)::bigint as refunded,
      case
        when i.origin = 'draft' then null
        when i.kind = 'credit_note' then 'credit'
        when c.id is not null then 'cancelled'
        when i.origin = 'backfilled' and i.total_cents <= 0 then 'none'
        else 'payable'
      end as mode,
      (now() at time zone 'Europe/Vienna')::date as today
    from public.invoices i
    left join public.invoices c on c.credited_invoice_id = i.id
    left join lateral (
      select sum(p.amount_cents) as received, sum(p.commission_cents) as commission, sum(p.fee_cents) as fee
      from public.payments p
      where p.invoice_id = i.id and p.kind = 'payment'
    ) pi on true
    -- Rückzahlungen an dieser Gutschrift bzw. an der Gutschrift dieser stornierten Rechnung
    left join lateral (
      select sum(p.amount_cents) as refunded
      from public.payments p
      where p.invoice_id = coalesce(c.id, i.id) and p.kind = 'refund'
    ) r on true
    where i.tenant_id = p_tenant_id
  )
  select
    b.id,
    b.number,
    b.invoice_date,
    b.recipient,
    b.total_cents,
    b.origin,
    b.kind,
    b.pdf_path,
    b.booking_id,
    bk.number,
    case
      when b.origin = 'draft' then 'draft'
      when b.kind = 'credit_note' then 'credit_note'
      when b.credit_id is not null then 'cancelled'
      when b.origin = 'issued' then 'issued'
      else 'backfilled'
    end,
    b.mode,
    case when b.mode = 'payable' then
      case when b.settled <= 0 then 'open'
           when b.settled < b.total_cents then 'partial'
           when b.settled = b.total_cents then 'paid'
           else 'overpaid' end
    end,
    -- Überfällig: nach einem Fälligkeitstag weniger beglichen als bis dahin fällig (nur in der App ausgestellte Rechnungen)
    coalesce(b.mode = 'payable' and b.origin = 'issued' and b.issued_snapshot -> 'schedule' is not null and b.settled < (
      case
        when b.today > (b.issued_snapshot -> 'schedule' ->> 'due')::date then b.total_cents
        when b.issued_snapshot -> 'schedule' ->> 'depositDue' is not null and b.issued_snapshot -> 'schedule' ->> 'depositCents' is not null
          and b.today > (b.issued_snapshot -> 'schedule' ->> 'depositDue')::date then (b.issued_snapshot -> 'schedule' ->> 'depositCents')::bigint
        else 0
      end
    ), false),
    case when b.mode is null then 0 else b.settled end::bigint,
    case when b.mode = 'payable' then b.total_cents - b.settled else 0 end::bigint,
    case when b.mode in ('credit', 'cancelled') then b.refunded else 0 end::bigint
  from base b
  left join public.bookings bk on bk.id = b.booking_id;
$$;

-- Filter (gleich in Seite und Summen)
-- p_pattern: fertiges ILIKE-Muster gegen Nummer und Empfänger (Backslash maskiert % und _) oder null
-- p_payment: unpaid = offen + teilweise, overdue = überfällig, sonst der Zahlungsstatus
-- Beide Funktionen prüfen die Mitgliedschaft einmal und lesen danach als Eigentümer (ohne RLS je Zeile), nur diesen Kunden.

-- Seite der Liste: Datum absteigend, Nummer absteigend (Entwürfe ohne Nummer zuerst), höchstens 100 Zeilen
create function public.invoice_list_page(
  p_tenant_id uuid,
  p_pattern text,
  p_year integer,
  p_status text,
  p_payment text,
  p_min_cents bigint,
  p_max_cents bigint,
  p_offset integer,
  p_limit integer
)
returns table (
  id uuid,
  number text,
  invoice_date date,
  recipient text,
  total_cents bigint,
  origin text,
  kind text,
  pdf_path text,
  booking_id uuid,
  booking_number text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Nur Mitglieder des Kunden (Inhaber und Mitarbeiter); sonst leer wie bei der RLS
  if p_tenant_id is null or not private.is_member(p_tenant_id) then
    return;
  end if;
  return query
  select l.id, l.number, l.invoice_date, l.recipient, l.total_cents, l.origin, l.kind, l.pdf_path, l.booking_id, l.booking_number
  from private.invoice_list_rows(p_tenant_id) l
  where (p_pattern is null or p_pattern = '' or l.number ilike p_pattern or l.recipient ilike p_pattern)
    and (p_year is null or (l.invoice_date >= make_date(p_year, 1, 1) and l.invoice_date < make_date(p_year + 1, 1, 1)))
    and (p_status is null or l.list_status = p_status)
    and (
      p_payment is null
      or (p_payment = 'unpaid' and l.payment_status in ('open', 'partial'))
      or (p_payment = 'overdue' and l.overdue)
      or (p_payment not in ('unpaid', 'overdue') and l.payment_status = p_payment)
    )
    and (p_min_cents is null or l.total_cents >= p_min_cents)
    and (p_max_cents is null or l.total_cents <= p_max_cents)
  order by l.invoice_date desc, l.number desc nulls first
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

-- Anzahl und Summen über alle Seiten. Rechnungsbetrag ohne Entwürfe; Bezahlt = Beglichen, Rückzahlungen an Gutschriften
-- abgezogen; Offen = positive offene Beträge zahlbarer Rechnungen
create function public.invoice_list_totals(
  p_tenant_id uuid,
  p_pattern text,
  p_year integer,
  p_status text,
  p_payment text,
  p_min_cents bigint,
  p_max_cents bigint
)
returns table (invoice_count bigint, total_cents bigint, paid_cents bigint, open_cents bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_tenant_id is null or not private.is_member(p_tenant_id) then
    return query select 0::bigint, 0::bigint, 0::bigint, 0::bigint;
    return;
  end if;
  return query
  select
    count(*)::bigint,
    coalesce(sum(l.total_cents) filter (where l.origin <> 'draft'), 0)::bigint,
    coalesce(sum(case when l.payment_mode = 'credit' then -l.refunded_cents else l.settled_cents end), 0)::bigint,
    coalesce(sum(greatest(l.open_cents, 0)) filter (where l.payment_mode = 'payable'), 0)::bigint
  from private.invoice_list_rows(p_tenant_id) l
  where (p_pattern is null or p_pattern = '' or l.number ilike p_pattern or l.recipient ilike p_pattern)
    and (p_year is null or (l.invoice_date >= make_date(p_year, 1, 1) and l.invoice_date < make_date(p_year + 1, 1, 1)))
    and (p_status is null or l.list_status = p_status)
    and (
      p_payment is null
      or (p_payment = 'unpaid' and l.payment_status in ('open', 'partial'))
      or (p_payment = 'overdue' and l.overdue)
      or (p_payment not in ('unpaid', 'overdue') and l.payment_status = p_payment)
    )
    and (p_min_cents is null or l.total_cents >= p_min_cents)
    and (p_max_cents is null or l.total_cents <= p_max_cents);
end;
$$;

revoke execute on function private.invoice_list_rows(uuid) from public, anon, authenticated;
revoke execute on function public.invoice_list_page(uuid, text, integer, text, text, bigint, bigint, integer, integer) from public, anon;
revoke execute on function public.invoice_list_totals(uuid, text, integer, text, text, bigint, bigint) from public, anon;
grant execute on function public.invoice_list_page(uuid, text, integer, text, text, bigint, bigint, integer, integer) to authenticated;
grant execute on function public.invoice_list_totals(uuid, text, integer, text, text, bigint, bigint) to authenticated;
