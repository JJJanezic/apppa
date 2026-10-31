-- PROJ-38: Stammdaten-Logo
--
-- * Kunde: Feld logo_path (Speicherort <Kunde>/<zufällig>.png im Bereich „tenant-logos“), nur im Ordner des Kunden
-- * Speicherbereich tenant-logos (privat, nur PNG, 5 MB): hochladen Inhaber bzw. Admin (2FA) in den Ordner eines
--   aktiven Kunden; lesen Inhaber und Admin nur das eingetragene Logo; Mitarbeiter gar nicht; löschen nur der Server
-- * update_tenant_master_data: Schlüssel logo_path (fehlt = unverändert, null = entfernen), Protokollfeld logo_path;
--   gibt jetzt {unused_logo} zurück (ersetztes bzw. entferntes Logo zum Löschen) statt nichts
-- * unused_tenant_logos: tägliche Bereinigung (nur Server)
-- * Kommentar der Rechnungs-Tabelle auf die neue Gliederung (PROJ-41 ausgestellt)
--
-- Fehlercodes: P0018 Logo fehlt oder liegt nicht im Ordner des Kunden

-- ---------------------------------------------------------------------------
-- Kunde: Logo
-- ---------------------------------------------------------------------------
-- Kunde eines Speicherorts <Kunde>/<zufällig>.png (null bei jedem anderen Format)
create function private.logo_tenant(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$'
    then split_part(p_name, '/', 1)::uuid end;
$$;

revoke execute on function private.logo_tenant(text) from public, anon;
grant execute on function private.logo_tenant(text) to authenticated, service_role;

alter table public.tenants add column logo_path text;
alter table public.tenants add constraint tenants_logo_path_check
  check (logo_path is null or private.logo_tenant(logo_path) = id);
comment on column public.tenants.logo_path is
  'Logo (PROJ-38): Speicherort im Bereich „tenant-logos“, <Kunde>/<zufällig>.png. Ändern nur über update_tenant_master_data.';

-- ---------------------------------------------------------------------------
-- Speicherbereich für Logos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tenant-logos', 'tenant-logos', false, 5242880, array['image/png'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/png'];

-- Darf die angemeldete Person in den Ordner hochladen? Inhaber des (aktiven) Kunden oder Admin mit 2FA bei einem
-- aktiven Kunden
create function private.can_upload_logo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.logo_tenant(p_name) is not null
    and (
      private.has_role(private.logo_tenant(p_name), 'owner')
      or (
        private.is_admin()
        and exists (select 1 from public.tenants t where t.id = private.logo_tenant(p_name) and t.status = 'active')
      )
    );
$$;

-- Darf die angemeldete Person das Logo lesen? Inhaber des Kunden oder Admin mit 2FA, und die Datei ist das
-- eingetragene Logo dieses Kunden (ersetzte und nicht gespeicherte Dateien sind für niemanden lesbar)
create function private.can_read_logo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.logo_tenant(p_name) is not null
    and (private.has_role(private.logo_tenant(p_name), 'owner') or private.is_admin())
    and exists (select 1 from public.tenants t where t.id = private.logo_tenant(p_name) and t.logo_path = p_name);
$$;

revoke execute on function private.can_upload_logo(text) from public, anon;
revoke execute on function private.can_read_logo(text) from public, anon;
grant execute on function private.can_upload_logo(text) to authenticated, service_role;
grant execute on function private.can_read_logo(text) to authenticated, service_role;

create policy "Inhaber und Admin laden Logos in den Ordner des Kunden"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-logos' and private.can_upload_logo(name));
create policy "Inhaber und Admin lesen das eingetragene Logo"
  on storage.objects for select to authenticated
  using (bucket_id = 'tenant-logos' and private.can_read_logo(name));
-- Kein Ändern oder Löschen durch Nutzer (nur der Server mit geheimem Schlüssel)

-- ---------------------------------------------------------------------------
-- Stammdaten speichern: Logo dazu, Rückgabe des alten Logos (Rückgabetyp ändert sich → neu anlegen).
-- Sonst unverändert gegenüber 20261030071155_invoices.sql.
-- ---------------------------------------------------------------------------
drop function public.update_tenant_master_data(uuid, timestamptz, jsonb);
drop function private.update_tenant_master_data(uuid, timestamptz, jsonb);

create function private.update_tenant_master_data(p_tenant_id uuid, p_expected_updated_at timestamptz, p_data jsonb)
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
  v_backfill jsonb := p_data -> 'invoice_backfill_enabled';
  -- PROJ-38: Logo; fehlt der Schlüssel, bleibt es unverändert, null entfernt es
  v_logo_given boolean := p_data ? 'logo_path';
  v_logo text := nullif(btrim(coalesce(p_data ->> 'logo_path', '')), '');
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
    'register_number', 'invoice_backfill_enabled', 'logo_path'
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
    return jsonb_build_object('unused_logo', null);
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
    invoice_backfill_enabled = v_new.invoice_backfill_enabled,
    logo_path = v_new.logo_path
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

  -- Ersetztes bzw. entferntes Logo: der Server löscht die Datei
  return jsonb_build_object(
    'unused_logo', case when v_old.logo_path is distinct from v_new.logo_path then v_old.logo_path end
  );
end;
$$;

revoke execute on function private.update_tenant_master_data(uuid, timestamptz, jsonb) from public, anon;
grant execute on function private.update_tenant_master_data(uuid, timestamptz, jsonb) to authenticated;

create function public.update_tenant_master_data(p_tenant_id uuid, p_expected_updated_at timestamptz, p_data jsonb)
returns jsonb
language sql security invoker set search_path = ''
as $$ select private.update_tenant_master_data(p_tenant_id, p_expected_updated_at, p_data); $$;

revoke execute on function public.update_tenant_master_data(uuid, timestamptz, jsonb) from public, anon;
grant execute on function public.update_tenant_master_data(uuid, timestamptz, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Tägliche Bereinigung: Logos, die älter als 24 Stunden sind und an keinem Kunden hängen (nur Server)
-- ---------------------------------------------------------------------------
create function public.unused_tenant_logos(p_limit integer default 1000)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'tenant-logos'
    and o.created_at < now() - interval '24 hours'
    and not exists (select 1 from public.tenants t where t.logo_path = o.name)
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

revoke execute on function public.unused_tenant_logos(integer) from public, anon, authenticated;
grant execute on function public.unused_tenant_logos(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Rechnungen: Kommentar auf die neue Gliederung (PROJ-38 bis PROJ-42)
-- ---------------------------------------------------------------------------
comment on table public.invoices is
  'Rechnungen je Kunde (PROJ-37: nacherfasst; PROJ-41: ausgestellt). Schreiben nur über save_invoice/delete_invoice.';
