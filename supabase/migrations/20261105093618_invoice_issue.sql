-- PROJ-42: Rechnung ausstellen. Der Entwurf wird in einem Schritt zur endgültigen Rechnung: Nummer, Datum, PDF und
-- festgeschriebene Fassung. Ausgestellte Rechnungen sind in der Datenbank unveränderlich. Abgezogene nacherfasste
-- Rechnungen sind teilweise gesperrt; ein Kunde mit ausgestellten Rechnungen in der Aufbewahrungsfrist ist nicht löschbar.
-- RLS bleibt unverändert: ausgestellte Rechnungen lesen wie bisher alle Mitglieder (und der Betreiber).

alter table public.invoices
  add column issued_at timestamptz,
  add column issued_by uuid references public.profiles (id) on delete set null,
  add column issued_snapshot jsonb,
  add column pdf_sha256 text check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  add column issued_without_logo boolean not null default false,
  add constraint invoices_issued_check check (
    case when origin = 'issued'
      then issued_at is not null and jsonb_typeof(issued_snapshot) = 'object' and pdf_path is not null and pdf_sha256 is not null
      else issued_at is null and issued_by is null and issued_snapshot is null and pdf_sha256 is null and not issued_without_logo
    end
  );
comment on column public.invoices.issued_snapshot is 'Festgeschriebene Fassung: alle Werte der Rechnung beim Ausstellen. Die Detailseite zeigt nur diese Kopie; maßgeblich ist das PDF.';
comment on column public.invoices.pdf_sha256 is 'Prüfsumme des abgelegten PDFs: belegt, dass die Datei unverändert ist.';

create index invoices_issued_retention_idx on public.invoices (tenant_id, invoice_date) where origin = 'issued';
create index invoices_issued_by_idx on public.invoices (issued_by) where issued_by is not null;

-- ---------------------------------------------------------------------------
-- Unveränderlichkeit. Erlaubt bleiben nur die Gastverknüpfung (Zusammenführen, PROJ-7) und die Herkunft der Textbausteine
-- (Löschen eines Bausteins setzt sie zurück). Gelöscht wird eine ausgestellte Rechnung nur mit dem Kunden: Die Kaskade läuft,
-- nachdem der Kunde weg ist; admin_delete_tenant prüft vorher die Aufbewahrungsfrist.
-- ---------------------------------------------------------------------------
create function private.protect_issued_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_free constant text[] := array['guest_id', 'intro_block_id', 'payment_block_id', 'closing_block_id', 'updated_at', 'updated_by', 'number_key'];
begin
  if old.origin <> 'issued' then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if exists (select 1 from public.tenants t where t.id = old.tenant_id) then
      raise exception 'Ausgestellte Rechnungen lassen sich nicht löschen.' using errcode = 'P0932';
    end if;
    return old;
  end if;
  if (to_jsonb(new) - v_free) is distinct from (to_jsonb(old) - v_free) then
    raise exception 'Ausgestellte Rechnungen lassen sich nicht ändern.' using errcode = 'P0932';
  end if;
  return new;
end;
$$;
create trigger a_protect_issued_invoice before update or delete on public.invoices
  for each row execute function private.protect_issued_invoice();

-- Positionen und Abzüge einer ausgestellten Rechnung
create function private.protect_issued_children()
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
  if exists (select 1 from public.invoices i where i.id = v_invoice and i.origin = 'issued')
      and exists (select 1 from public.tenants t where t.id = v_tenant) then
    raise exception 'Ausgestellte Rechnungen lassen sich nicht ändern.' using errcode = 'P0932';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger a_protect_issued_lines before insert or update or delete on public.invoice_lines
  for each row execute function private.protect_issued_children();
create trigger a_protect_issued_deductions before insert or update or delete on public.invoice_deductions
  for each row execute function private.protect_issued_children();

