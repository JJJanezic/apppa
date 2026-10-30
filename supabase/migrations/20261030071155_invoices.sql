-- PROJ-37: Rechnungen nacherfassen
--
-- * Kunde: Schalter invoice_backfill_enabled („Rechnungen nacherfassen“, Standard ein), gespeichert über
--   update_tenant_master_data (Inhaber und Admin)
-- * Tabellen invoices und invoice_lines: Lesen für Mitglieder und Admin, Schreiben nur über die Funktionen
-- * Speicherbereich invoices (privat, nur PDF, 10 MB): Inhaber laden in den Ordner ihres Kunden, lesen dürfen
--   Mitglieder und Admin nur PDFs, die an einer Rechnung des Kunden hängen; löschen nur der Server
-- * save_invoice (Anlegen/Ändern mit Positionen, Konfliktschutz), delete_invoice, search_invoice_bookings,
--   booking_invoices (für alle Mitglieder inkl. Gesamtpreis), unused_invoice_pdfs (tägliche Bereinigung)
-- * delete_guest anonymisiert auch bei Rechnungen; merge_guests hängt Rechnungen um
--
-- Fehlercodes: P0901 nur Inhaber, P0902 nicht gefunden, P0903 inzwischen geändert, P0904 Nummer vergeben (detail:
-- Datum der vorhandenen Rechnung), P0905 Nacherfassen ausgeschaltet, P0906 Datum in der Zukunft, P0907 PDF fehlt
-- oder hängt an einer anderen Rechnung, P0908 Buchung ungültig, P0909 Gast ungültig, P0804 Gast anonymisiert,
-- 22023 ungültige Eingabe

-- ---------------------------------------------------------------------------
-- Kunde: Schalter
-- ---------------------------------------------------------------------------
alter table public.tenants add column invoice_backfill_enabled boolean not null default true;
comment on column public.tenants.invoice_backfill_enabled is
  'Knopf „Rechnung nacherfassen“ anzeigen (PROJ-37). Wirkt nur auf das Anlegen; Ändern und Löschen bleiben möglich.';

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  number text not null check (number = btrim(number) and length(number) between 1 and 30),
  -- Vergleichsschlüssel: Kleinschreibung (die Nummer ist schon ohne Rand-Leerzeichen)
  number_key text generated always as (lower(number)) stored,
  invoice_date date not null check (invoice_date >= '1990-01-01'),
  origin text not null default 'backfilled' check (origin in ('backfilled')),
  booking_id uuid,
  guest_id uuid,
  recipient text not null check (recipient = btrim(recipient) and length(recipient) between 1 and 200),
  small_business boolean not null default false,
  total_cents bigint not null default 0,
  pdf_path text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint invoices_id_tenant_key unique (id, tenant_id),
  constraint invoices_number_key unique (tenant_id, number_key),
  constraint invoices_pdf_path_key unique (pdf_path),
  -- Buchung bzw. Gast desselben Kunden; wird er entfernt, bleibt die Rechnung ohne Verknüpfung
  constraint invoices_booking_fkey foreign key (booking_id, tenant_id)
    references public.bookings (id, tenant_id) on delete set null (booking_id),
  constraint invoices_guest_fkey foreign key (guest_id, tenant_id)
    references public.guests (id, tenant_id) on delete set null (guest_id)
);
comment on table public.invoices is
  'Rechnungen je Kunde (PROJ-37: nacherfasst; PROJ-38: ausgestellt). Schreiben nur über save_invoice/delete_invoice.';
comment on column public.invoices.small_business is 'Kleinunternehmer am Rechnungsdatum (PROJ-36), beim Speichern festgehalten.';
comment on column public.invoices.total_cents is 'Gesamtbetrag brutto aus den Positionen, von save_invoice gebildet.';
comment on column public.invoices.pdf_path is 'Speicherort im Bereich „invoices“: <Kunde>/<zufällig>.pdf';

