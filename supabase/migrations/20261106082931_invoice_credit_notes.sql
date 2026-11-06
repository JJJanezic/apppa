-- PROJ-44: Rechnungsstorno. Zu einer in der App ausgestellten Rechnung entsteht eine Gutschrift (Art „credit_note“), die sie
-- vollständig aufhebt. Die Rechnung selbst bleibt unverändert: „storniert“ heißt, eine Gutschrift verweist auf sie (höchstens
-- eine je Rechnung). Gutschriften sind ausgestellte Belege: unveränderlich, nicht löschbar, im Nummernkreis der Rechnungen.
-- „Abgezogen“ zählt nur noch durch gültige (ausgestellte, nicht stornierte) Schlussrechnungen. RLS bleibt unverändert.

-- ---------------------------------------------------------------------------
-- Spalten und Regeln
-- ---------------------------------------------------------------------------
alter table public.invoices drop constraint invoices_kind_check;
alter table public.invoices add constraint invoices_kind_check check (kind in ('invoice', 'partial', 'final', 'credit_note'));

alter table public.invoices
  add column credited_invoice_id uuid,
  add column credit_reason text check (credit_reason = btrim(credit_reason) and length(credit_reason) between 1 and 300),
  -- Löschen nur mit dem Kunden (Kaskade); sonst sind beide Belege unveränderlich
  add constraint invoices_credited_fkey foreign key (credited_invoice_id, tenant_id)
    references public.invoices (id, tenant_id) on delete cascade,
  add constraint invoices_credited_key unique (credited_invoice_id),
  add constraint invoices_credit_check check (
    case when kind = 'credit_note'
      then origin = 'issued' and credited_invoice_id is not null and credited_invoice_id <> id
      else credited_invoice_id is null and credit_reason is null
    end
  );
comment on column public.invoices.credited_invoice_id is 'Gutschrift (PROJ-44): die stornierte Rechnung. Eine Rechnung ist storniert, wenn eine Gutschrift auf sie verweist.';
comment on column public.invoices.credit_reason is 'Gutschrift (PROJ-44): Grund, eine Zeile auf dem Beleg (optional).';

-- Gutschriften haben keine Fristen, Bausteine und keine Teilung
alter table public.invoices drop constraint invoices_draft_fields_check;
alter table public.invoices add constraint invoices_draft_fields_check check (
  origin = 'backfilled'
  or (kind = 'credit_note' and recipient_kind is not null and company_salutation is not null and guest_names is not null)
  or (kind is not null and recipient_kind is not null and company_salutation is not null and guest_names is not null
    and due_days is not null and due_basis is not null)
);

-- Ist die Rechnung durch eine Gutschrift storniert?
create function private.is_credited(p_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.invoices c where c.credited_invoice_id = p_invoice_id);
$$;

