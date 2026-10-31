-- PROJ-40: Rechnungsdaten sammeln (Entwurf)
--
-- * invoices: Herkunft zusätzlich 'draft' (PROJ-41: 'issued'); Nummer bei Entwürfen leer. Neue Felder für Art,
--   Empfänger (einzelne Felder), Anrede bei Firma, Gastnamen, Teilbetrag, Texte der Blöcke 4/6/7 (Kopie mit Verweis
--   auf den Baustein), Zahlungsregeln, Fingerabdruck der Buchung und Kennzeichen „abgezogene Rechnung entfernt“.
-- * invoice_lines: Herkunft in der Buchung (Übernachtung, Stornogebühr, bestimmte Zusatzkosten-Position)
-- * invoice_deductions: Schlussrechnung → abgezogene Rechnung (Teilrechnung oder nacherfasste Rechnung derselben
--   Buchung). Betrag und Sätze kommen aus der abgezogenen Rechnung; ihr Gesamtbetrag geht in den der Schlussrechnung ein.
-- * Lesen: Mitglieder wie bisher; der Betreiber sieht keine Entwürfe
-- * save_invoice_draft, delete_invoice_draft (nur Inhaber), invoice_preview_data (Inhaber und Mitarbeiter)
-- * booking_invoices mit Art; save_invoice übernimmt den Kleinunternehmer-Schalter (PROJ-37-Änderung) und ändert nur
--   nacherfasste Rechnungen; delete_invoice löscht nur nacherfasste Rechnungen; invoice_numbers ohne leere Nummern
-- * save_booking: Zusatzkosten-Positionen behalten ihre Kennung (Abgleich statt Löschen und Neuanlegen)
--
-- Fehlercodes: P0920 nichts zu verrechnen (Sperre, Storno ohne Gebühr, Summenregel beim Anlegen), P0921 Abzug ungültig,
-- P0922 Inhalt ungültig, P0923 kein Entwurf; dazu P0901 nur Inhaber, P0902 nicht gefunden, P0903 inzwischen geändert,
-- P0908 Buchung ungültig, 42501 keine Berechtigung.

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------------
-- Kennung aus Text, sonst null (statt Abbruch bei ungültigem Format)
create function private.json_uuid(p_value text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_value::uuid end;
$$;

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------
alter table public.invoices alter column number drop not null;
alter table public.invoices drop constraint invoices_origin_check;
alter table public.invoices add constraint invoices_origin_check check (origin in ('backfilled', 'draft', 'issued'));
-- Entwürfe nie mit Nummer, alle anderen immer
alter table public.invoices add constraint invoices_number_origin_check check ((number is null) = (origin = 'draft'));

alter table public.invoices
  add column kind text check (kind in ('invoice', 'partial', 'final')),
  add column recipient_kind text check (recipient_kind in ('guest', 'company')),
  add column recipient_name text check (recipient_name = btrim(recipient_name) and length(recipient_name) between 1 and 200),
  add column recipient_line1 text check (recipient_line1 = btrim(recipient_line1) and length(recipient_line1) between 1 and 200),
  add column recipient_line2 text check (recipient_line2 = btrim(recipient_line2) and length(recipient_line2) between 1 and 200),
  add column recipient_postal_code text check (recipient_postal_code = btrim(recipient_postal_code) and length(recipient_postal_code) between 1 and 10),
  add column recipient_city text check (recipient_city = btrim(recipient_city) and length(recipient_city) between 1 and 100),
  add column recipient_country text check (recipient_country ~ '^[A-Z]{2}$'),
  add column recipient_vat_id text check (recipient_vat_id ~ '^\S{1,30}$'),
  add column company_salutation text check (company_salutation in ('generic', 'guest')),
  add column guest_names text check (guest_names in ('none', 'main', 'all')),
  add column partial_mode text check (partial_mode in ('percent', 'amount')),
  add column partial_percent numeric(5, 2) check (partial_percent between 0.01 and 100),
  add column partial_amount_cents bigint check (partial_amount_cents between 1 and 100000000),
  add column intro_block_id uuid references public.invoice_text_blocks (id) on delete set null,
  add column intro_text jsonb check (intro_text is null or private.rich_text_valid(intro_text, 2000, private.invoice_placeholders('intro', false))),
  add column payment_block_id uuid references public.invoice_text_blocks (id) on delete set null,
  add column payment_text jsonb,
  add column closing_block_id uuid references public.invoice_text_blocks (id) on delete set null,
  add column closing_text jsonb check (closing_text is null or private.rich_text_valid(closing_text, 2000, private.invoice_placeholders('closing', false))),
  add column deposit_percent numeric(5, 2) check (deposit_percent between 1 and 100),
  add column deposit_days smallint check (deposit_days between 0 and 365),
  add column due_days smallint check (due_days between 0 and 365),
  add column due_basis text check (due_basis in ('after_invoice', 'before_arrival')),
  add column booking_fingerprint text check (length(booking_fingerprint) between 1 and 64),
  add column deduction_removed boolean not null default false,
  add constraint invoices_deposit_check check ((deposit_percent is null) = (deposit_days is null)),
  add constraint invoices_payment_text_check check (
    payment_text is null or private.rich_text_valid(payment_text, 2000, private.invoice_placeholders('payment', deposit_percent is not null))
  ),
  -- Entwürfe (und später ausgestellte Rechnungen) haben Art, Empfängerart und Fälligkeit; Teilbetrag nur bei Teilrechnungen
  add constraint invoices_draft_fields_check check (
    origin = 'backfilled'
    or (kind is not null and recipient_kind is not null and company_salutation is not null and guest_names is not null
      and due_days is not null and due_basis is not null)
  ),
  add constraint invoices_partial_check check (
    case when kind = 'partial' then partial_mode is not null and partial_amount_cents is not null
      and ((partial_mode = 'percent') = (partial_percent is not null))
    else partial_mode is null and partial_percent is null and partial_amount_cents is null end
  );

comment on table public.invoices is
  'Rechnungen je Kunde (PROJ-37: nacherfasst; PROJ-40: Entwurf ohne Nummer; PROJ-41: ausgestellt). Schreiben nur über die Funktionen.';
comment on column public.invoices.small_business is
  'Nacherfasst: Schalter „Ohne Umsatzsteuer (Kleinunternehmer)“. Entwurf: Momentaufnahme nach der Buchung (PROJ-36), angezeigt wird der aktuelle Status.';
comment on column public.invoices.total_cents is
  'Gesamtbetrag brutto: Summe der Positionen, bei Schlussrechnungen minus die Gesamtbeträge der abgezogenen Rechnungen.';
comment on column public.invoices.recipient is 'Anzeigename für Liste und Suche; bei Entwürfen der Empfängername (leer: „–“).';
comment on column public.invoices.booking_fingerprint is 'Fingerabdruck der preisrelevanten Buchungsdaten beim letzten Speichern (Hinweis „Buchung geändert“).';
comment on column public.invoices.deduction_removed is 'Schlussrechnung: eine abgezogene Rechnung wurde gelöscht oder ist keine Teilrechnung mehr; Speichern setzt es zurück.';

create index invoices_intro_block_idx on public.invoices (intro_block_id) where intro_block_id is not null;
create index invoices_payment_block_idx on public.invoices (payment_block_id) where payment_block_id is not null;
create index invoices_closing_block_idx on public.invoices (closing_block_id) where closing_block_id is not null;

-- Positionen: Herkunft in der Buchung. Bezeichnung bis 300 Zeichen (Teilrechnung: „Anzahlung für Aufenthalt in
-- {Objekt · Wohnung} vom … bis …“); eigene Bezeichnungen begrenzen die Funktionen weiter auf 100.
alter table public.invoice_lines drop constraint invoice_lines_label_check;
alter table public.invoice_lines add constraint invoice_lines_label_check check (label = btrim(label) and length(label) between 1 and 300);
alter table public.invoice_lines
  add column source_kind text check (source_kind in ('nights', 'cancellation_fee', 'charge')),
  -- gelöschte Zusatzkosten verlieren die Verbindung bewusst (Kennzeichen bleibt „charge“)
  add column source_charge_id uuid references public.booking_charges (id) on delete set null,
  add constraint invoice_lines_source_check check (source_charge_id is null or source_kind = 'charge');
comment on column public.invoice_lines.source_kind is 'Herkunft in der Buchung (PROJ-40): nights, cancellation_fee, charge oder null (eigene Position).';
create index invoice_lines_source_charge_idx on public.invoice_lines (source_charge_id) where source_charge_id is not null;

create table public.invoice_deductions (
  invoice_id uuid not null,
  deducted_invoice_id uuid not null,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint invoice_deductions_pkey primary key (invoice_id, deducted_invoice_id),
  constraint invoice_deductions_self_check check (invoice_id <> deducted_invoice_id),
  constraint invoice_deductions_invoice_fkey foreign key (invoice_id, tenant_id)
    references public.invoices (id, tenant_id) on delete cascade,
  constraint invoice_deductions_deducted_fkey foreign key (deducted_invoice_id, tenant_id)
    references public.invoices (id, tenant_id) on delete cascade
);
comment on table public.invoice_deductions is
  'Abzüge einer Schlussrechnung (PROJ-40). Schreiben nur über save_invoice_draft; Änderungen protokolliert die Schlussrechnung.';
create index invoice_deductions_deducted_idx on public.invoice_deductions (deducted_invoice_id, tenant_id);
create index invoice_deductions_tenant_idx on public.invoice_deductions (tenant_id);

revoke all on public.invoice_deductions from anon, authenticated;
grant select on public.invoice_deductions to authenticated;
alter table public.invoice_deductions enable row level security;

-- ---------------------------------------------------------------------------
-- Lesen: Mitglieder alles; der Betreiber keine Entwürfe (samt Positionen und Abzügen)
-- ---------------------------------------------------------------------------
drop policy "Mitglieder und Admin lesen Rechnungen" on public.invoices;
drop policy "Mitglieder und Admin lesen Rechnungspositionen" on public.invoice_lines;

create policy "Mitglieder und Admin lesen Rechnungen" on public.invoices for select to authenticated
  using (private.is_member(tenant_id) or (origin <> 'draft' and (select private.is_admin())));
create policy "Mitglieder und Admin lesen Rechnungspositionen" on public.invoice_lines for select to authenticated
  using (
    private.is_member(tenant_id)
    or ((select private.is_admin()) and exists (
      select 1 from public.invoices i where i.id = invoice_id and i.origin <> 'draft'
    ))
  );
create policy "Mitglieder und Admin lesen Abzüge" on public.invoice_deductions for select to authenticated
  using (
    private.is_member(tenant_id)
    or ((select private.is_admin()) and exists (
      select 1 from public.invoices i where i.id = invoice_id and i.origin <> 'draft'
    ))
  );

-- ---------------------------------------------------------------------------
-- Gesamtpreis einer Buchung (aktiv: abgerechnete Übernachtung + Zusatzkosten; storniert: Stornogebühr, sonst 0)
-- ---------------------------------------------------------------------------
create function private.booking_billable_cents(p_booking_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when b.cancelled_at is not null then coalesce(am.cancellation_fee_cents, 0)
    else coalesce(am.billed_nights_cents, am.nights_cents, 0)
      + coalesce((select sum(c.amount_cents) from public.booking_charges c where c.booking_id = b.id), 0)
  end
  from public.bookings b
  left join public.booking_amounts am on am.id = b.id
  where b.id = p_booking_id;
$$;

-- Gesamtbetrag einer Rechnung: Summe der Positionen minus die Gesamtbeträge der abgezogenen Rechnungen
create function private.invoice_total_cents(p_invoice_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select sum(l.amount_cents) from public.invoice_lines l where l.invoice_id = p_invoice_id), 0)
    - coalesce((
      select sum(d.total_cents)
      from public.invoice_deductions x
      join public.invoices d on d.id = x.deducted_invoice_id
      where x.invoice_id = p_invoice_id
    ), 0);
$$;

-- Schlussrechnungen, die p_invoice_id abziehen: Gesamtbetrag neu bilden (nur bei Abweichung)
create function private.refresh_deducting_totals(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invoices f
  set total_cents = private.invoice_total_cents(f.id)
  where f.id in (select x.invoice_id from public.invoice_deductions x where x.deducted_invoice_id = p_invoice_id)
    and f.total_cents is distinct from private.invoice_total_cents(f.id);
end;
$$;

-- Abzüge auf p_invoice_id entfernen (gelöscht oder keine Teilrechnung mehr): Schlussrechnungen erhalten den Hinweis
-- „Abgezogene Rechnung existiert nicht mehr“ und einen neu gebildeten Gesamtbetrag
create function private.detach_deductions(p_invoice_id uuid)
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
  where f.id = any (v_finals);
end;
$$;

-- ---------------------------------------------------------------------------
-- Entwurf speichern (Anlegen: id null; Ändern: id + updated_at). Positionen und Abzüge werden vollständig ersetzt.
-- p_input: id, updated_at, tenant_id, booking_id, kind, invoice_date, recipient_kind,
--   recipient {name, line1, line2, postal_code, city, country, vat_id}, company_salutation, guest_names,
--   partial {mode, percent ("20.00"|null), amount_cents} | null,
--   lines [{label, amount_cents, vat_rate ("10.00"), source_kind, source_charge_id}], deduction_ids [uuid],
--   texts {intro|payment|closing: {block_id, body}}, payment {deposit_percent, deposit_days, due_days, due_basis},
--   booking_fingerprint
-- Ergebnis: id des Entwurfs
-- ---------------------------------------------------------------------------
create function private.save_invoice_draft(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := private.json_uuid(p_input ->> 'tenant_id');
  v_id uuid := private.json_uuid(p_input ->> 'id');
  v_booking_id uuid := private.json_uuid(p_input ->> 'booking_id');
  v_kind text := p_input ->> 'kind';
  v_date date;
  v_recipient_kind text := p_input ->> 'recipient_kind';
  v_r jsonb := case when jsonb_typeof(p_input -> 'recipient') = 'object' then p_input -> 'recipient' else '{}'::jsonb end;
  v_name text := nullif(btrim(v_r ->> 'name'), '');
  v_line1 text := nullif(btrim(v_r ->> 'line1'), '');
  v_line2 text := nullif(btrim(v_r ->> 'line2'), '');
  v_postal text := nullif(btrim(v_r ->> 'postal_code'), '');
  v_city text := nullif(btrim(v_r ->> 'city'), '');
  v_country text := nullif(upper(btrim(v_r ->> 'country')), '');
  v_vat_id text := nullif(upper(regexp_replace(coalesce(v_r ->> 'vat_id', ''), '\s', '', 'g')), '');
  v_salutation text := p_input ->> 'company_salutation';
  v_guest_names text := p_input ->> 'guest_names';
  v_partial jsonb := case when jsonb_typeof(p_input -> 'partial') = 'object' then p_input -> 'partial' end;
  v_partial_mode text;
  v_partial_percent numeric;
  v_partial_amount bigint;
  v_lines jsonb := p_input -> 'lines';
  v_deduction_input jsonb := coalesce(p_input -> 'deduction_ids', '[]'::jsonb);
  v_deductions uuid[] := '{}';
  v_texts jsonb := case when jsonb_typeof(p_input -> 'texts') = 'object' then p_input -> 'texts' else '{}'::jsonb end;
  v_payment jsonb := case when jsonb_typeof(p_input -> 'payment') = 'object' then p_input -> 'payment' else '{}'::jsonb end;
  v_deposit_percent numeric;
  v_deposit_days integer;
  v_due_days integer;
  v_due_basis text := v_payment ->> 'due_basis';
  v_fingerprint text := nullif(btrim(p_input ->> 'booking_fingerprint'), '');
  v_block text;
  v_body jsonb;
  v_bodies jsonb := '{}'::jsonb;
  v_block_ids jsonb := '{}'::jsonb;
  v_old public.invoices;
  v_booking public.bookings;
  v_billable bigint;
  v_billed bigint;
  v_small boolean;
  v_total bigint;
begin
  if v_tenant is null or not private.has_role(v_tenant, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0901';
  end if;

  if v_id is not null then
    select * into v_old from public.invoices where id = v_id and tenant_id = v_tenant for update;
    if v_old.id is null then
      raise exception 'Rechnung nicht gefunden.' using errcode = 'P0902';
    end if;
    if v_old.origin <> 'draft' then
      raise exception 'Nur Entwürfe lassen sich hier ändern.' using errcode = 'P0923';
    end if;
    if v_old.updated_at is distinct from (p_input ->> 'updated_at')::timestamptz then
      raise exception 'Der Entwurf wurde inzwischen geändert.' using errcode = 'P0903';
    end if;
    -- Ein Entwurf bleibt bei seiner Buchung
    if v_booking_id is distinct from v_old.booking_id then
      raise exception 'Buchung nicht wählbar.' using errcode = 'P0908';
    end if;
  elsif nullif(p_input ->> 'id', '') is not null then
    raise exception 'Rechnung nicht gefunden.' using errcode = 'P0902';
  end if;

  -- Buchung desselben Kunden; Sperren haben nichts zu verrechnen
  select * into v_booking from public.bookings where id = v_booking_id and tenant_id = v_tenant;
  if v_booking.id is null then
    raise exception 'Buchung nicht wählbar.' using errcode = 'P0908';
  end if;
  if v_booking.kind = 'block' then
    raise exception 'Bei Sperren gibt es nichts zu verrechnen.' using errcode = 'P0920';
  end if;

  -- Summenregel nur beim Anlegen: nacherfasst + ausgestellt + Entwürfe < Gesamtpreis (storniert: Stornogebühr).
  -- Ohne Sperre der Buchung: gleichzeitig angelegte Entwürfe werden beide gespeichert (Spec, Edge Cases).
  if v_old.id is null then
    v_billable := coalesce(private.booking_billable_cents(v_booking.id), 0);
    select coalesce(sum(i.total_cents), 0) into v_billed
    from public.invoices i where i.booking_id = v_booking.id and i.tenant_id = v_tenant;
    if v_billable <= 0 or v_billed >= v_billable then
      raise exception 'Nichts mehr zu verrechnen.' using errcode = 'P0920';
    end if;
  end if;

  -- Rechnungsdatum (frei wählbar, keine Prüfung gegen die Nummernfolge vor PROJ-41)
  begin
    v_date := (p_input ->> 'invoice_date')::date;
  exception when others then
    v_date := null;
  end;

  if coalesce(v_kind, '') not in ('invoice', 'partial', 'final')
      or v_date is null or v_date not between '1990-01-01' and '2200-12-31'
      or coalesce(v_recipient_kind, '') not in ('guest', 'company')
      or coalesce(v_salutation, '') not in ('generic', 'guest')
      or coalesce(v_guest_names, '') not in ('none', 'main', 'all')
      or length(v_name) > 200 or length(v_line1) > 200 or length(v_line2) > 200
      or length(v_postal) > 10 or length(v_city) > 100
      or v_country !~ '^[A-Z]{2}$' or length(v_vat_id) > 30
      or length(v_fingerprint) > 64 then
    raise exception 'Ungültiger Entwurf.' using errcode = 'P0922';
  end if;

  -- Zahlungsregeln (Grenzen wie PROJ-39); ohne Anzahlung beide Werte leer
  if jsonb_typeof(v_payment -> 'deposit_percent') = 'number' then
    v_deposit_percent := (v_payment #>> '{deposit_percent}')::numeric;
    v_deposit_days := private.json_int(v_payment -> 'deposit_days', 0, 365);
    if v_deposit_percent not between 1 and 100 or v_deposit_percent <> round(v_deposit_percent, 2) or v_deposit_days is null then
      raise exception 'Ungültige Anzahlung.' using errcode = 'P0922';
    end if;
  elsif jsonb_typeof(coalesce(v_payment -> 'deposit_percent', 'null'::jsonb)) <> 'null'
      or jsonb_typeof(coalesce(v_payment -> 'deposit_days', 'null'::jsonb)) <> 'null' then
    raise exception 'Ungültige Anzahlung.' using errcode = 'P0922';
  end if;
  v_due_days := private.json_int(v_payment -> 'due_days', 0, 365);
  if v_due_days is null or coalesce(v_due_basis, '') not in ('after_invoice', 'before_arrival') then
    raise exception 'Ungültige Fälligkeit.' using errcode = 'P0922';
  end if;

  -- Texte: Kopie im Format der Bausteine (PROJ-39), Platzhalter je Block; {Anzahlung} & Co. nur mit Anzahlung.
  -- Der Verweis auf den Baustein dient nur der Anzeige; fremde oder inzwischen gelöschte Bausteine → kein Verweis.
  foreach v_block in array array['intro', 'payment', 'closing'] loop
    v_body := case when jsonb_typeof(v_texts -> v_block -> 'body') = 'object' then v_texts -> v_block -> 'body' end;
    if jsonb_typeof(coalesce(v_texts -> v_block -> 'body', 'null'::jsonb)) not in ('object', 'null')
        or (v_body is not null and not private.rich_text_valid(
          v_body, 2000, private.invoice_placeholders(v_block, v_block = 'payment' and v_deposit_percent is not null))) then
      raise exception 'Ungültiger Text.' using errcode = 'P0922';
    end if;
    v_bodies := v_bodies || jsonb_build_object(v_block, v_body);
    v_block_ids := v_block_ids || jsonb_build_object(v_block, (
      select b.id from public.invoice_text_blocks b
      where b.id = private.json_uuid(v_texts -> v_block ->> 'block_id') and b.tenant_id = v_tenant and b.block = v_block
    ));
  end loop;

  -- Teilbetrag (nur Teilrechnung): Prozent 0,01–100 oder Betrag; Betrag > 0
  if v_kind = 'partial' then
    v_partial_mode := v_partial ->> 'mode';
    if coalesce(v_partial_mode, '') not in ('percent', 'amount')
        or jsonb_typeof(v_partial -> 'amount_cents') is distinct from 'number' then
      raise exception 'Ungültiger Teilbetrag.' using errcode = 'P0922';
    end if;
    v_partial_amount := private.json_int(v_partial -> 'amount_cents', 1, 100000000);
    if v_partial_amount is null then
      raise exception 'Ungültiger Teilbetrag.' using errcode = 'P0922';
    end if;
    if v_partial_mode = 'percent' then
      if coalesce(v_partial ->> 'percent', '') !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' then
        raise exception 'Ungültiger Prozentsatz.' using errcode = 'P0922';
      end if;
      v_partial_percent := (v_partial ->> 'percent')::numeric;
      if v_partial_percent not between 0.01 and 100 then
        raise exception 'Ungültiger Prozentsatz.' using errcode = 'P0922';
      end if;
    end if;
  end if;

  -- Positionen: höchstens 50 (Teilrechnung mindestens eine, Summe = Teilbetrag, ohne Herkunft); Bezeichnung 1–100
  -- (Teilrechnung bis 300), Betrag ganze Cent, Satz als Dezimalzahl 0–100; Zusatzkosten nur aus dieser Buchung
  if jsonb_typeof(v_lines) is distinct from 'array'
      or jsonb_array_length(v_lines) > 50
      or (v_kind = 'partial' and jsonb_array_length(v_lines) = 0)
      or exists (
        select 1 from jsonb_array_elements(v_lines) e
        where jsonb_typeof(e) <> 'object'
           or length(btrim(coalesce(e ->> 'label', ''))) not between 1 and case when v_kind = 'partial' then 300 else 100 end
           or private.json_int(e -> 'amount_cents', -100000000, 100000000) is null
           or coalesce(e ->> 'vat_rate', '') !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$'
           or case when coalesce(e ->> 'vat_rate', '') ~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' then (e ->> 'vat_rate')::numeric > 100 else true end
           or case coalesce(e ->> 'source_kind', '')
                when '' then nullif(e ->> 'source_charge_id', '') is not null
                when 'nights' then v_kind = 'partial' or nullif(e ->> 'source_charge_id', '') is not null
                when 'cancellation_fee' then v_kind = 'partial' or nullif(e ->> 'source_charge_id', '') is not null
                when 'charge' then v_kind = 'partial' or not exists (
                  select 1 from public.booking_charges c
                  where c.id = private.json_uuid(e ->> 'source_charge_id') and c.booking_id = v_booking.id
                )
                else true
              end
      ) then
    raise exception 'Ungültige Positionen.' using errcode = 'P0922';
  end if;
  if v_kind = 'partial' and (
    select sum((e ->> 'amount_cents')::bigint) from jsonb_array_elements(v_lines) e
  ) <> v_partial_amount then
    raise exception 'Die Positionen ergeben nicht den Teilbetrag.' using errcode = 'P0922';
  end if;

  -- Abzüge: nur bei Schlussrechnungen; Teilrechnungen (Entwurf oder ausgestellt) und nacherfasste Rechnungen derselben
  -- Buchung, nicht der Entwurf selbst
  if jsonb_typeof(v_deduction_input) <> 'array' or jsonb_array_length(v_deduction_input) > 50 then
    raise exception 'Ungültige Abzüge.' using errcode = 'P0921';
  end if;
  select coalesce(array_agg(distinct private.json_uuid(e #>> '{}')), '{}') into v_deductions
  from jsonb_array_elements(v_deduction_input) e;
  if cardinality(v_deductions) > 0 and (
    v_kind <> 'final'
    or array_position(v_deductions, null) is not null
    or (
      select count(*) from public.invoices i
      where i.id = any (v_deductions)
        and i.tenant_id = v_tenant
        and i.booking_id = v_booking.id
        and i.id is distinct from v_id
        and (i.origin = 'backfilled' or (i.kind = 'partial' and i.origin in ('draft', 'issued')))
    ) <> cardinality(v_deductions)
  ) then
    raise exception 'Ungültige Abzüge.' using errcode = 'P0921';
  end if;

  -- Kleinunternehmer nach der Buchung (PROJ-36: Abreise, storniert: Stornodatum) – nur Momentaufnahme
  select coalesce((
    select v.small_business from public.vat_status_changes v
    where v.tenant_id = v_tenant
      and v.valid_from <= case
        when v_booking.cancelled_at is not null then (v_booking.cancelled_at at time zone 'Europe/Vienna')::date
        else v_booking.departure
      end
    order by v.valid_from desc limit 1
  ), false) into v_small;

  -- Gesamtbetrag: Positionen minus abgezogene Rechnungen
  v_total := coalesce((select sum((e ->> 'amount_cents')::bigint) from jsonb_array_elements(v_lines) e), 0)
    - coalesce((select sum(i.total_cents) from public.invoices i where i.id = any (v_deductions)), 0);

  if v_old.id is null then
    insert into public.invoices (
      tenant_id, number, invoice_date, origin, booking_id, guest_id, recipient, small_business, total_cents,
      kind, recipient_kind, recipient_name, recipient_line1, recipient_line2, recipient_postal_code, recipient_city,
      recipient_country, recipient_vat_id, company_salutation, guest_names, partial_mode, partial_percent,
      partial_amount_cents, intro_block_id, intro_text, payment_block_id, payment_text, closing_block_id, closing_text,
      deposit_percent, deposit_days, due_days, due_basis, booking_fingerprint, deduction_removed
    ) values (
      v_tenant, null, v_date, 'draft', v_booking.id, v_booking.guest_id, coalesce(v_name, '–'), v_small, v_total,
      v_kind, v_recipient_kind, v_name, v_line1, v_line2, v_postal, v_city,
      v_country, v_vat_id, v_salutation, v_guest_names, v_partial_mode, v_partial_percent,
      v_partial_amount, (v_block_ids ->> 'intro')::uuid, nullif(v_bodies -> 'intro', 'null'::jsonb), (v_block_ids ->> 'payment')::uuid,
      nullif(v_bodies -> 'payment', 'null'::jsonb), (v_block_ids ->> 'closing')::uuid, nullif(v_bodies -> 'closing', 'null'::jsonb),
      v_deposit_percent, v_deposit_days, v_due_days, v_due_basis, v_fingerprint, false
    ) returning id into v_id;
  else
    update public.invoices set
      invoice_date = v_date,
      guest_id = v_booking.guest_id,
      recipient = coalesce(v_name, '–'),
      small_business = v_small,
      total_cents = v_total,
      kind = v_kind,
      recipient_kind = v_recipient_kind,
      recipient_name = v_name,
      recipient_line1 = v_line1,
      recipient_line2 = v_line2,
      recipient_postal_code = v_postal,
      recipient_city = v_city,
      recipient_country = v_country,
      recipient_vat_id = v_vat_id,
      company_salutation = v_salutation,
      guest_names = v_guest_names,
      partial_mode = v_partial_mode,
      partial_percent = v_partial_percent,
      partial_amount_cents = v_partial_amount,
      intro_block_id = (v_block_ids ->> 'intro')::uuid,
      intro_text = nullif(v_bodies -> 'intro', 'null'::jsonb),
      payment_block_id = (v_block_ids ->> 'payment')::uuid,
      payment_text = nullif(v_bodies -> 'payment', 'null'::jsonb),
      closing_block_id = (v_block_ids ->> 'closing')::uuid,
      closing_text = nullif(v_bodies -> 'closing', 'null'::jsonb),
      deposit_percent = v_deposit_percent,
      deposit_days = v_deposit_days,
      due_days = v_due_days,
      due_basis = v_due_basis,
      booking_fingerprint = v_fingerprint,
      deduction_removed = false
    where id = v_id;
    delete from public.invoice_lines where invoice_id = v_id;
    delete from public.invoice_deductions where invoice_id = v_id;
  end if;

  insert into public.invoice_lines (tenant_id, invoice_id, position, label, amount_cents, vat_rate, source_kind, source_charge_id)
  select v_tenant, v_id, l.ord, btrim(l.value ->> 'label'), (l.value ->> 'amount_cents')::integer, (l.value ->> 'vat_rate')::numeric,
    nullif(l.value ->> 'source_kind', ''), private.json_uuid(l.value ->> 'source_charge_id')
  from jsonb_array_elements(v_lines) with ordinality as l(value, ord);

  insert into public.invoice_deductions (invoice_id, deducted_invoice_id, tenant_id)
  select v_id, d, v_tenant from unnest(v_deductions) d;

  -- Schlussrechnungen, die diesen Entwurf abziehen: keine Teilrechnung mehr → Abzug entfällt, sonst neuer Betrag
  if v_old.id is not null then
    if v_kind <> 'partial' then
      perform private.detach_deductions(v_id);
    else
      perform private.refresh_deducting_totals(v_id);
    end if;
  end if;

  return v_id;
end;
$$;

create function public.save_invoice_draft(p_input jsonb)
returns uuid
language sql security invoker set search_path = ''
as $$ select private.save_invoice_draft(p_input); $$;

-- ---------------------------------------------------------------------------
-- Entwurf löschen (nur Inhaber, nur Entwürfe). Schlussrechnungen, die ihn abziehen, verlieren den Abzug.
-- Ergebnis: Buchung des Entwurfs
-- ---------------------------------------------------------------------------
create function private.delete_invoice_draft(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if v_invoice.id is null or not private.is_member(v_invoice.tenant_id) then
    raise exception 'Rechnung nicht gefunden.' using errcode = 'P0902';
  end if;
  if not private.has_role(v_invoice.tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0901';
  end if;
  if v_invoice.origin <> 'draft' then
    raise exception 'Nur Entwürfe lassen sich hier löschen.' using errcode = 'P0923';
  end if;
  perform private.detach_deductions(p_invoice_id);
  delete from public.invoices where id = p_invoice_id;
  return v_invoice.booking_id;
end;
$$;

create function public.delete_invoice_draft(p_invoice_id uuid)
returns uuid
language sql security invoker set search_path = ''
as $$ select private.delete_invoice_draft(p_invoice_id); $$;

-- ---------------------------------------------------------------------------
-- Vorschau-Daten für Inhaber und Mitarbeiter: Aussteller, Fußzeile, Kleinunternehmer-Hinweis und -Verlauf
-- (Mitarbeiter lesen Stammdaten und Rechnungseinstellungen sonst nicht)
-- ---------------------------------------------------------------------------
create function private.invoice_preview_data(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_tenant_id is null or not private.is_member(p_tenant_id) then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'issuer', jsonb_build_object(
        'name', t.name, 'name_line2', t.name_line2, 'address_line1', t.address_line1, 'address_line2', t.address_line2,
        'postal_code', t.postal_code, 'city', t.city, 'country', t.country, 'vat_id', t.vat_id
      ),
      'footer', s.footer,
      'small_business_note', s.small_business_note,
      'vat_status', coalesce((
        select jsonb_agg(jsonb_build_object('valid_from', v.valid_from, 'small_business', v.small_business) order by v.valid_from)
        from public.vat_status_changes v where v.tenant_id = t.id
      ), '[]'::jsonb)
    )
    from public.tenants t
    left join public.invoice_settings s on s.tenant_id = t.id
    where t.id = p_tenant_id
  );
end;
$$;

create function public.invoice_preview_data(p_tenant_id uuid)
returns jsonb
language sql security invoker set search_path = ''
as $$ select private.invoice_preview_data(p_tenant_id); $$;

-- ---------------------------------------------------------------------------
-- Rechnungen einer Buchung: zusätzlich Art; der Betreiber sieht keine Entwürfe. Gesamtpreis über
-- private.booking_billable_cents (gleiche Regel wie bisher).
-- ---------------------------------------------------------------------------
create or replace function private.booking_invoices(p_booking_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with b as (
    select b.id, b.tenant_id, private.is_member(b.tenant_id) as member
    from public.bookings b
    where b.id = p_booking_id and b.kind <> 'block'
      and (private.is_member(b.tenant_id) or private.is_admin())
  )
  select jsonb_build_object(
    'booking_total_cents', (select private.booking_billable_cents(b.id) from b),
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'number', i.number, 'invoice_date', i.invoice_date, 'recipient', i.recipient,
        'total_cents', i.total_cents, 'origin', i.origin, 'kind', i.kind, 'has_pdf', i.pdf_path is not null
      ) order by i.invoice_date, i.number nulls first)
      from public.invoices i join b on i.booking_id = b.id and i.tenant_id = b.tenant_id
      where b.member or i.origin <> 'draft'
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Rechnung nacherfassen (PROJ-37-Änderung): Kleinunternehmer-Kennzeichen aus dem Schalter (p_input.small_business);
-- ohne Angabe wie bisher nach dem Rechnungsdatum. Nur nacherfasste Rechnungen; Schlussrechnungs-Entwürfe, die sie
-- abziehen, erhalten einen neuen Betrag (bzw. verlieren den Abzug, wenn die Buchung wechselt).
-- Sonst unverändert gegenüber 20261031110516_invoice_settings.sql.
-- ---------------------------------------------------------------------------
create or replace function private.save_invoice(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := nullif(p_input ->> 'tenant_id', '')::uuid;
  v_id uuid := nullif(p_input ->> 'id', '')::uuid;
  v_number text := btrim(coalesce(p_input ->> 'number', ''));
  v_date date := nullif(p_input ->> 'invoice_date', '')::date;
  v_booking_id uuid := nullif(p_input ->> 'booking_id', '')::uuid;
  v_guest_id uuid := nullif(p_input ->> 'guest_id', '')::uuid;
  v_new_guest jsonb := case when jsonb_typeof(p_input -> 'new_guest') = 'object' then p_input -> 'new_guest' end;
  v_recipient text := btrim(coalesce(p_input ->> 'recipient', ''));
  v_lines jsonb := p_input -> 'lines';
  v_pdf text := nullif(btrim(coalesce(p_input ->> 'pdf_path', '')), '');
  v_small_input jsonb := coalesce(p_input -> 'small_business', 'null'::jsonb);
  v_old public.invoices;
  v_guest public.guests;
  v_taken date;
  v_small boolean;
  v_total bigint;
begin
  if v_tenant is null or not private.has_role(v_tenant, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0901';
  end if;

  if v_id is not null then
    select * into v_old from public.invoices where id = v_id and tenant_id = v_tenant for update;
    -- PROJ-40: Entwürfe (und später ausgestellte Rechnungen) nicht über das Nacherfassen
    if v_old.id is null or v_old.origin <> 'backfilled' then
      raise exception 'Rechnung nicht gefunden.' using errcode = 'P0902';
    end if;
    if v_old.updated_at is distinct from (p_input ->> 'updated_at')::timestamptz then
      raise exception 'Die Rechnung wurde inzwischen geändert.' using errcode = 'P0903';
    end if;
  else
    -- Der Schalter gilt nur fürs Anlegen
    -- PROJ-39: Schalter in den Rechnungseinstellungen (ohne Zeile: Voreinstellung ein)
    if not coalesce((select s.backfill_enabled from public.invoice_settings s where s.tenant_id = v_tenant), true) then
      raise exception 'Das Nacherfassen ist ausgeschaltet.' using errcode = 'P0905';
    end if;
  end if;

  -- Pflichtangaben und Grenzen
  if length(v_number) not between 1 and 30 or length(v_recipient) not between 1 and 200 or v_date is null
      or jsonb_typeof(v_small_input) not in ('boolean', 'null') then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;
  if v_date > private.today_vienna() then
    raise exception 'Das Rechnungsdatum darf nicht in der Zukunft liegen.' using errcode = 'P0906';
  end if;
  if jsonb_typeof(v_lines) is distinct from 'array' or jsonb_array_length(v_lines) not between 1 and 50 or exists (
    select 1 from jsonb_array_elements(v_lines) e
    where jsonb_typeof(e) <> 'object'
       or length(btrim(coalesce(e ->> 'label', ''))) not between 1 and 100
       or jsonb_typeof(e -> 'amount_cents') is distinct from 'number'
  ) then
    raise exception 'Ungültige Positionen.' using errcode = '22023';
  end if;

  -- Nummer je Kunde eindeutig (ohne Groß-/Kleinschreibung und Rand-Leerzeichen)
  select i.invoice_date into v_taken from public.invoices i
  where i.tenant_id = v_tenant and i.number_key = lower(v_number) and i.id is distinct from v_id;
  if found then
    raise exception 'Die Rechnungsnummer ist bereits vergeben.' using errcode = 'P0904', detail = to_char(v_taken, 'YYYY-MM-DD');
  end if;

  -- Buchung: nur Buchungen und Optionen desselben Kunden, keine Sperren
  if v_booking_id is not null and not exists (
    select 1 from public.bookings b where b.id = v_booking_id and b.tenant_id = v_tenant and b.kind <> 'block'
  ) then
    raise exception 'Buchung nicht wählbar.' using errcode = 'P0908';
  end if;

  -- Gast: bestehend (desselben Kunden; anonymisiert nur, wenn er schon verknüpft war) oder neu
  if v_new_guest is null and v_guest_id is not null then
    select * into v_guest from public.guests where id = v_guest_id and tenant_id = v_tenant;
    if v_guest.id is null then
      raise exception 'Gast nicht wählbar.' using errcode = 'P0909';
    end if;
    if v_guest.anonymized_at is not null and v_guest.id is distinct from v_old.guest_id then
      raise exception 'Der Gast ist anonymisiert.' using errcode = 'P0804';
    end if;
  end if;

  -- PDF: neu eingetragen → muss im Ordner des Kunden liegen und an keiner anderen Rechnung hängen
  if v_pdf is not null and v_pdf is distinct from v_old.pdf_path then
    if private.invoice_pdf_tenant(v_pdf) is distinct from v_tenant
        or not exists (select 1 from storage.objects o where o.bucket_id = 'invoices' and o.name = v_pdf)
        or exists (select 1 from public.invoices i where i.pdf_path = v_pdf) then
      raise exception 'Das PDF wurde nicht gefunden.' using errcode = 'P0907';
    end if;
  end if;

  -- Neuer Gast entsteht im selben Vorgang (Felder wie im Buchungsformular)
  if v_new_guest is not null then
    insert into public.guests (
      tenant_id, last_name, first_name, country, email, phone, language, birth_date, street, postal_code, city,
      address_country, marketing_source, marketing_custom, company_name, company_vat_id, company_address_line1, company_address_line2,
      company_postal_code, company_city, company_country, note,
      title_prefix, title_suffix, gender, document_type, document_number, document_issued_on, document_authority,
      document_country, document_front_path, document_back_path
    ) values (
      v_tenant, v_new_guest ->> 'last_name', v_new_guest ->> 'first_name', v_new_guest ->> 'country',
      v_new_guest ->> 'email', v_new_guest ->> 'phone', v_new_guest ->> 'language',
      (v_new_guest ->> 'birth_date')::date, v_new_guest ->> 'street', v_new_guest ->> 'postal_code',
      v_new_guest ->> 'city', v_new_guest ->> 'address_country', v_new_guest ->> 'marketing_source',
      v_new_guest ->> 'marketing_custom', v_new_guest ->> 'company_name', v_new_guest ->> 'company_vat_id',
      v_new_guest ->> 'company_address_line1', v_new_guest ->> 'company_address_line2',
      v_new_guest ->> 'company_postal_code', v_new_guest ->> 'company_city', v_new_guest ->> 'company_country',
      v_new_guest ->> 'note',
      v_new_guest ->> 'title_prefix', v_new_guest ->> 'title_suffix',
      coalesce(v_new_guest ->> 'gender', 'unspecified'), v_new_guest ->> 'document_type',
      v_new_guest ->> 'document_number', (v_new_guest ->> 'document_issued_on')::date,
      v_new_guest ->> 'document_authority', v_new_guest ->> 'document_country',
      v_new_guest ->> 'document_front_path', v_new_guest ->> 'document_back_path'
    ) returning id into v_guest_id;
  end if;

  -- Kleinunternehmer: Schalter „Ohne Umsatzsteuer (Kleinunternehmer)“ (PROJ-37-Änderung, PROJ-40);
  -- ohne Angabe wie bisher am Rechnungsdatum (PROJ-36)
  if jsonb_typeof(v_small_input) = 'boolean' then
    v_small := v_small_input::boolean;
  else
    select coalesce((
      select v.small_business from public.vat_status_changes v
      where v.tenant_id = v_tenant and v.valid_from <= v_date
      order by v.valid_from desc limit 1
    ), false) into v_small;
  end if;

  select sum((e ->> 'amount_cents')::bigint) into v_total from jsonb_array_elements(v_lines) e;

  begin
    if v_old.id is null then
      insert into public.invoices (tenant_id, number, invoice_date, booking_id, guest_id, recipient, small_business, total_cents, pdf_path)
      values (v_tenant, v_number, v_date, v_booking_id, v_guest_id, v_recipient, v_small, v_total, v_pdf)
      returning id into v_id;
    else
      update public.invoices set
        number = v_number,
        invoice_date = v_date,
        booking_id = v_booking_id,
        guest_id = v_guest_id,
        recipient = v_recipient,
        small_business = v_small,
        total_cents = v_total,
        pdf_path = v_pdf
      where id = v_id;
      delete from public.invoice_lines where invoice_id = v_id;
    end if;
  exception when unique_violation then
    -- gleichzeitig erfasst: Nummer oder PDF inzwischen vergeben
    if sqlerrm like '%invoices_pdf_path_key%' then
      raise exception 'Das PDF hängt bereits an einer anderen Rechnung.' using errcode = 'P0907';
    end if;
    raise exception 'Die Rechnungsnummer ist bereits vergeben.' using errcode = 'P0904';
  end;

  -- Beträge und Sätze prüft die Tabelle bzw. private.vat_rate (22023, 23514)
  insert into public.invoice_lines (tenant_id, invoice_id, position, label, amount_cents, vat_rate)
  select v_tenant, v_id, l.ord, btrim(l.value ->> 'label'), (l.value ->> 'amount_cents')::integer, private.vat_rate(l.value ->> 'vat_rate')
  from jsonb_array_elements(v_lines) with ordinality as l(value, ord);

  -- PROJ-40: Schlussrechnungs-Entwürfe, die diese Rechnung abziehen
  if v_old.id is not null then
    if v_old.booking_id is distinct from v_booking_id then
      perform private.detach_deductions(v_id);
    else
      perform private.refresh_deducting_totals(v_id);
    end if;
  end if;

  return jsonb_build_object(
    'id', v_id,
    'unused_pdf', case when v_old.pdf_path is distinct from v_pdf then v_old.pdf_path end,
    'previous_booking_id', case when v_old.booking_id is distinct from v_booking_id then v_old.booking_id end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Nacherfasste Rechnung löschen (nur Inhaber). Entwürfe über delete_invoice_draft; Schlussrechnungs-Entwürfe, die
-- die Rechnung abziehen, verlieren den Abzug. Ergebnis: Speicherort des PDFs oder null.
-- ---------------------------------------------------------------------------
create or replace function private.delete_invoice(p_invoice_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if v_invoice.id is null or v_invoice.origin <> 'backfilled' or not (private.is_member(v_invoice.tenant_id) or private.is_admin()) then
    raise exception 'Rechnung nicht gefunden.' using errcode = 'P0902';
  end if;
  if not private.has_role(v_invoice.tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0901';
  end if;
  perform private.detach_deductions(p_invoice_id);
  delete from public.invoices where id = p_invoice_id;
  return v_invoice.pdf_path;
end;
$$;

-- ---------------------------------------------------------------------------
-- Alle Rechnungsnummern eines Kunden (Entwürfe haben keine). Sonst unverändert gegenüber
-- 20261031135815_invoice_settings_qa_fixes.sql.
-- ---------------------------------------------------------------------------
create or replace function public.invoice_numbers(p_tenant_id uuid)
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(i.number order by i.number), '{}')
  from public.invoices i where i.tenant_id = p_tenant_id and i.number is not null;
$$;

-- ---------------------------------------------------------------------------
-- Buchung speichern: Zusatzkosten-Positionen behalten ihre Kennung (p_input.amounts.charges[].id). Bekannte
-- Kennungen dieser Buchung werden geändert, neue Positionen angelegt, fehlende gelöscht (Rechnungspositionen
-- verlieren dann die Verbindung). Sonst unverändert gegenüber 20261030131114_booking_extension_pricing.sql.
-- ---------------------------------------------------------------------------
create or replace function private.save_booking(p_input jsonb, p_confirm boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (p_input ->> 'tenant_id')::uuid;
  v_id uuid := nullif(p_input ->> 'id', '')::uuid;
  v_apartment_id uuid := nullif(p_input ->> 'apartment_id', '')::uuid;
  v_arrival date := (p_input ->> 'arrival')::date;
  -- PROJ-30: departure = tatsächliche Abreise (Belegung), planned_departure = vereinbarte (Preis)
  v_departure date := (p_input ->> 'departure')::date;
  v_planned date := (p_input ->> 'planned_departure')::date;
  v_sheet text := nullif(btrim(p_input ->> 'guest_sheet_number'), '');
  v_source text := coalesce(p_input ->> 'source', 'none');
  v_source_custom text := case when coalesce(p_input ->> 'source', 'none') = 'custom' then nullif(btrim(p_input ->> 'source_custom'), '') end;
  v_residence boolean := coalesce((p_input ->> 'residence_registered')::boolean, false);
  v_adults integer := (p_input ->> 'adults')::integer;
  v_child_ages integer[] := coalesce(
    array(select jsonb_array_elements_text(coalesce(p_input -> 'child_ages', '[]'::jsonb))::integer), '{}');
  v_guest_id uuid := nullif(p_input ->> 'guest_id', '')::uuid;
  v_new_guest jsonb := case when jsonb_typeof(p_input -> 'new_guest') = 'object' then p_input -> 'new_guest' end;
  -- Preisregel bei Verlängerung (PROJ-30, 2026-10-30): nur vom Inhaber; fehlt sie, gilt beim Anlegen „total“,
  -- beim Ändern bleibt die gespeicherte (ungültige Werte → 22023)
  v_pricing text := private.extension_pricing(p_input -> 'amounts' ->> 'nights_extension_pricing');
  v_amounts jsonb := p_input -> 'amounts';
  v_charges jsonb;
  v_owner boolean;
  v_old public.bookings;
  v_apartment public.apartments;
  v_guest public.guests;
  v_kind text;
  v_option_until date;
  v_warnings jsonb;
  v_override boolean;
  v_seq integer;
  v_companions integer;
  v_changed boolean;
  v_suggested integer;
  v_duplicates jsonb;
begin
  if v_tenant is null or not private.is_member(v_tenant) then
    raise exception 'Keine Berechtigung.' using errcode = 'P0801';
  end if;
  v_owner := private.has_role(v_tenant, 'owner');

  if v_id is not null then
    -- Sperr-Reihenfolge wie confirm_option: erst bisherige und neue Wohnung, dann die Buchung
    perform private.lock_apartments(array[
      (select b.apartment_id from public.bookings b where b.id = v_id and b.tenant_id = v_tenant),
      v_apartment_id
    ]);
    select * into v_old from public.bookings where id = v_id and tenant_id = v_tenant for update;
    if v_old.id is null or v_old.kind = 'block' then
      raise exception 'Buchung nicht gefunden.' using errcode = 'P0802';
    end if;
    if v_old.cancelled_at is not null or (v_old.kind = 'option' and v_old.option_until < private.today_vienna()) then
      raise exception 'Die Buchung ist nicht mehr aktiv.' using errcode = 'P0805';
    end if;
    if v_old.updated_at is distinct from (p_input ->> 'updated_at')::timestamptz then
      raise exception 'Die Buchung wurde inzwischen geändert.' using errcode = 'P0803';
    end if;
    v_kind := v_old.kind;
  else
    v_kind := p_input ->> 'kind';
    if v_kind is null or v_kind not in ('booking', 'option') then
      raise exception 'Ungültige Art.' using errcode = 'P0807';
    end if;
    perform private.lock_apartment(v_apartment_id);
  end if;
  v_option_until := case when v_kind = 'option' then (p_input ->> 'option_until')::date end;
  if v_kind = 'option' and (v_option_until is null or v_option_until > private.booking_max_date()
      or (v_option_until < private.today_vienna()
        and (v_old.id is null or v_option_until is distinct from v_old.option_until))) then
    raise exception 'Ungültiges Ablaufdatum.' using errcode = 'P0807';
  end if;

  select * into v_apartment from public.apartments where id = v_apartment_id and tenant_id = v_tenant;
  if v_apartment.id is null then
    raise exception 'Wohnung nicht gefunden.' using errcode = 'P0802';
  end if;
  if v_apartment.archived_at is not null and v_apartment.id is distinct from v_old.apartment_id then
    raise exception 'Die Wohnung ist archiviert.' using errcode = 'P0806';
  end if;

  -- Gast: bestehend (nicht anonymisiert, außer er bleibt unverändert) oder neu
  if v_new_guest is null then
    select * into v_guest from public.guests where id = v_guest_id and tenant_id = v_tenant;
    if v_guest.id is null then
      raise exception 'Gast nicht gefunden.' using errcode = 'P0802';
    end if;
    if v_guest.anonymized_at is not null and v_guest.id is distinct from v_old.guest_id then
      raise exception 'Der Gast ist anonymisiert.' using errcode = 'P0804';
    end if;
  end if;

  if v_adults is null or v_departure is null or v_planned is null or v_arrival is null or v_arrival > private.booking_max_date() then
    raise exception 'Ungültige Eingabe.' using errcode = 'P0807';
  end if;

  -- Personenzahl nicht unter Hauptgast + bereits erfasste Mitreisende
  if v_old.id is not null then
    select count(*) into v_companions from public.booking_companions where booking_id = v_id;
    if v_companions > v_adults + cardinality(v_child_ages) - 1 then
      raise exception 'Zuerst Mitreisende entfernen.' using errcode = 'P0808';
    end if;
  end if;

  -- Warnungen: Inhaber dürfen bewusst übersteuern, sonst wird nichts gespeichert
  v_warnings := private.booking_warnings_for(v_tenant, v_apartment.id, v_arrival, v_departure,
    v_adults + cardinality(v_child_ages), v_adults, v_id);
  v_override := private.has_warnings(v_warnings);
  -- PROJ-30: doppelte Gästeblattnummer ist eine eigene Warnung, die alle Mitglieder bestätigen dürfen
  v_duplicates := private.guest_sheet_duplicates(v_tenant, v_sheet, v_id);
  if (v_override and not (v_owner and coalesce(p_confirm, false)))
      or (jsonb_array_length(v_duplicates) > 0 and not coalesce((p_input ->> 'confirm_guest_sheet_number')::boolean, false)) then
    return jsonb_build_object('status', 'warnings', 'warnings', v_warnings || jsonb_build_object('guest_sheet_duplicates', v_duplicates));
  end if;

  -- Neuer Gast entsteht im selben Vorgang (auch für Mitarbeiter, Entscheidung PROJ-7)
  if v_new_guest is not null then
    insert into public.guests (
      tenant_id, last_name, first_name, country, email, phone, language, birth_date, street, postal_code, city,
      address_country, marketing_source, marketing_custom, company_name, company_vat_id, company_address_line1, company_address_line2,
      company_postal_code, company_city, company_country, note,
      title_prefix, title_suffix, gender, document_type, document_number, document_issued_on, document_authority,
      document_country, document_front_path, document_back_path
    ) values (
      v_tenant, v_new_guest ->> 'last_name', v_new_guest ->> 'first_name', v_new_guest ->> 'country',
      v_new_guest ->> 'email', v_new_guest ->> 'phone', v_new_guest ->> 'language',
      (v_new_guest ->> 'birth_date')::date, v_new_guest ->> 'street', v_new_guest ->> 'postal_code',
      v_new_guest ->> 'city', v_new_guest ->> 'address_country', v_new_guest ->> 'marketing_source',
      v_new_guest ->> 'marketing_custom', v_new_guest ->> 'company_name', v_new_guest ->> 'company_vat_id',
      v_new_guest ->> 'company_address_line1', v_new_guest ->> 'company_address_line2',
      v_new_guest ->> 'company_postal_code', v_new_guest ->> 'company_city', v_new_guest ->> 'company_country',
      v_new_guest ->> 'note',
      -- PROJ-29: Titel, Geschlecht und Reisedokument (Prüfregeln und Bild-Prüfung übernimmt die Tabelle)
      v_new_guest ->> 'title_prefix', v_new_guest ->> 'title_suffix',
      coalesce(v_new_guest ->> 'gender', 'unspecified'), v_new_guest ->> 'document_type',
      v_new_guest ->> 'document_number', (v_new_guest ->> 'document_issued_on')::date,
      v_new_guest ->> 'document_authority', v_new_guest ->> 'document_country',
      v_new_guest ->> 'document_front_path', v_new_guest ->> 'document_back_path'
    ) returning id into v_guest_id;
  end if;

  if v_old.id is null then
    insert into public.booking_numbers as n (tenant_id, year, last_seq)
    values (v_tenant, extract(year from v_arrival)::integer, 1)
    on conflict (tenant_id, year) do update set last_seq = n.last_seq + 1
    returning last_seq into v_seq;

    insert into public.bookings (
      tenant_id, apartment_id, kind, number_year, number_seq, arrival, planned_departure, departure, check_in, check_out, guest_id,
      adults, child_ages, option_until, guest_sheet_number, residence_registered, source, source_custom,
      note, override_at, override_by, price_review
    ) values (
      v_tenant, v_apartment.id, v_kind, extract(year from v_arrival)::integer, v_seq, v_arrival, v_planned, v_departure,
      -- ohne Angabe die Zeiten der Wohnung
      coalesce((p_input ->> 'check_in')::time, v_apartment.check_in),
      coalesce((p_input ->> 'check_out')::time, v_apartment.check_out),
      v_guest_id, v_adults, v_child_ages, v_option_until, v_sheet, v_residence, v_source, v_source_custom,
      nullif(btrim(p_input ->> 'note'), ''),
      case when v_override then now() end, case when v_override then auth.uid() end,
      -- Mitarbeiter-Buchung ohne Preis der Wohnung: Inhaber soll den Preis setzen
      not v_owner and private.suggested_nights_cents(v_apartment, v_adults, v_child_ages, v_planned - v_arrival) is null
    ) returning id into v_id;

    if v_owner then
      -- Umsatzsteuersätze Pflicht, als exakte Dezimalzahl geprüft (PROJ-35)
      insert into public.booking_amounts (id, tenant_id, nights_cents, nights_vat_rate, nights_extension_pricing)
      values (v_id, v_tenant, (v_amounts ->> 'nights_cents')::integer, private.vat_rate(v_amounts ->> 'nights_vat_rate'),
        coalesce(v_pricing, 'total'));
      insert into public.booking_charges (tenant_id, booking_id, position, label, amount_cents, vat_rate)
      select v_tenant, v_id, c.ord, btrim(c.value ->> 'label'), (c.value ->> 'amount_cents')::integer, private.vat_rate(c.value ->> 'vat_rate')
      from jsonb_array_elements(coalesce(v_amounts -> 'charges', '[]'::jsonb)) with ordinality as c(value, ord);
    else
      -- Preisvorschlag für Mitarbeiter je nach Preisart der Wohnung (PROJ-27) und Reinigungsgebühr
      -- Vorschlag für den geplanten Zeitraum (PROJ-30)
      v_suggested := private.suggested_nights_cents(v_apartment, v_adults, v_child_ages, v_planned - v_arrival);
      insert into public.booking_amounts (id, tenant_id, nights_cents)
      values (v_id, v_tenant, coalesce(v_suggested, 0));
      if v_apartment.cleaning_fee_cents is not null then
        -- Satz der Reinigung 10 % (PROJ-35); die Übernachtung erhält den Standard 10 %
        insert into public.booking_charges (tenant_id, booking_id, position, label, amount_cents, vat_rate)
        values (v_tenant, v_id, 1, 'Reinigung', v_apartment.cleaning_fee_cents, 10.00);
      end if;
    end if;
  else
    -- „Preis prüfen“: Anreise, geplante Abreise oder Wohnung geändert, bei Personenpreisen auch Erwachsene oder
    -- Kinderalter (PROJ-27). Die tatsächliche Abreise allein nicht: der Preis folgt der gespeicherten Preisregel (PROJ-30)
    v_changed := v_old.arrival <> v_arrival or v_old.planned_departure <> v_planned or v_old.apartment_id <> v_apartment.id
      or (v_apartment.price_mode = 'person'
        and (v_old.adults is distinct from v_adults or v_old.child_ages is distinct from v_child_ages));
    update public.bookings set
      apartment_id = v_apartment.id,
      arrival = v_arrival,
      planned_departure = v_planned,
      departure = v_departure,
      -- Zeiten sind optional: null = keine Zeit (BUG-2)
      check_in = (p_input ->> 'check_in')::time,
      check_out = (p_input ->> 'check_out')::time,
      guest_id = v_guest_id,
      adults = v_adults,
      child_ages = v_child_ages,
      option_until = v_option_until,
      guest_sheet_number = v_sheet,
      residence_registered = v_residence,
      source = v_source,
      source_custom = v_source_custom,
      note = nullif(btrim(p_input ->> 'note'), ''),
      override_at = case when v_override then now() end,
      override_by = case when v_override then auth.uid() end,
      price_review = case when v_owner then false when v_changed then true else price_review end
    where id = v_id;

    -- Beträge setzen nur Inhaber; Änderungen von Mitarbeitern lassen den Preis unverändert
    if v_owner then
      insert into public.booking_amounts as a (id, tenant_id, nights_cents, nights_vat_rate, nights_extension_pricing)
      values (v_id, v_tenant, (v_amounts ->> 'nights_cents')::integer, private.vat_rate(v_amounts ->> 'nights_vat_rate'),
        coalesce(v_pricing, 'total'))
      on conflict (id) do update set
        nights_cents = excluded.nights_cents,
        nights_vat_rate = excluded.nights_vat_rate,
        nights_extension_pricing = coalesce(v_pricing, a.nights_extension_pricing);

      -- PROJ-40: Zusatzkosten abgleichen. Gültig ist eine Kennung nur, wenn sie zu dieser Buchung gehört und zum
      -- ersten Mal vorkommt; alle anderen Positionen entstehen neu.
      select coalesce(jsonb_agg(jsonb_build_object(
        'ord', x.ord,
        'value', x.value,
        'id', case when x.rn = 1 and exists (
          select 1 from public.booking_charges bc where bc.id = x.cid and bc.booking_id = v_id
        ) then x.cid end
      ) order by x.ord), '[]'::jsonb)
      into v_charges
      from (
        select c.ord, c.value, private.json_uuid(c.value ->> 'id') as cid,
          row_number() over (partition by private.json_uuid(c.value ->> 'id') order by c.ord) as rn
        from jsonb_array_elements(coalesce(v_amounts -> 'charges', '[]'::jsonb)) with ordinality as c(value, ord)
      ) x;

      delete from public.booking_charges bc
      where bc.booking_id = v_id
        and not exists (select 1 from jsonb_array_elements(v_charges) e where private.json_uuid(e ->> 'id') = bc.id);

      update public.booking_charges bc set
        position = (e ->> 'ord')::integer,
        label = btrim(e -> 'value' ->> 'label'),
        amount_cents = (e -> 'value' ->> 'amount_cents')::integer,
        vat_rate = private.vat_rate(e -> 'value' ->> 'vat_rate')
      from jsonb_array_elements(v_charges) e
      where bc.booking_id = v_id and bc.id = private.json_uuid(e ->> 'id')
        and (bc.position, bc.label, bc.amount_cents, bc.vat_rate) is distinct from (
          (e ->> 'ord')::integer, btrim(e -> 'value' ->> 'label'), (e -> 'value' ->> 'amount_cents')::integer,
          private.vat_rate(e -> 'value' ->> 'vat_rate')
        );

      insert into public.booking_charges (tenant_id, booking_id, position, label, amount_cents, vat_rate)
      select v_tenant, v_id, (e ->> 'ord')::integer, btrim(e -> 'value' ->> 'label'), (e -> 'value' ->> 'amount_cents')::integer,
        private.vat_rate(e -> 'value' ->> 'vat_rate')
      from jsonb_array_elements(v_charges) e
      where private.json_uuid(e ->> 'id') is null;
    end if;
  end if;

  -- Abgerechneter Übernachtungspreis nach jedem Speichern, für Inhaber und Mitarbeiter (PROJ-30)
  perform private.refresh_billed_nights(v_id);

  return jsonb_build_object('status', 'saved', 'id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------
revoke execute on function private.json_uuid(text) from public, anon;
grant execute on function private.json_uuid(text) to authenticated, service_role;

-- nur intern
revoke execute on function private.booking_billable_cents(uuid) from public, anon, authenticated;
revoke execute on function private.invoice_total_cents(uuid) from public, anon, authenticated;
revoke execute on function private.refresh_deducting_totals(uuid) from public, anon, authenticated;
revoke execute on function private.detach_deductions(uuid) from public, anon, authenticated;

revoke execute on function private.save_invoice_draft(jsonb) from public, anon;
revoke execute on function public.save_invoice_draft(jsonb) from public, anon;
revoke execute on function private.delete_invoice_draft(uuid) from public, anon;
revoke execute on function public.delete_invoice_draft(uuid) from public, anon;
revoke execute on function private.invoice_preview_data(uuid) from public, anon;
revoke execute on function public.invoice_preview_data(uuid) from public, anon;
grant execute on function private.save_invoice_draft(jsonb) to authenticated;
grant execute on function public.save_invoice_draft(jsonb) to authenticated;
grant execute on function private.delete_invoice_draft(uuid) to authenticated;
grant execute on function public.delete_invoice_draft(uuid) to authenticated;
grant execute on function private.invoice_preview_data(uuid) to authenticated;
grant execute on function public.invoice_preview_data(uuid) to authenticated;
