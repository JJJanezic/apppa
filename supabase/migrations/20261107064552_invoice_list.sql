-- PROJ-43: Rechnungsübersicht ausbauen
-- * Lesesicht invoice_list: Rechnung (inkl. Entwürfe) mit Listen-Status, Zahlungsstand aus invoice_payment_status (PROJ-45)
--   und Buchungsnummer. Filter, Anzahl und Blättern der Rechnungsliste laufen in einer Abfrage.
-- * Funktion invoice_list_totals: Summen Rechnungsbetrag, Bezahlt, Offen über dieselben Filter (alle Seiten).
-- Beide lesen mit den Rechten der Person (security invoker): Abschottung je Kunde über die RLS der Tabellen und die
-- Mitgliedsprüfung in invoice_payment_status. Nichts Neues gespeichert.

-- ---------------------------------------------------------------------------
-- Lesesicht
-- list_status: draft | issued | backfilled | cancelled | credit_note
--   issued/backfilled nur ohne Gutschrift dazu; cancelled = es gibt eine Gutschrift (nur ausgestellte Rechnungen);
--   credit_note = Art Gutschrift
-- payment_status: open | partial | paid | overpaid für zahlbare Rechnungen, sonst null; overdue nie null
-- ---------------------------------------------------------------------------
create view public.invoice_list
with (security_invoker = true)
as
select
  i.id,
  i.tenant_id,
  i.number,
  i.invoice_date,
  i.recipient,
  i.total_cents,
  i.origin,
  i.kind,
  i.pdf_path,
  i.booking_id,
  b.number as booking_number,
  case
    when i.origin = 'draft' then 'draft'
    when i.kind = 'credit_note' then 'credit_note'
    when s.mode = 'cancelled' then 'cancelled'
    when i.origin = 'issued' then 'issued'
    else 'backfilled'
  end as list_status,
  s.mode as payment_mode,
  s.status as payment_status,
  coalesce(s.overdue, false) as overdue,
  coalesce(s.settled_cents, 0)::bigint as settled_cents,
  coalesce(s.open_cents, 0)::bigint as open_cents,
  coalesce(s.refunded_cents, 0)::bigint as refunded_cents
from public.invoices i
left join public.invoice_payment_status s on s.invoice_id = i.id
left join public.bookings b on b.id = i.booking_id;

comment on view public.invoice_list is 'Rechnungsliste (PROJ-43): Rechnung mit Listen-Status und Zahlungsstand für Filter, Anzahl und Blättern.';

-- ---------------------------------------------------------------------------
-- Summen über die gefilterte Liste
-- p_pattern: fertiges ILIKE-Muster gegen Nummer und Empfänger (Backslash maskiert % und _) oder null
-- p_payment: unpaid = offen + teilweise, overdue = überfällig, sonst der Zahlungsstatus
-- Rechnungsbetrag ohne Entwürfe; Bezahlt = Beglichen, Rückzahlungen an Gutschriften abgezogen; Offen = positive offene
-- Beträge zahlbarer Rechnungen
-- ---------------------------------------------------------------------------
create function public.invoice_list_totals(
  p_tenant_id uuid,
  p_pattern text,
  p_year integer,
  p_status text,
  p_payment text,
  p_min_cents bigint,
  p_max_cents bigint
)
returns table (total_cents bigint, paid_cents bigint, open_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(l.total_cents) filter (where l.origin <> 'draft'), 0)::bigint,
    coalesce(sum(case when l.payment_mode = 'credit' then -l.refunded_cents else l.settled_cents end), 0)::bigint,
    coalesce(sum(greatest(l.open_cents, 0)) filter (where l.payment_mode = 'payable'), 0)::bigint
  from public.invoice_list l
  where l.tenant_id = p_tenant_id
    and (p_pattern is null or p_pattern = '' or l.number ilike p_pattern or l.recipient ilike p_pattern)
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
$$;

revoke all on public.invoice_list from anon, authenticated;
grant select on public.invoice_list to authenticated;
revoke execute on function public.invoice_list_totals(uuid, text, integer, text, text, bigint, bigint) from public, anon;
grant execute on function public.invoice_list_totals(uuid, text, integer, text, text, bigint, bigint) to authenticated;