-- ---------------------------------------------------------------------------
-- Positionen einer Gutschrift entstehen im selben Vorgang wie sie (issued_at = Beginn des Vorgangs). Sonst bleiben Positionen
-- ausgestellter Belege unveränderlich wie bisher (PROJ-42, Fassung aus 20261105165825).
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- „Abgezogen“ nur durch gültige Schlussrechnungen. Die Abzüge einer stornierten Schlussrechnung bleiben als Geschichte stehen.
-- ---------------------------------------------------------------------------
create or replace function private.issued_final_deducting(p_invoice_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select f.number
  from public.invoice_deductions x
  join public.invoices f on f.id = x.invoice_id
  where x.deducted_invoice_id = p_invoice_id and f.origin = 'issued'
    and not exists (select 1 from public.invoices c where c.credited_invoice_id = f.id)
  order by f.number
  limit 1;
$$;

-- Abzüge auf p_invoice_id aus Entwürfen entfernen (Teilrechnung storniert): Entwürfe erhalten den bekannten Hinweis und einen neu
-- gebildeten Gesamtbetrag. Abzüge ausgestellter Schlussrechnungen bleiben unberührt.
create function private.detach_draft_deductions(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_drafts uuid[];
begin
  with removed as (
    delete from public.invoice_deductions x
    using public.invoices f
    where x.deducted_invoice_id = p_invoice_id and f.id = x.invoice_id and f.origin = 'draft'
    returning x.invoice_id
  )
  select coalesce(array_agg(invoice_id), '{}') into v_drafts from removed;
  if cardinality(v_drafts) = 0 then
    return;
  end if;
  update public.invoices f
  set deduction_removed = true, total_cents = private.invoice_total_cents(f.id)
  where f.id = any (v_drafts);
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechnung ausstellen (PROJ-42, Fassung aus 20261105165825). Neu: Eine Schlussrechnung darf keine stornierte Rechnung abziehen und
-- keine, die schon eine gültige Schlussrechnung abzieht (bisher sicherte das nur die Oberfläche).
-- ---------------------------------------------------------------------------
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
      or v_number ~ '[\u0001-\u001f\u007f-\u009f­؜​-‏‪-‮⁠-⁯﻿]' then
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

  -- Abgezogene Rechnungen sperren: Teilrechnung kann sonst gleichzeitig gelöscht oder storniert werden
  perform 1 from public.invoices d
    join public.invoice_deductions x on x.deducted_invoice_id = d.id
    where x.invoice_id = v_id for share of d;
  if v_invoice.deduction_removed or exists (
    select 1 from public.invoice_deductions x
    join public.invoices d on d.id = x.deducted_invoice_id
    where x.invoice_id = v_id
      and (d.origin = 'draft' or private.is_credited(d.id) or private.issued_final_deducting(d.id) is not null)
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

-- ---------------------------------------------------------------------------
-- Gutschrift ausstellen. Nur für den Server: Er prüft zuvor Anmeldung und das erzeugte PDF und legt die Datei ab. Hier fällt die
-- endgültige Entscheidung: Rechnung (gesperrt), Rechte, Datum, Grund, Nummer, Betrag und Datei. Positionen werden aus der Rechnung
-- gespiegelt, nicht aus der Eingabe übernommen.
-- p_input: invoice_id, tenant_id, actor_id, number, invoice_date, reason, total_cents, pdf_path, pdf_sha256, without_logo, snapshot.
-- Ergebnis: Kennung der Gutschrift.
-- Fehler: P0901 kein Inhaber, P0016 Kunde deaktiviert, P0902 keine Rechnung aus der App, P0903 Betrag weicht ab, P0904 Nummer
--   vergeben, P0906 Datum vor der Rechnung oder in der Zukunft, P0907 PDF ungültig, P0934 schon storniert (Detail: Kennung der
--   Gutschrift), P0935 in gültiger Schlussrechnung abgezogen (Detail: deren Nummer), 22023 ungültige Eingabe.
-- ---------------------------------------------------------------------------
create function public.issue_credit_note(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice_id uuid := nullif(p_input ->> 'invoice_id', '')::uuid;
  v_tenant uuid := nullif(p_input ->> 'tenant_id', '')::uuid;
  v_actor uuid := nullif(p_input ->> 'actor_id', '')::uuid;
  v_number text := btrim(coalesce(p_input ->> 'number', ''));
  v_date date := nullif(p_input ->> 'invoice_date', '')::date;
  v_reason text := nullif(btrim(regexp_replace(coalesce(p_input ->> 'reason', ''), '\s+', ' ', 'g')), '');
  v_pdf text := nullif(btrim(coalesce(p_input ->> 'pdf_path', '')), '');
  v_snapshot jsonb := p_input -> 'snapshot';
  v_invoice public.invoices;
  v_credit uuid;
  v_final text;
  v_constraint text;
begin
  if v_invoice_id is null or v_tenant is null or v_actor is null or v_date is null or length(v_number) not between 1 and 30
      or jsonb_typeof(v_snapshot) is distinct from 'object'
      or coalesce(p_input ->> 'pdf_sha256', '') !~ '^[0-9a-f]{64}$'
      or coalesce(p_input ->> 'total_cents', '') !~ '^-?[0-9]{1,12}$'
      or length(coalesce(v_reason, '')) > 300
      or v_number ~ '[\u0001-\u001f\u007f-\u009f­؜​-‏‪-‮⁠-⁯﻿]' then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;

  -- Protokoll und „erstellt von“ nennen die handelnde Person (nur in diesem Vorgang)
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_actor, 'role', 'authenticated')::text, true);

  -- Sperre auf der Rechnung: Gleichzeitige Anfragen warten, die zweite findet danach die Gutschrift
  select * into v_invoice from public.invoices where id = v_invoice_id and tenant_id = v_tenant for update;
  if v_invoice.id is null then
    raise exception 'Rechnung nicht gefunden.' using errcode = 'P0902';
  end if;
  if not exists (select 1 from public.memberships m where m.tenant_id = v_tenant and m.user_id = v_actor and m.role = 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0901';
  end if;
  if exists (select 1 from public.tenants t where t.id = v_tenant and t.status = 'deactivated') then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  -- Nur in der App ausgestellte Rechnungen; keine Gutschrift zu Gutschriften, Entwürfen oder nacherfassten Rechnungen
  if v_invoice.origin <> 'issued' or v_invoice.kind not in ('invoice', 'partial', 'final') then
    raise exception 'Rechnung nicht gefunden.' using errcode = 'P0902';
  end if;
  select c.id into v_credit from public.invoices c where c.credited_invoice_id = v_invoice_id;
  if v_credit is not null then
    raise exception 'Die Rechnung wurde inzwischen storniert.' using errcode = 'P0934', detail = v_credit::text;
  end if;
  -- Schlussrechnung gleichzeitig ausstellen bzw. stornieren: zuerst sperren, dann prüfen
  perform 1 from public.invoice_deductions x join public.invoices f on f.id = x.invoice_id
    where x.deducted_invoice_id = v_invoice_id for share of f;
  v_final := private.issued_final_deducting(v_invoice_id);
  if v_final is not null then
    raise exception 'Eine gültige Schlussrechnung zieht diese Rechnung ab.' using errcode = 'P0935', detail = v_final;
  end if;

  if v_date < v_invoice.invoice_date or v_date > private.today_vienna() then
    raise exception 'Das Gutschriftsdatum liegt vor der Rechnung oder in der Zukunft.' using errcode = 'P0906';
  end if;
  if exists (select 1 from public.invoices i where i.tenant_id = v_tenant and i.number_key = lower(v_number)) then
    raise exception 'Die Rechnungsnummer ist bereits vergeben.' using errcode = 'P0904';
  end if;
  -- Die Gutschrift hebt die Rechnung genau auf
  if (p_input ->> 'total_cents')::bigint is distinct from -v_invoice.total_cents then
    raise exception 'Der Betrag weicht von der Rechnung ab.' using errcode = 'P0903';
  end if;
  if v_pdf is null or private.invoice_pdf_tenant(v_pdf) is distinct from v_tenant
      or not exists (select 1 from storage.objects o where o.bucket_id = 'invoices' and o.name = v_pdf)
      or exists (select 1 from public.invoices i where i.pdf_path = v_pdf) then
    raise exception 'Das PDF wurde nicht gefunden.' using errcode = 'P0907';
  end if;

  begin
    insert into public.invoices (
      tenant_id, origin, kind, number, invoice_date, booking_id, guest_id, recipient, small_business, total_cents,
      recipient_kind, recipient_name, recipient_line1, recipient_line2, recipient_postal_code, recipient_city, recipient_country,
      recipient_vat_id, company_salutation, guest_names,
      pdf_path, pdf_sha256, issued_at, issued_by, issued_snapshot, issued_without_logo, credited_invoice_id, credit_reason
    ) values (
      v_tenant, 'issued', 'credit_note', v_number, v_date, v_invoice.booking_id, v_invoice.guest_id, v_invoice.recipient,
      v_invoice.small_business, -v_invoice.total_cents,
      v_invoice.recipient_kind, v_invoice.recipient_name, v_invoice.recipient_line1, v_invoice.recipient_line2,
      v_invoice.recipient_postal_code, v_invoice.recipient_city, v_invoice.recipient_country, v_invoice.recipient_vat_id,
      v_invoice.company_salutation, v_invoice.guest_names,
      v_pdf, p_input ->> 'pdf_sha256', now(), v_actor, v_snapshot, coalesce((p_input ->> 'without_logo')::boolean, false),
      v_invoice_id, v_reason
    )
    returning id into v_credit;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'invoices_credited_key' then
      select c.id into v_credit from public.invoices c where c.credited_invoice_id = v_invoice_id;
      raise exception 'Die Rechnung wurde inzwischen storniert.' using errcode = 'P0934', detail = coalesce(v_credit::text, '');
    end if;
    raise exception 'Die Rechnungsnummer ist bereits vergeben.' using errcode = 'P0904';
  end;

  -- Positionen gespiegelt, ohne Verbindung zu Zusatzkosten der Buchung; Abzüge stehen nur in Fassung und PDF
  insert into public.invoice_lines (tenant_id, invoice_id, position, label, amount_cents, vat_rate)
  select v_tenant, v_credit, l.position, l.label, -l.amount_cents, l.vat_rate
  from public.invoice_lines l where l.invoice_id = v_invoice_id;

  -- Offene Entwürfe verlieren den Abzug der jetzt stornierten Rechnung (Hinweis wie bei einer gelöschten, PROJ-40)
  perform private.detach_draft_deductions(v_invoice_id);
  return v_credit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Verrechnet je Buchung (Filter „ohne/mit Rechnung“ der Buchungsübersicht): Summe der nacherfassten und ausgestellten Belege.
-- Rechnung und Gutschrift heben sich auf. Feld der Buchung für PostgREST (filterbar), mit den Rechten des Lesenden.
-- ---------------------------------------------------------------------------
create function public.billed_cents(public.bookings)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(i.total_cents), 0)::bigint
  from public.invoices i
  where i.booking_id = $1.id and i.tenant_id = $1.tenant_id and i.origin <> 'draft';
$$;

-- ---------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------
revoke execute on function private.is_credited(uuid) from public, anon, authenticated;
revoke execute on function private.detach_draft_deductions(uuid) from public, anon, authenticated;
revoke execute on function public.issue_credit_note(jsonb) from public, anon, authenticated;
grant execute on function public.issue_credit_note(jsonb) to service_role;
revoke execute on function public.billed_cents(public.bookings) from public, anon;
grant execute on function public.billed_cents(public.bookings) to authenticated;