create index invoices_list_idx on public.invoices (tenant_id, invoice_date desc, number desc);
create index invoices_booking_idx on public.invoices (booking_id, tenant_id) where booking_id is not null;
create index invoices_guest_idx on public.invoices (guest_id, tenant_id) where guest_id is not null;

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  invoice_id uuid not null,
  position integer not null check (position between 1 and 50),
  label text not null check (label = btrim(label) and length(label) between 1 and 100),
  amount_cents integer not null check (amount_cents between -100000000 and 100000000),
  vat_rate numeric(5, 2) not null default 20.00 check (vat_rate between 0 and 100),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint invoice_lines_invoice_fkey foreign key (invoice_id, tenant_id)
    references public.invoices (id, tenant_id) on delete cascade,
  constraint invoice_lines_position_key unique (invoice_id, position)
);
comment on table public.invoice_lines is 'Positionen einer Rechnung (PROJ-37), Kopie zum Zeitpunkt der Erfassung; Beträge brutto.';
create index invoice_lines_tenant_idx on public.invoice_lines (tenant_id);

revoke all on public.invoices from anon, authenticated;
revoke all on public.invoice_lines from anon, authenticated;
grant select on public.invoices to authenticated;
grant select on public.invoice_lines to authenticated;

alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;

create policy "Mitglieder und Admin lesen Rechnungen" on public.invoices for select to authenticated
  using (private.is_member(tenant_id) or (select private.is_admin()));
create policy "Mitglieder und Admin lesen Rechnungspositionen" on public.invoice_lines for select to authenticated
  using (private.is_member(tenant_id) or (select private.is_admin()));
-- kein insert/update/delete: nur über save_invoice und delete_invoice

select private.enable_tenant_table('public.invoices');
select private.enable_tenant_table('public.invoice_lines');

-- ---------------------------------------------------------------------------
-- Speicherbereich für Rechnungs-PDFs
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

