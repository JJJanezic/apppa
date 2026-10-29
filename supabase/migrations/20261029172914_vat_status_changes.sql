-- PROJ-36: Kleinunternehmer-Status
--
-- * Neue Tabelle vat_status_changes: Verlauf „ab Datum: Kleinunternehmer ja/nein“ je Kunde, jedes Datum einmal
-- * Lesen nur Inhaber und Admin (nicht Mitarbeiter); Schreiben nur über private.update_tenant_master_data
-- * update_tenant_master_data (PROJ-28) speichert den Verlauf mit: vollständig ersetzen, höchstens 50 Einträge,
--   „zuletzt geändert am“ des Kunden wird gesetzt (Konfliktschutz), Protokoll-Feld „vat_status“
--
-- Fehlercodes zusätzlich zu PROJ-28: 23505 doppeltes Datum, 22023 ungültiger Verlauf

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------
create table public.vat_status_changes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  valid_from date not null check (valid_from between '2000-01-01' and '2100-12-31'),
  small_business boolean not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint vat_status_changes_tenant_day_key unique (tenant_id, valid_from)
);
comment on table public.vat_status_changes is
  'Kleinunternehmer-Status je Kunde als Verlauf (PROJ-36). Ohne Eintrag gilt „mit Umsatzsteuer“. Nur Inhaber und Admin lesen.';
comment on column public.vat_status_changes.valid_from is 'Kalendertag, ab dem der Status gilt (einschließlich).';
comment on column public.vat_status_changes.small_business is 'true = Kleinunternehmer, keine Umsatzsteuer; false = mit Umsatzsteuer.';

revoke all on public.vat_status_changes from anon, authenticated;
grant select on public.vat_status_changes to authenticated;

alter table public.vat_status_changes enable row level security;

create policy "Inhaber und Admin lesen den Umsatzsteuer-Status"
  on public.vat_status_changes for select to authenticated
  using (private.has_role(tenant_id, 'owner') or (select private.is_admin()));
-- kein insert/update/delete: nur über private.update_tenant_master_data

select private.enable_tenant_table('public.vat_status_changes');

-- ---------------------------------------------------------------------------
-- Speichern: Stammdaten + Verlauf
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

  foreach v_column in array array[
    'name', 'name_line2', 'address_line1', 'address_line2', 'postal_code', 'city', 'country', 'vat_id', 'tax_number',
    'register_number'
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
    register_number = v_new.register_number
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
