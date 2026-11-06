-- PROJ-45: public.save_invoice aus 20261106171901_payments hat die Sperre für abgezogene nacherfasste Rechnungen (PROJ-42,
-- private.check_deducted_invoice) verloren. Wiederhergestellt: erst die Sperre, dann das bisherige Speichern, dann
-- „Bereits bezahlt“ (Zahlung über den vollen Betrag im selben Schritt, nur beim Anlegen).
create or replace function public.save_invoice(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
  v_paid jsonb := p_input -> 'already_paid';
  v_total bigint;
  v_commission bigint;
  v_fee bigint;
begin
  perform private.check_deducted_invoice(p_input - 'already_paid');
  v_result := private.save_invoice(p_input - 'already_paid');
  if jsonb_typeof(v_paid) = 'object' and nullif(p_input ->> 'id', '') is null then
    select i.total_cents into v_total from public.invoices i where i.id = (v_result ->> 'id')::uuid;
    v_commission := coalesce((v_paid ->> 'commission_cents')::bigint, 0);
    v_fee := coalesce((v_paid ->> 'fee_cents')::bigint, 0);
    perform private.save_payment(jsonb_build_object(
      'tenant_id', p_input ->> 'tenant_id',
      'kind', 'payment',
      'invoice_id', v_result ->> 'id',
      'paid_on', v_paid ->> 'paid_on',
      'amount_cents', v_total - v_commission - v_fee,
      'commission_cents', v_commission,
      'fee_cents', v_fee,
      'method_id', v_paid ->> 'method_id',
      'confirmed', true
    ), false);
  end if;
  return v_result;
end;
$$;