-- Kunde eines Speicherorts <Kunde>/<zufällig>.pdf (null bei jedem anderen Format)
create function private.invoice_pdf_tenant(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
    then split_part(p_name, '/', 1)::uuid end;
$$;

-- Darf die angemeldete Person das PDF lesen? Mitglied des Kunden (oder Admin mit 2FA) und das PDF hängt an einer
-- Rechnung dieses Kunden
create function private.can_read_invoice_pdf(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.invoice_pdf_tenant(p_name) is not null
    and (private.is_member(private.invoice_pdf_tenant(p_name)) or private.is_admin())
    and exists (
      select 1 from public.invoices i
      where i.tenant_id = private.invoice_pdf_tenant(p_name) and i.pdf_path = p_name
    );
$$;

create policy "Inhaber laden Rechnungs-PDFs in den eigenen Ordner"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'invoices'
    and private.invoice_pdf_tenant(name) is not null
    and private.has_role(private.invoice_pdf_tenant(name), 'owner')
  );
create policy "Mitglieder und Admin lesen verwendete Rechnungs-PDFs"
  on storage.objects for select to authenticated
  using (bucket_id = 'invoices' and private.can_read_invoice_pdf(name));
-- Kein Ändern oder Löschen durch Nutzer (nur der Server mit geheimem Schlüssel)

-- ---------------------------------------------------------------------------
-- Rechnung speichern (Anlegen und Ändern, Positionen im selben Schritt)
-- p_input: id, updated_at, tenant_id, number, invoice_date, booking_id, guest_id, new_guest (Gast-Felder wie
-- public.guests), recipient, lines [{label, amount_cents, vat_rate}], pdf_path
-- Ergebnis: {id, unused_pdf, previous_booking_id}
-- ---------------------------------------------------------------------------
create function private.save_invoice(p_input jsonb)
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
    if v_old.id is null then
      raise exception 'Rechnung nicht gefunden.' using errcode = 'P0902';
    end if;
    if v_old.updated_at is distinct from (p_input ->> 'updated_at')::timestamptz then
      raise exception 'Die Rechnung wurde inzwischen geändert.' using errcode = 'P0903';
    end if;
  else
    -- Der Schalter gilt nur fürs Anlegen
    if not (select t.invoice_backfill_enabled from public.tenants t where t.id = v_tenant) then
      raise exception 'Das Nacherfassen ist ausgeschaltet.' using errcode = 'P0905';
    end if;
  end if;

  -- Pflichtangaben und Grenzen
  if length(v_number) not between 1 and 30 or length(v_recipient) not between 1 and 200 or v_date is null then
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

  -- Kleinunternehmer am Rechnungsdatum (PROJ-36), an der Rechnung festgehalten
  select coalesce((
    select v.small_business from public.vat_status_changes v
    where v.tenant_id = v_tenant and v.valid_from <= v_date
    order by v.valid_from desc limit 1
  ), false) into v_small;

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

  return jsonb_build_object(
    'id', v_id,
    'unused_pdf', case when v_old.pdf_path is distinct from v_pdf then v_old.pdf_path end,
    'previous_booking_id', case when v_old.booking_id is distinct from v_booking_id then v_old.booking_id end
  );
end;
$$;

create function public.save_invoice(p_input jsonb)
returns jsonb
language sql security invoker set search_path = ''
as $$ select private.save_invoice(p_input); $$;

-- ---------------------------------------------------------------------------
-- Rechnung löschen (nur Inhaber; auch bei ausgeschaltetem Schalter). Ergebnis: Speicherort des PDFs oder null.
-- ---------------------------------------------------------------------------
create function private.delete_invoice(p_invoice_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if v_invoice.id is null or not (private.is_member(v_invoice.tenant_id) or private.is_admin()) then
    raise exception 'Rechnung nicht gefunden.' using errcode = 'P0902';
  end if;
  if not private.has_role(v_invoice.tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0901';
  end if;
  delete from public.invoices where id = p_invoice_id;
  return v_invoice.pdf_path;
end;
$$;

create function public.delete_invoice(p_invoice_id uuid)
returns text
language sql security invoker set search_path = ''
as $$ select private.delete_invoice(p_invoice_id); $$;

-- ---------------------------------------------------------------------------
-- Buchungssuche im Formular (nur Inhaber): Wörter in Gastname/Firma, Wohnung, Objekt oder Buchungsnummer;
-- „14.10.2026“ findet Buchungen über diesen Tag, „10.2026“ Buchungen in diesem Monat.
-- Buchungen und Optionen inkl. stornierter, keine Sperren; neueste zuerst, höchstens 20.
-- ---------------------------------------------------------------------------
create function private.search_invoice_bookings(p_tenant_id uuid, p_query text, p_limit integer default 20)
returns table (
  id uuid,
  kind text,
  number text,
  guest_last_name text,
  guest_first_name text,
  apartment_name text,
  property_name text,
  arrival date,
  departure date,
  cancelled boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_word text;
  v_texts text[] := '{}';
  v_froms date[] := '{}';
  v_tos date[] := '{}';
  v_day date;
  m text[];
begin
  if p_tenant_id is null or not private.has_role(p_tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0901';
  end if;

  foreach v_word in array regexp_split_to_array(btrim(coalesce(left(p_query, 100), '')), '\s+') loop
    continue when v_word = '';
    v_day := null;
    m := regexp_match(v_word, '^(\d{1,2})\.(\d{1,2})\.(\d{4})$');
    if m is not null then
      begin
        v_day := make_date(m[3]::integer, m[2]::integer, m[1]::integer);
      exception when others then
        v_day := null;
      end;
      if v_day is not null then
        v_texts := v_texts || null::text;
        v_froms := v_froms || v_day;
        v_tos := v_tos || (v_day + 1);
        continue;
      end if;
    end if;
    m := regexp_match(v_word, '^(\d{1,2})\.(\d{4})$');
    if m is not null and m[1]::integer between 1 and 12 then
      v_day := make_date(m[2]::integer, m[1]::integer, 1);
      v_texts := v_texts || null::text;
      v_froms := v_froms || v_day;
      v_tos := v_tos || (v_day + interval '1 month')::date;
      continue;
    end if;
    v_texts := v_texts || private.guest_norm(v_word);
    v_froms := v_froms || null::date;
    v_tos := v_tos || null::date;
  end loop;

  if cardinality(v_texts) = 0 then
    return;
  end if;

  return query
  select b.id, b.kind, b.number, g.last_name, g.first_name, a.name, p.name, b.arrival, b.departure, b.cancelled_at is not null
  from public.bookings b
  join public.apartments a on a.id = b.apartment_id
  join public.properties p on p.id = a.property_id
  left join public.guests g on g.id = b.guest_id
  where b.tenant_id = p_tenant_id
    and b.kind <> 'block'
    and not exists (
      select 1
      from unnest(v_texts, v_froms, v_tos) as w(t, f, u)
      where not case
        when w.f is not null then b.arrival < w.u and b.departure >= w.f
        else private.guest_norm(concat_ws(' ', g.last_name, g.first_name, g.company_name, a.name, p.name, b.number))
          like '%' || w.t || '%'
      end
    )
  order by b.arrival desc, b.number desc
  limit least(greatest(coalesce(p_limit, 20), 1), 20);
end;
$$;

create function public.search_invoice_bookings(p_tenant_id uuid, p_query text, p_limit integer default 20)
returns table (
  id uuid,
  kind text,
  number text,
  guest_last_name text,
  guest_first_name text,
  apartment_name text,
  property_name text,
  arrival date,
  departure date,
  cancelled boolean
)
language sql security invoker set search_path = ''
as $$ select * from private.search_invoice_bookings(p_tenant_id, p_query, p_limit); $$;

-- ---------------------------------------------------------------------------
-- Rechnungen einer Buchung mit Gesamtpreis (für alle Mitglieder, auch Mitarbeiter; Nutzerentscheidung PROJ-37).
-- Gesamtpreis: aktiv = abgerechnete Übernachtung + Zusatzkosten; storniert = Stornogebühr (sonst 0).
-- Fremde oder unbekannte Buchung: keine Rechnungen, kein Gesamtpreis.
-- ---------------------------------------------------------------------------
create function private.booking_invoices(p_booking_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with b as (
    select b.id, b.tenant_id, b.cancelled_at
    from public.bookings b
    where b.id = p_booking_id and b.kind <> 'block'
      and (private.is_member(b.tenant_id) or private.is_admin())
  )
  select jsonb_build_object(
    'booking_total_cents', (
      select case
        when b.cancelled_at is not null then coalesce(am.cancellation_fee_cents, 0)
        else coalesce(am.billed_nights_cents, am.nights_cents, 0)
          + coalesce((select sum(c.amount_cents) from public.booking_charges c where c.booking_id = b.id), 0)
      end
      from b left join public.booking_amounts am on am.id = b.id
    ),
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'number', i.number, 'invoice_date', i.invoice_date, 'recipient', i.recipient,
        'total_cents', i.total_cents, 'origin', i.origin, 'has_pdf', i.pdf_path is not null
      ) order by i.invoice_date, i.number)
      from public.invoices i join b on i.booking_id = b.id and i.tenant_id = b.tenant_id
    ), '[]'::jsonb)
  );
$$;

create function public.booking_invoices(p_booking_id uuid)
returns jsonb
language sql security invoker set search_path = ''
as $$ select private.booking_invoices(p_booking_id); $$;

-- ---------------------------------------------------------------------------
-- Tägliche Bereinigung: PDFs, die älter als 24 Stunden sind und an keiner Rechnung hängen
-- (Upload ohne Speichern, abgebrochenes Löschen, Reste gelöschter Kunden). Nur für den Server.
-- ---------------------------------------------------------------------------
create function public.unused_invoice_pdfs(p_limit integer default 1000)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'invoices'
    and o.created_at < now() - interval '24 hours'
    and not exists (select 1 from public.invoices i where i.pdf_path = o.name)
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

-- ---------------------------------------------------------------------------
-- Gast löschen: mit Buchungen oder Rechnungen anonymisieren (Aufbewahrung), sonst endgültig löschen
-- ---------------------------------------------------------------------------
create or replace function private.delete_guest(p_guest_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest public.guests;
begin
  select * into v_guest from public.guests where id = p_guest_id for update;
  if v_guest.id is null then
    raise exception 'Gast nicht gefunden.' using errcode = 'P0702';
  end if;
  if not private.has_role(v_guest.tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0701';
  end if;
  if v_guest.anonymized_at is not null then
    raise exception 'Der Gast ist bereits anonymisiert.' using errcode = 'P0703';
  end if;

  -- Mit Buchungen (auch stornierten) oder Rechnungen (PROJ-37, 7 Jahre Aufbewahrung) anonymisieren
  if exists (select 1 from public.bookings where guest_id = p_guest_id)
      or exists (select 1 from public.invoices where guest_id = p_guest_id) then
    perform private.anonymize_guest(p_guest_id);
    return 'anonymized';
  end if;

  delete from public.guests where id = p_guest_id;
  -- Es bleibt nur der Vermerk „gelöscht“ mit Person und Zeitpunkt
  perform private.purge_audit_personal_data('guests', p_guest_id);
  return 'deleted';
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------
revoke execute on function private.invoice_pdf_tenant(text) from public, anon;
revoke execute on function private.can_read_invoice_pdf(text) from public, anon;
revoke execute on function private.save_invoice(jsonb) from public, anon;
revoke execute on function public.save_invoice(jsonb) from public, anon;
revoke execute on function private.delete_invoice(uuid) from public, anon;
revoke execute on function public.delete_invoice(uuid) from public, anon;
revoke execute on function private.search_invoice_bookings(uuid, text, integer) from public, anon;
revoke execute on function public.search_invoice_bookings(uuid, text, integer) from public, anon;
revoke execute on function private.booking_invoices(uuid) from public, anon;
revoke execute on function public.booking_invoices(uuid) from public, anon;
revoke execute on function public.unused_invoice_pdfs(integer) from public, anon, authenticated;

grant execute on function private.invoice_pdf_tenant(text) to authenticated, service_role;
grant execute on function private.can_read_invoice_pdf(text) to authenticated, service_role;
grant execute on function private.save_invoice(jsonb) to authenticated;
grant execute on function public.save_invoice(jsonb) to authenticated;
grant execute on function private.delete_invoice(uuid) to authenticated;
grant execute on function public.delete_invoice(uuid) to authenticated;
grant execute on function private.search_invoice_bookings(uuid, text, integer) to authenticated;
grant execute on function public.search_invoice_bookings(uuid, text, integer) to authenticated;
grant execute on function private.booking_invoices(uuid) to authenticated;
grant execute on function public.booking_invoices(uuid) to authenticated;
grant execute on function public.unused_invoice_pdfs(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Kundenstammdaten speichern: zusätzlich Schalter „Rechnungen nacherfassen“ (Protokoll-Feld
-- invoice_backfill_enabled). Sonst unverändert gegenüber 20261029172914_vat_status_changes.sql.
-- ---------------------------------------------------------------------------
create or replace function private.update_tenant_master_data(p_tenant_id uuid, p_expected_updated_at timestamptz, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.tenants;
  v_new public.tenants;
  v_changed text[] := '{}';
  v_column text;
  v_vat jsonb := p_data -> 'vat_status';
  v_vat_old jsonb;
  v_vat_new jsonb;
  v_backfill jsonb := p_data -> 'invoice_backfill_enabled';
begin
  -- Inhaber dieses (aktiven) Kunden oder Admin mit 2FA; Mitarbeiter und fremde Inhaber nicht
  if not (private.is_admin() or private.has_role(p_tenant_id, 'owner')) then
    raise exception 'Keine Berechtigung für diese Kundendaten.' using errcode = '42501';
  end if;
  v_old := private.lock_tenant(p_tenant_id, true);
  if v_old.updated_at is distinct from p_expected_updated_at then
    raise exception 'Die Kundendaten wurden inzwischen geändert.' using errcode = 'P0017';
  end if;

  -- Bereinigen wie im Formular: Leerzeichen am Rand weg, leer = nicht angegeben, UID ohne Leerzeichen in Großbuchstaben
  v_new := v_old;
  v_new.name := btrim(coalesce(p_data ->> 'name', ''));
  v_new.name_line2 := nullif(btrim(p_data ->> 'name_line2'), '');
  v_new.address_line1 := nullif(btrim(p_data ->> 'address_line1'), '');
  v_new.address_line2 := nullif(btrim(p_data ->> 'address_line2'), '');
  v_new.postal_code := nullif(btrim(p_data ->> 'postal_code'), '');
  v_new.city := nullif(btrim(p_data ->> 'city'), '');
  v_new.country := nullif(upper(btrim(p_data ->> 'country')), '');
  v_new.vat_id := nullif(upper(regexp_replace(coalesce(p_data ->> 'vat_id', ''), '\s', '', 'g')), '');
  v_new.tax_number := nullif(btrim(p_data ->> 'tax_number'), '');
  v_new.register_number := nullif(btrim(p_data ->> 'register_number'), '');
  -- PROJ-37: Schalter „Rechnungen nacherfassen“; fehlt der Schlüssel, bleibt er unverändert
  if v_backfill is not null then
    if jsonb_typeof(v_backfill) <> 'boolean' then
      raise exception 'Ungültiger Schalter.' using errcode = '22023';
    end if;
    v_new.invoice_backfill_enabled := v_backfill::boolean;
  end if;

  foreach v_column in array array[
    'name', 'name_line2', 'address_line1', 'address_line2', 'postal_code', 'city', 'country', 'vat_id', 'tax_number',
    'register_number', 'invoice_backfill_enabled'
  ] loop
    if (to_jsonb(v_old) -> v_column) is distinct from (to_jsonb(v_new) -> v_column) then
      v_changed := v_changed || v_column;
    end if;
  end loop;

  -- Kleinunternehmer-Status (PROJ-36). Fehlt der Schlüssel, bleibt der Verlauf unverändert.
  if v_vat is not null then
    if jsonb_typeof(v_vat) <> 'array' or jsonb_array_length(v_vat) > 50 or exists (
      select 1 from jsonb_array_elements(v_vat) e
      where jsonb_typeof(e) <> 'object'
         or jsonb_typeof(e -> 'small_business') is distinct from 'boolean'
         or coalesce(e ->> 'valid_from', '') !~ '^\d{4}-\d{2}-\d{2}$'
    ) then
      raise exception 'Ungültiger Umsatzsteuer-Status.' using errcode = '22023';
    end if;
    -- Vergleich in fester Reihenfolge; ungültige Kalendertage (z. B. 2026-02-30) scheitern hier beim Umwandeln
    select coalesce(jsonb_agg(jsonb_build_array(v.valid_from, v.small_business) order by v.valid_from), '[]'::jsonb)
      into v_vat_old
      from public.vat_status_changes v where v.tenant_id = p_tenant_id;
    select coalesce(jsonb_agg(jsonb_build_array(d, b) order by d, b), '[]'::jsonb)
      into v_vat_new
      from (
        select (e ->> 'valid_from')::date d, (e ->> 'small_business')::boolean b
        from jsonb_array_elements(v_vat) e
      ) x;
    if v_vat_old is distinct from v_vat_new then
      v_changed := v_changed || 'vat_status'::text;
    end if;
  end if;

  -- Speichern ohne Änderung: kein Fehler, kein Protokolleintrag
  if cardinality(v_changed) = 0 then
    return;
  end if;

  -- Prüfregeln der Tabelle greifen hier (z. B. leerer Name, UID-Format).
  -- Auch bei reiner Verlaufsänderung: setzt „zuletzt geändert am“ (Trigger), damit der Konfliktschutz greift.
  update public.tenants set
    name = v_new.name,
    name_line2 = v_new.name_line2,
    address_line1 = v_new.address_line1,
    address_line2 = v_new.address_line2,
    postal_code = v_new.postal_code,
    city = v_new.city,
    country = v_new.country,
    vat_id = v_new.vat_id,
    tax_number = v_new.tax_number,
    register_number = v_new.register_number,
    invoice_backfill_enabled = v_new.invoice_backfill_enabled
  where id = p_tenant_id;

  if 'vat_status' = any(v_changed) then
    -- Verlauf vollständig ersetzen; ein doppeltes Datum scheitert an der Eindeutigkeit (23505)
    delete from public.vat_status_changes where tenant_id = p_tenant_id;
    insert into public.vat_status_changes (tenant_id, valid_from, small_business)
    select p_tenant_id, (e ->> 'valid_from')::date, (e ->> 'small_business')::boolean
    from jsonb_array_elements(v_vat) e;
  end if;

  insert into public.operator_log (tenant_id, tenant_name, action, actor_id, actor_name, changed_fields)
  select p_tenant_id, v_new.name, 'master_data', (select auth.uid()), coalesce(p.display_name, p.email), v_changed
  from (select 1) one
  left join public.profiles p on p.id = (select auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- Gäste zusammenführen: Rechnungen des aufgelösten Gastes an den verbleibenden hängen.
-- Sonst unverändert gegenüber 20261029043623_guest_company_address.sql.
-- ---------------------------------------------------------------------------
create or replace function private.merge_guests(p_keep uuid, p_remove uuid, p_choice jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keep public.guests;
  v_remove public.guests;
  -- true = Wert des zweiten Gastes übernehmen
  b_name boolean := p_choice ->> 'name' = 'b';
  b_country boolean := p_choice ->> 'country' = 'b';
  b_email boolean := p_choice ->> 'email' = 'b';
  b_phone boolean := p_choice ->> 'phone' = 'b';
  b_language boolean := p_choice ->> 'language' = 'b';
  b_birth boolean := p_choice ->> 'birthDate' = 'b';
  b_address boolean := p_choice ->> 'address' = 'b';
  b_marketing boolean := p_choice ->> 'marketing' = 'b';
  b_company boolean := p_choice ->> 'company' = 'b';
  b_note boolean := p_choice ->> 'note' = 'b';
  -- PROJ-29
  b_titles boolean := p_choice ->> 'titles' = 'b';
  b_gender boolean := p_choice ->> 'gender' = 'b';
  b_document boolean := p_choice ->> 'document' = 'b';
begin
  if p_keep is null or p_remove is null or p_keep = p_remove then
    raise exception 'Ein Gast lässt sich nicht mit sich selbst zusammenführen.' using errcode = 'P0704';
  end if;
  -- feste Sperr-Reihenfolge gegen Verklemmungen bei gleichzeitigen Aufrufen
  perform 1 from public.guests where id in (p_keep, p_remove) order by id for update;
  select * into v_keep from public.guests where id = p_keep;
  select * into v_remove from public.guests where id = p_remove;
  if v_keep.id is null or v_remove.id is null then
    raise exception 'Gast nicht gefunden.' using errcode = 'P0702';
  end if;
  if v_keep.tenant_id <> v_remove.tenant_id then
    raise exception 'Gäste verschiedener Kunden lassen sich nicht zusammenführen.' using errcode = 'P0704';
  end if;
  if not private.has_role(v_keep.tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0701';
  end if;
  if v_keep.anonymized_at is not null or v_remove.anonymized_at is not null then
    raise exception 'Anonymisierte Gäste lassen sich nicht zusammenführen.' using errcode = 'P0703';
  end if;

  -- PROJ-29: Buchungen umhängen und den anderen Gast zuerst entfernen, damit seine Ausweisbilder
  -- (wenn gewählt) an den verbleibenden Gast wandern können (ein Bild hängt immer nur an einem Gast)
  update public.bookings set guest_id = p_keep where guest_id = p_remove;
  -- PROJ-37: Rechnungen hängen danach am verbleibenden Gast
  update public.invoices set guest_id = p_keep where guest_id = p_remove;
  delete from public.guests where id = p_remove;

  update public.guests set
    last_name = case when b_name then v_remove.last_name else v_keep.last_name end,
    first_name = case when b_name then v_remove.first_name else v_keep.first_name end,
    country = case when b_country then v_remove.country else v_keep.country end,
    email = case when b_email then v_remove.email else v_keep.email end,
    email_source = case when b_email then v_remove.email_source else v_keep.email_source end,
    phone = case when b_phone then v_remove.phone else v_keep.phone end,
    phone_source = case when b_phone then v_remove.phone_source else v_keep.phone_source end,
    language = case when b_language then v_remove.language else v_keep.language end,
    birth_date = case when b_birth then v_remove.birth_date else v_keep.birth_date end,
    street = case when b_address then v_remove.street else v_keep.street end,
    postal_code = case when b_address then v_remove.postal_code else v_keep.postal_code end,
    city = case when b_address then v_remove.city else v_keep.city end,
    address_country = case when b_address then v_remove.address_country else v_keep.address_country end,
    marketing_source = case when b_marketing then v_remove.marketing_source else v_keep.marketing_source end,
    marketing_custom = case when b_marketing then v_remove.marketing_custom else v_keep.marketing_custom end,
    company_name = case when b_company then v_remove.company_name else v_keep.company_name end,
    company_vat_id = case when b_company then v_remove.company_vat_id else v_keep.company_vat_id end,
    company_address_line1 = case when b_company then v_remove.company_address_line1 else v_keep.company_address_line1 end,
    company_address_line2 = case when b_company then v_remove.company_address_line2 else v_keep.company_address_line2 end,
    company_postal_code = case when b_company then v_remove.company_postal_code else v_keep.company_postal_code end,
    company_city = case when b_company then v_remove.company_city else v_keep.company_city end,
    company_country = case when b_company then v_remove.company_country else v_keep.company_country end,
    note = case when b_note then v_remove.note else v_keep.note end,
    title_prefix = case when b_titles then v_remove.title_prefix else v_keep.title_prefix end,
    title_suffix = case when b_titles then v_remove.title_suffix else v_keep.title_suffix end,
    gender = case when b_gender then v_remove.gender else v_keep.gender end,
    -- Reisedokument als Ganzes (Angaben und beide Bilder)
    document_type = case when b_document then v_remove.document_type else v_keep.document_type end,
    document_number = case when b_document then v_remove.document_number else v_keep.document_number end,
    document_issued_on = case when b_document then v_remove.document_issued_on else v_keep.document_issued_on end,
    document_authority = case when b_document then v_remove.document_authority else v_keep.document_authority end,
    document_country = case when b_document then v_remove.document_country else v_keep.document_country end,
    document_front_path = case when b_document then v_remove.document_front_path else v_keep.document_front_path end,
    document_back_path = case when b_document then v_remove.document_back_path else v_keep.document_back_path end
  where id = p_keep;

  -- Verknüpfung im Protokoll: „zusammengeführt mit …“ beim verbleibenden Gast
  insert into public.audit_log (tenant_id, table_name, record_id, action, old_data, new_data, actor_id, actor_label)
  values (
    v_keep.tenant_id, 'guests', p_keep, 'update', null,
    jsonb_build_object('merged_from', p_remove),
    auth.uid(), 'user'
  );
end;
$$;
