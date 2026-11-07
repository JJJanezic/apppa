-- PROJ-43: Projektmuster für Funktionen mit erhöhten Rechten (Advisor „security definer function executable“):
-- Der Kern liegt in private (security definer, prüft die Mitgliedschaft selbst), public enthält nur die Hülle mit den
-- Rechten der Person (wie search_invoice_bookings).

alter function public.invoice_list_page(uuid, text, integer, text, text, bigint, bigint, integer, integer) set schema private;
alter function public.invoice_list_totals(uuid, text, integer, text, text, bigint, bigint) set schema private;

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
language sql stable security invoker set search_path = ''
as $$ select * from private.invoice_list_page(p_tenant_id, p_pattern, p_year, p_status, p_payment, p_min_cents, p_max_cents, p_offset, p_limit); $$;

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
language sql stable security invoker set search_path = ''
as $$ select * from private.invoice_list_totals(p_tenant_id, p_pattern, p_year, p_status, p_payment, p_min_cents, p_max_cents); $$;

revoke execute on function private.invoice_list_page(uuid, text, integer, text, text, bigint, bigint, integer, integer) from public, anon;
revoke execute on function private.invoice_list_totals(uuid, text, integer, text, text, bigint, bigint) from public, anon;
revoke execute on function public.invoice_list_page(uuid, text, integer, text, text, bigint, bigint, integer, integer) from public, anon;
revoke execute on function public.invoice_list_totals(uuid, text, integer, text, text, bigint, bigint) from public, anon;
grant execute on function private.invoice_list_page(uuid, text, integer, text, text, bigint, bigint, integer, integer) to authenticated;
grant execute on function private.invoice_list_totals(uuid, text, integer, text, text, bigint, bigint) to authenticated;
grant execute on function public.invoice_list_page(uuid, text, integer, text, text, bigint, bigint, integer, integer) to authenticated;
grant execute on function public.invoice_list_totals(uuid, text, integer, text, text, bigint, bigint) to authenticated;
