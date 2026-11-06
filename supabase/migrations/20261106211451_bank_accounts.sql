-- PROJ-46: Bankkonten des Kunden und je Wohnung booking.com Hotel-ID und Bankkonto
--
-- * Neue Tabelle bank_accounts: mehrere Konten je Kunde, höchstens eines primär, das primäre nie archiviert,
--   jede IBAN je Kunde nur einmal (auch archivierte). Lesen nur Inhaber und Admin (nicht Mitarbeiter);
--   Schreiben nur über private.update_tenant_master_data
-- * Wohnung: booking_hotel_id (frei, doppelt erlaubt) und bank_account_id (null = „Primäres Konto“, folgt automatisch).
--   Verweis nur auf Konten desselben Kunden; Löschen eines verwendeten Kontos verhindert der Fremdschlüssel;
--   archivierte Konten lehnt eine Prüfung beim Speichern der Wohnung ab
-- * update_tenant_master_data gleicht die Konten je Kennung ab (anlegen, ändern, löschen), stellt Wohnungen
--   archivierter Konten auf „Primäres Konto“ zurück und vermerkt „bank_accounts“ im Betreiber-Protokoll
--
-- Fehlercodes zusätzlich: 23505 doppelte IBAN (Name enthält „bank_accounts“), 23503 Konto wird von einer Wohnung
-- verwendet, 22023 ungültige Kontenliste, P0019 Primär-Regel verletzt, P0020 Wohnung auf archiviertes/fremdes Konto