-- ---------------------------------------------------------------------------
-- Sammelfunktionen aus PROJ-40: nur noch Entwürfe
-- ---------------------------------------------------------------------------
create or replace function private.refresh_deducting_totals(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invoices f
  set total_cents = private.invoice_total_cents(f.id)
  where f.origin = 'draft'
    and f.id in (select x.invoice_id from public.invoice_deductions x where x.deducted_invoice_id = p_invoice_id)
    and f.total_cents is distinct from private.invoice_total_cents(f.id);
end;
$$;

create or replace function private.detach_deductions(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_finals uuid[];
begin
  with removed as (
    delete from public.invoice_deductions where deducted_invoice_id = p_invoice_id returning invoice_id
  )
  select coalesce(array_agg(invoice_id), '{}') into v_finals from removed;
  if cardinality(v_finals) = 0 then
    return;
  end if;
  -- eigene Anweisung: erst hier ist das Löschen für invoice_total_cents sichtbar
  update public.invoices f
  set deduction_removed = true, total_cents = private.invoice_total_cents(f.id)
  where f.id = any (v_finals) and f.origin = 'draft';
end;
$$;

-- ---------------------------------------------------------------------------
-- Nacherfasste Rechnung, die eine ausgestellte Schlussrechnung abzieht: Positionen, Beträge, Kleinunternehmer-Schalter und
-- Buchung bleiben, wie sie eingeflossen sind; Nummer, Datum, Empfänger, Gast und PDF bleiben änderbar.
-- Meldet die Nummer der Schlussrechnung im Detail.
-- ---------------------------------------------------------------------------
create function private.issued_final_deducting(p_invoice_id uuid)
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
  order by f.number
  limit 1;
$$;

create function private.check_deducted_invoice(p_input jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_input ->> 'id', '')::uuid;
  v_old public.invoices;
  v_final text;
  v_small jsonb := coalesce(p_input -> 'small_business', 'null'::jsonb);
begin
  if v_id is null then
    return;
  end if;
  -- Sperrt die Zeile vor der Prüfung; Rollen und Stand prüft private.save_invoice wie bisher
  select * into v_old from public.invoices where id = v_id for update;
  if v_old.id is null or v_old.origin <> 'backfilled' then
    return;
  end if;
  v_final := private.issued_final_deducting(v_id);
  if v_final is null then
    return;
  end if;
  if v_old.booking_id is distinct from nullif(p_input ->> 'booking_id', '')::uuid
      or (jsonb_typeof(v_small) = 'boolean' and v_small::boolean is distinct from v_old.small_business)
      or (
        select coalesce(jsonb_agg(jsonb_build_array(l.label, l.amount_cents, l.vat_rate) order by l.position), '[]'::jsonb)
        from public.invoice_lines l where l.invoice_id = v_id
      ) is distinct from (
        select coalesce(jsonb_agg(jsonb_build_array(btrim(e.value ->> 'label'), (e.value ->> 'amount_cents')::integer, private.vat_rate(e.value ->> 'vat_rate')) order by e.ord), '[]'::jsonb)
        from jsonb_array_elements(p_input -> 'lines') with ordinality as e(value, ord)
      ) then
    raise exception 'Eine ausgestellte Schlussrechnung zieht diese Rechnung ab.' using errcode = 'P0933', detail = v_final;
  end if;
end;
$$;

-- Erst die Sperre, dann das bisherige Speichern
create or replace function public.save_invoice(p_input jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
begin
  perform private.check_deducted_invoice(p_input);
  return private.save_invoice(p_input);
end;
$$;

create or replace function private.delete_invoice(p_invoice_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
  v_final text;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if v_invoice.id is null or v_invoice.origin <> 'backfilled' or not (private.is_member(v_invoice.tenant_id) or private.is_admin()) then
    raise exception 'Rechnung nicht gefunden.' using errcode = 'P0902';
  end if;
  if not private.has_role(v_invoice.tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0901';
  end if;
  v_final := private.issued_final_deducting(p_invoice_id);
  if v_final is not null then
    raise exception 'Eine ausgestellte Schlussrechnung zieht diese Rechnung ab.' using errcode = 'P0933', detail = v_final;
  end if;
  perform private.detach_deductions(p_invoice_id);
  delete from public.invoices where id = p_invoice_id;
  return v_invoice.pdf_path;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechnung ausstellen. Nur für den Server: Er prüft zuvor Anmeldung, Pflichtangaben und das erzeugte PDF und legt die Datei ab.
-- Hier fällt die endgültige Entscheidung über den Stand: Entwurf, Buchung, Nummer, Datum, Abzüge, Betrag und Datei.
-- p_input: id, tenant_id, actor_id, updated_at, booking_updated_at, number, invoice_date, small_business, total_cents, pdf_path,
--   pdf_sha256, without_logo, snapshot. Ergebnis: Kennung der Rechnung; eine schon ausgestellte Rechnung meldet ihre Kennung.
-- Fehler: P0901 kein Inhaber, P0016 Kunde deaktiviert, P0902 nicht gefunden, P0903 Stand geändert, P0904 Nummer vergeben,
--   P0906 Datum in der Zukunft, P0907 PDF ungültig, P0930 Abzug offen, 22023 ungültige Eingabe.
-- ---------------------------------------------------------------------------
create function public.issue_invoice(p_input jsonb)
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
      or coalesce(p_input ->> 'pdf_sha256', '') !~ '^[0-9a-f]{64}$' then
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

-- ---------------------------------------------------------------------------
-- Kunde löschen: Sperre für ausgestellte Rechnungen in der Aufbewahrungsfrist (7 Jahre ab Ende des Kalenderjahres).
-- Sonst unverändert gegenüber 20261024130000_operator_delete_invitees.sql.
-- ---------------------------------------------------------------------------
create or replace function private.admin_delete_tenant(p_tenant_id uuid, p_confirm_name text)
returns table (user_id uuid, invited_email text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants;
  v_orphans uuid[];
  v_invitees text[];
begin
  perform private.require_admin();
  v_tenant := private.lock_tenant(p_tenant_id, false);
  if v_tenant.status <> 'deactivated' then
    raise exception 'Nur deaktivierte Kunden lassen sich endgültig löschen.' using errcode = 'P0012';
  end if;
  if btrim(coalesce(p_confirm_name, '')) <> btrim(v_tenant.name) then
    raise exception 'Der eingetippte Name stimmt nicht mit dem Kundennamen überein.' using errcode = 'P0013';
  end if;
  if exists (
    select 1 from public.invoices i
    where i.tenant_id = p_tenant_id and i.origin = 'issued'
      and i.invoice_date >= make_date(extract(year from private.today_vienna())::integer - 7, 1, 1)
  ) then
    raise exception 'Ausgestellte Rechnungen fallen noch unter die Aufbewahrungspflicht.' using errcode = 'P0017';
  end if;

  select coalesce(array_agg(m.user_id), '{}') into v_orphans
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  where m.tenant_id = p_tenant_id
    and not p.is_operator_admin
    and not exists (
      select 1 from public.memberships other where other.user_id = m.user_id and other.tenant_id <> p_tenant_id
    )
    and not exists (
      select 1 from public.invitations i
      where lower(i.email) = lower(p.email) and i.status = 'open' and i.tenant_id <> p_tenant_id
    );

  select coalesce(array_agg(distinct i.email), '{}') into v_invitees
  from public.invitations i
  where i.tenant_id = p_tenant_id and i.status = 'open' and i.kind = 'new_account';

  -- Kaskade: Mitgliedschaften, Einladungen und künftig alle Fachdaten mit tenant_id
  delete from public.tenants where id = p_tenant_id;
  -- Änderungsprotokoll dieses Kunden (auch die Einträge, die die Kaskade eben geschrieben hat)
  delete from public.audit_log where tenant_id = p_tenant_id;
  -- Betreiber-Protokoll: Personenangaben entfernen, Einträge als Nachweis behalten
  update public.operator_log set target_email = null where tenant_id = p_tenant_id;
  perform private.log_operator(p_tenant_id, v_tenant.name, 'deleted');

  return query
    select o, null::text from unnest(v_orphans) as o
    union all
    select null::uuid, e from unnest(v_invitees) as e;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------
revoke execute on function private.protect_issued_invoice() from public, anon, authenticated;
revoke execute on function private.protect_issued_children() from public, anon, authenticated;
revoke execute on function private.issued_final_deducting(uuid) from public, anon;
revoke execute on function private.check_deducted_invoice(jsonb) from public, anon;
revoke execute on function public.issue_invoice(jsonb) from public, anon, authenticated;
grant execute on function private.issued_final_deducting(uuid) to authenticated;
grant execute on function private.check_deducted_invoice(jsonb) to authenticated;
grant execute on function public.issue_invoice(jsonb) to service_role;
