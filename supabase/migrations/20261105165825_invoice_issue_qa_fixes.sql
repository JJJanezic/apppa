-- PROJ-42 QA: BUG-1 Entfernte Zusatzkosten dürfen die Verbindung an ausgestellten Rechnungen lösen (nur das);
-- BUG-2 Rechnungsnummern ohne unsichtbare Zeichen. Sonst unverändert gegenüber 20261105093618_invoice_issue.sql.

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
  if exists (select 1 from public.invoices i where i.id = v_invoice and i.origin = 'issued')
      and exists (select 1 from public.tenants t where t.id = v_tenant) then
    raise exception 'Ausgestellte Rechnungen lassen sich nicht ändern.' using errcode = 'P0932';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.issue_invoice(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_input ->> 'id', '')::uuid;
  v_tenant uuid := nullif(p_input ->> 'tenant_id', '')::uuid;
  v_actor uuid := nullif(p_input ->> 'actor_id', '')::uuid;
  v_number text := btrim(coalesce(p_input ->> 'number', ''));
  v_date date := nullif(p_input ->> 'invoice_date', '')::date;
  v_pdf text := nullif(btrim(coalesce(p_input ->> 'pdf_path', '')), '');
  v_small jsonb := p_input -> 'small_business';
  v_snapshot jsonb := p_input -> 'snapshot';
  v_invoice public.invoices;
  v_booking_updated timestamptz;
begin
  if v_id is null or v_tenant is null or v_actor is null or v_date is null or length(v_number) not between 1 and 30
      or jsonb_typeof(v_small) is distinct from 'boolean' or jsonb_typeof(v_snapshot) is distinct from 'object'
      or coalesce(p_input ->> 'pdf_sha256', '') !~ '^[0-9a-f]{64}$'
      -- BUG-2: unsichtbare Zeichen: Das PDF zeigt sie nicht, zwei Rechnungen sähen gleich aus (Regel auch in invoice-issue.ts)
      or v_number ~ '[\u0001-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]' then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;

  -- Protokoll und „geändert von“ nennen die handelnde Person (nur in diesem Vorgang)
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_actor, 'role', 'authenticated')::text, true);

  select * into v_invoice from public.invoices where id = v_id and tenant_id = v_tenant for update;
  if v_invoice.id is null then
    raise exception 'Rechnung nicht gefunden.' using errcode = 'P0902';
  end if;
  if not exists (select 1 from public.memberships m where m.tenant_id = v_tenant and m.user_id = v_actor and m.role = 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0901';
  end if;
  if exists (select 1 from public.tenants t where t.id = v_tenant and t.status = 'deactivated') then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  -- Zweiter Versuch derselben Anfrage: Es entsteht keine zweite Rechnung
  if v_invoice.origin = 'issued' then
    return v_id;
  end if;
  if v_invoice.origin <> 'draft' or v_invoice.booking_id is null then
    raise exception 'Rechnung nicht gefunden.' using errcode = 'P0902';
  end if;

  if v_invoice.updated_at is distinct from (p_input ->> 'updated_at')::timestamptz then
    raise exception 'Der Entwurf wurde inzwischen geändert.' using errcode = 'P0903';
  end if;
  select b.updated_at into v_booking_updated from public.bookings b where b.id = v_invoice.booking_id and b.tenant_id = v_tenant for share;
  if v_booking_updated is distinct from (p_input ->> 'booking_updated_at')::timestamptz then
    raise exception 'Die Buchung wurde inzwischen geändert.' using errcode = 'P0903';
  end if;

  if v_date > private.today_vienna() then
    raise exception 'Das Rechnungsdatum darf nicht in der Zukunft liegen.' using errcode = 'P0906';
  end if;
  if exists (select 1 from public.invoices i where i.tenant_id = v_tenant and i.number_key = lower(v_number)) then
    raise exception 'Die Rechnungsnummer ist bereits vergeben.' using errcode = 'P0904';
  end if;

  -- Abgezogene Rechnungen sperren: Teilrechnung kann sonst gleichzeitig gelöscht werden
  perform 1 from public.invoices d
    join public.invoice_deductions x on x.deducted_invoice_id = d.id
    where x.invoice_id = v_id for share of d;
  if v_invoice.deduction_removed or exists (
    select 1 from public.invoice_deductions x
    join public.invoices d on d.id = x.deducted_invoice_id
    where x.invoice_id = v_id and d.origin = 'draft'
  ) then
    raise exception 'Ein Abzug ist noch offen.' using errcode = 'P0930';
  end if;

  -- Der Betrag der Rechnung folgt den gespeicherten Positionen und Abzügen
  if private.invoice_total_cents(v_id) is distinct from (p_input ->> 'total_cents')::bigint then
    raise exception 'Der Betrag weicht vom gespeicherten Stand ab.' using errcode = 'P0903';
  end if;

  if v_pdf is null or private.invoice_pdf_tenant(v_pdf) is distinct from v_tenant
      or not exists (select 1 from storage.objects o where o.bucket_id = 'invoices' and o.name = v_pdf)
      or exists (select 1 from public.invoices i where i.pdf_path = v_pdf) then
    raise exception 'Das PDF wurde nicht gefunden.' using errcode = 'P0907';
  end if;

  begin
    update public.invoices set
      origin = 'issued',
      number = v_number,
      invoice_date = v_date,
      small_business = v_small::boolean,
      total_cents = (p_input ->> 'total_cents')::bigint,
      pdf_path = v_pdf,
      pdf_sha256 = p_input ->> 'pdf_sha256',
      issued_at = now(),
      issued_by = v_actor,
      issued_snapshot = v_snapshot,
      issued_without_logo = coalesce((p_input ->> 'without_logo')::boolean, false)
    where id = v_id;
  exception when unique_violation then
    -- gleichzeitig ausgestellt
    raise exception 'Die Rechnungsnummer ist bereits vergeben.' using errcode = 'P0904';
  end;
  return v_id;
end;
$$;