-- ---------------------------------------------------------------------------
-- IBAN-Prüfziffer (ISO 13616, mod 97) als Absicherung neben der Prüfung im Server
-- ---------------------------------------------------------------------------
create function private.iban_checksum_ok(p_iban text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text := substr(p_iban, 5) || substr(p_iban, 1, 4);
  v_rest integer := 0;
  v_char text;
  v_digits text;
begin
  for i in 1 .. length(v_text) loop
    v_char := substr(v_text, i, 1);
    -- Buchstaben A–Z zählen als 10–35
    v_digits := case when v_char ~ '[0-9]' then v_char else (ascii(v_char) - 55)::text end;
    for j in 1 .. length(v_digits) loop
      v_rest := (v_rest * 10 + substr(v_digits, j, 1)::integer) % 97;
    end loop;
  end loop;
  return v_rest = 1;
end;
$$;
revoke execute on function private.iban_checksum_ok(text) from public;

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  label text check (label is null or (label = btrim(label) and length(label) between 1 and 100)),
  account_holder text not null check (account_holder = btrim(account_holder) and length(account_holder) between 1 and 200),
  iban text not null check (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' and private.iban_checksum_ok(iban)),
  bic text check (bic is null or bic ~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$'),
  bank_name text check (bank_name is null or (bank_name = btrim(bank_name) and length(bank_name) between 1 and 100)),
  note text check (note is null or length(note) between 1 and 500),
  is_primary boolean not null default false,
  archived_at timestamptz,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint bank_accounts_tenant_iban_key unique (tenant_id, iban),
  -- Ziel des Verweises von Wohnungen (Kunde muss übereinstimmen)
  constraint bank_accounts_id_tenant_key unique (id, tenant_id),
  constraint bank_accounts_primary_active check (not (is_primary and archived_at is not null))
);
-- höchstens ein primäres Konto je Kunde
create unique index bank_accounts_one_primary_key on public.bank_accounts (tenant_id) where is_primary;

comment on table public.bank_accounts is
  'Bankkonten je Kunde (PROJ-46). Höchstens eines primär, nie archiviert. Nur Inhaber und Admin lesen; Schreiben über update_tenant_master_data.';
comment on column public.bank_accounts.iban is 'Ohne Leerzeichen, Großbuchstaben; Prüfziffer geprüft.';
comment on column public.bank_accounts.position is 'Reihenfolge des Anlegens (aufsteigend).';

revoke all on public.bank_accounts from anon, authenticated;
grant select on public.bank_accounts to authenticated;

alter table public.bank_accounts enable row level security;

create policy "Inhaber und Admin lesen Bankkonten"
  on public.bank_accounts for select to authenticated
  using (private.has_role(tenant_id, 'owner') or (select private.is_admin()));
-- kein insert/update/delete: nur über private.update_tenant_master_data

select private.enable_tenant_table('public.bank_accounts');

-- ---------------------------------------------------------------------------
-- Wohnung: Hotel-ID und Bankkonto
-- ---------------------------------------------------------------------------
alter table public.apartments
  add column booking_hotel_id text check (booking_hotel_id ~ '^[A-Za-z0-9-]{1,30}$'),
  add column bank_account_id uuid,
  add constraint apartments_bank_account_fkey
    foreign key (bank_account_id, tenant_id) references public.bank_accounts (id, tenant_id);

comment on column public.apartments.booking_hotel_id is 'booking.com Hotel-ID (PROJ-46); Buchstaben, Ziffern, Bindestrich; mehrere Wohnungen dürfen dieselbe haben.';
comment on column public.apartments.bank_account_id is 'Bankkonto (PROJ-46); null = „Primäres Konto“ des Kunden (folgt automatisch).';

create index apartments_bank_account_tenant_idx on public.apartments (bank_account_id, tenant_id);

grant insert (booking_hotel_id, bank_account_id), update (booking_hotel_id, bank_account_id) on public.apartments to authenticated;

-- Neu gewähltes Konto muss aktiv sein und zum Kunden der Wohnung gehören. Die Sperre („for share“) wartet auf ein
-- gleichzeitiges Archivieren, damit keine Wohnung danach auf ein archiviertes Konto zeigt.
create function private.check_apartment_bank_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.bank_account_id is not null and (tg_op = 'INSERT' or new.bank_account_id is distinct from old.bank_account_id) then
    perform 1 from public.bank_accounts b
      where b.id = new.bank_account_id and b.tenant_id = new.tenant_id and b.archived_at is null
      for share;
    if not found then
      raise exception 'Das Bankkonto ist archiviert oder gehört nicht zu diesem Kunden.' using errcode = 'P0020';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.check_apartment_bank_account() from public;

create trigger check_bank_account
  before insert or update of bank_account_id on public.apartments
  for each row execute function private.check_apartment_bank_account();

-- ---------------------------------------------------------------------------
-- Speichern: Stammdaten + Verlauf + Logo + Bankkonten
-- ---------------------------------------------------------------------------
create or replace function private.update_tenant_master_data(p_tenant_id uuid, p_expected_updated_at timestamptz, p_data jsonb)
returns jsonb
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
  -- PROJ-38: Logo; fehlt der Schlüssel, bleibt es unverändert, null entfernt es
  v_logo_given boolean := p_data ? 'logo_path';
  v_logo text := nullif(btrim(coalesce(p_data ->> 'logo_path', '')), '');
  -- PROJ-46: Bankkonten; fehlt der Schlüssel, bleiben sie unverändert
  v_bank jsonb := p_data -> 'bank_accounts';
  v_bank_rows jsonb;
  v_bank_old jsonb;
  v_bank_new jsonb;
  v_max_position integer;
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
  -- Logo (PROJ-38): ein neuer Speicherort muss im Ordner dieses Kunden liegen und als PNG hochgeladen sein
  if v_logo_given then
    if v_logo is not null and v_logo is distinct from v_old.logo_path and (
      private.logo_tenant(v_logo) is distinct from p_tenant_id
      or not exists (select 1 from storage.objects o where o.bucket_id = 'tenant-logos' and o.name = v_logo)
    ) then
      raise exception 'Das Logo wurde nicht gefunden.' using errcode = 'P0018';
    end if;
    v_new.logo_path := v_logo;
  end if;

  foreach v_column in array array[
    'name', 'name_line2', 'address_line1', 'address_line2', 'postal_code', 'city', 'country', 'vat_id', 'tax_number',
    'register_number', 'logo_path'
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

  -- Bankkonten (PROJ-46): vollständige Liste aller Konten des Kunden, je Konto mit fester Kennung
  if v_bank is not null then
    if jsonb_typeof(v_bank) <> 'array' or jsonb_array_length(v_bank) > 20 or exists (
      select 1 from jsonb_array_elements(v_bank) e
      where jsonb_typeof(e) <> 'object'
         or coalesce(e ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or jsonb_typeof(e -> 'account_holder') is distinct from 'string'
         or jsonb_typeof(e -> 'iban') is distinct from 'string'
         or jsonb_typeof(e -> 'is_primary') is distinct from 'boolean'
         or jsonb_typeof(e -> 'archived') is distinct from 'boolean'
    ) or (select count(distinct e ->> 'id') from jsonb_array_elements(v_bank) e) <> jsonb_array_length(v_bank) then
      raise exception 'Ungültige Bankkonten.' using errcode = '22023';
    end if;
    -- Kennungen anderer Kunden sind nicht erlaubt
    if exists (
      select 1 from jsonb_array_elements(v_bank) e
      join public.bank_accounts b on b.id = (e ->> 'id')::uuid
      where b.tenant_id <> p_tenant_id
    ) then
      raise exception 'Ungültige Bankkonten.' using errcode = '22023';
    end if;

    -- Bereinigen wie im Formular; ord = Reihenfolge in der Liste (für neue Konten)
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', (e ->> 'id')::uuid,
        'label', nullif(btrim(e ->> 'label'), ''),
        'account_holder', btrim(e ->> 'account_holder'),
        'iban', upper(regexp_replace(e ->> 'iban', '\s', '', 'g')),
        'bic', nullif(upper(regexp_replace(coalesce(e ->> 'bic', ''), '\s', '', 'g')), ''),
        'bank_name', nullif(btrim(e ->> 'bank_name'), ''),
        'note', nullif(btrim(e ->> 'note'), ''),
        'is_primary', (e ->> 'is_primary')::boolean,
        'archived', (e ->> 'archived')::boolean,
        'ord', o
      )), '[]'::jsonb)
      into v_bank_rows
      from jsonb_array_elements(v_bank) with ordinality t(e, o);

    -- Primär-Regel: gibt es Konten, ist genau eines primär, und das primäre ist nicht archiviert
    if jsonb_array_length(v_bank_rows) > 0 and (
      (select count(*) from jsonb_array_elements(v_bank_rows) x where (x ->> 'is_primary')::boolean) <> 1
      or exists (select 1 from jsonb_array_elements(v_bank_rows) x where (x ->> 'is_primary')::boolean and (x ->> 'archived')::boolean)
    ) then
      raise exception 'Genau ein aktives Bankkonto muss primär sein.' using errcode = 'P0019';
    end if;

    -- Vergleich ohne Reihenfolge (die Position bestehender Konten ändert sich nie)
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id, 'label', b.label, 'account_holder', b.account_holder, 'iban', b.iban, 'bic', b.bic,
        'bank_name', b.bank_name, 'note', b.note, 'is_primary', b.is_primary, 'archived', b.archived_at is not null
      ) order by b.id), '[]'::jsonb)
      into v_bank_old
      from public.bank_accounts b where b.tenant_id = p_tenant_id;
    select coalesce(jsonb_agg(x - 'ord' order by (x ->> 'id')::uuid), '[]'::jsonb)
      into v_bank_new
      from jsonb_array_elements(v_bank_rows) x;
    if v_bank_old is distinct from v_bank_new then
      v_changed := v_changed || 'bank_accounts'::text;
    end if;
  end if;

  -- Speichern ohne Änderung: kein Fehler, kein Protokolleintrag
  if cardinality(v_changed) = 0 then
    return jsonb_build_object('unused_logo', null);
  end if;

  -- Prüfregeln der Tabelle greifen hier (z. B. leerer Name, UID-Format).
  -- Auch bei reiner Verlaufs- oder Kontenänderung: setzt „zuletzt geändert am“ (Trigger), damit der Konfliktschutz greift.
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
    logo_path = v_new.logo_path
  where id = p_tenant_id;

  if 'vat_status' = any(v_changed) then
    -- Verlauf vollständig ersetzen; ein doppeltes Datum scheitert an der Eindeutigkeit (23505)
    delete from public.vat_status_changes where tenant_id = p_tenant_id;
    insert into public.vat_status_changes (tenant_id, valid_from, small_business)
    select p_tenant_id, (e ->> 'valid_from')::date, (e ->> 'small_business')::boolean
    from jsonb_array_elements(v_vat) e;
  end if;

  if 'bank_accounts' = any(v_changed) then
    -- Fehlende Konten löschen; verwendet eine Wohnung das Konto, scheitert das am Fremdschlüssel (23503)
    delete from public.bank_accounts b
    where b.tenant_id = p_tenant_id
      and not exists (select 1 from jsonb_array_elements(v_bank_rows) x where (x ->> 'id')::uuid = b.id);

    -- Erst das bisherige primäre Konto freigeben, sonst stößt der Wechsel an die Eindeutigkeit
    update public.bank_accounts b set is_primary = false
    where b.tenant_id = p_tenant_id and b.is_primary
      and not exists (
        select 1 from jsonb_array_elements(v_bank_rows) x where (x ->> 'id')::uuid = b.id and (x ->> 'is_primary')::boolean
      );

    -- Bestehende Konten ändern; der Zeitpunkt des Archivierens bleibt erhalten
    update public.bank_accounts b set
      label = r.label,
      account_holder = r.account_holder,
      iban = r.iban,
      bic = r.bic,
      bank_name = r.bank_name,
      note = r.note,
      is_primary = r.is_primary,
      archived_at = case when r.archived then coalesce(b.archived_at, now()) end
    from jsonb_to_recordset(v_bank_rows) as r(
      id uuid, label text, account_holder text, iban text, bic text, bank_name text, note text, is_primary boolean, archived boolean
    )
    where b.id = r.id and b.tenant_id = p_tenant_id
      and (b.label, b.account_holder, b.iban, b.bic, b.bank_name, b.note, b.is_primary, b.archived_at is not null)
        is distinct from (r.label, r.account_holder, r.iban, r.bic, r.bank_name, r.note, r.is_primary, r.archived);

    -- Neue Konten hinten anfügen (Reihenfolge des Anlegens)
    select coalesce(max(position), -1) into v_max_position from public.bank_accounts where tenant_id = p_tenant_id;
    insert into public.bank_accounts (id, tenant_id, label, account_holder, iban, bic, bank_name, note, is_primary, archived_at, position)
    select r.id, p_tenant_id, r.label, r.account_holder, r.iban, r.bic, r.bank_name, r.note, r.is_primary,
           case when r.archived then now() end,
           v_max_position + row_number() over (order by r.ord)
    from jsonb_to_recordset(v_bank_rows) as r(
      id uuid, label text, account_holder text, iban text, bic text, bank_name text, note text, is_primary boolean, archived boolean, ord integer
    )
    where not exists (select 1 from public.bank_accounts b where b.id = r.id);

    -- Wohnungen archivierter Konten (auch archivierte Wohnungen) auf „Primäres Konto“ zurückstellen
    update public.apartments a set bank_account_id = null
    where a.tenant_id = p_tenant_id
      and a.bank_account_id in (select b.id from public.bank_accounts b where b.tenant_id = p_tenant_id and b.archived_at is not null);
  end if;

  insert into public.operator_log (tenant_id, tenant_name, action, actor_id, actor_name, changed_fields)
  select p_tenant_id, v_new.name, 'master_data', (select auth.uid()), coalesce(p.display_name, p.email), v_changed
  from (select 1) one
  left join public.profiles p on p.id = (select auth.uid());

  -- Ersetztes bzw. entferntes Logo: der Server löscht die Datei
  return jsonb_build_object(
    'unused_logo', case when v_old.logo_path is distinct from v_new.logo_path then v_old.logo_path end
  );
end;
$$;
