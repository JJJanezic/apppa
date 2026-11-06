-- PROJ-44: Abzüge einer stornierten Schlussrechnung sind Geschichte. Sie dürfen wegfallen, wenn die abgezogene nacherfasste Rechnung
-- gelöscht wird (sonst bliebe sie gesperrt, obwohl keine gültige Schlussrechnung sie mehr abzieht). Sonst unverändert gegenüber
-- 20261106082931_invoice_credit_notes.sql.

create or replace function private.protect_issued_children()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice uuid := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  v_tenant uuid := case when tg_op = 'DELETE' then old.tenant_id else new.tenant_id end;
begin
  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id
      and exists (select 1 from public.invoices i where i.id = old.invoice_id and i.origin = 'issued') then
    raise exception 'Ausgestellte Rechnungen lassen sich nicht ändern.' using errcode = 'P0932';
  end if;
  -- Gelöschte Zusatzkosten: Der Fremdschlüssel löst die Verbindung, Bezeichnung und Betrag bleiben
  if tg_op = 'UPDATE' and tg_table_name = 'invoice_lines'
      and to_jsonb(new) ->> 'source_charge_id' is null
      and (to_jsonb(new) - 'source_charge_id' - 'updated_at' - 'updated_by') = (to_jsonb(old) - 'source_charge_id' - 'updated_at' - 'updated_by') then
    return new;
  end if;
  -- PROJ-44 (QA im Backend): Abzüge einer stornierten Schlussrechnung dürfen wegfallen, etwa wenn die abgezogene nacherfasste
  -- Rechnung gelöscht wird. Die Fassung der Schlussrechnung enthält Nummer und Betrag des Abzugs als Kopie.
  if tg_op = 'DELETE' and tg_table_name = 'invoice_deductions'
      and exists (select 1 from public.invoices c where c.credited_invoice_id = old.invoice_id) then
    return old;
  end if;
  -- PROJ-44: Positionen der Gutschrift, die gerade in diesem Vorgang entsteht
  if tg_op = 'INSERT' and tg_table_name = 'invoice_lines'
      and exists (select 1 from public.invoices i where i.id = v_invoice and i.kind = 'credit_note' and i.issued_at = now()) then
    return new;
  end if;
  if exists (select 1 from public.invoices i where i.id = v_invoice and i.origin = 'issued')
      and exists (select 1 from public.tenants t where t.id = v_tenant) then
    raise exception 'Ausgestellte Rechnungen lassen sich nicht ändern.' using errcode = 'P0932';
  end if;
  return coalesce(new, old);
end;
$$;
