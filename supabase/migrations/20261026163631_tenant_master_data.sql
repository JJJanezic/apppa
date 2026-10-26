-- PROJ-28: Kundenstammdaten
--
-- * Neun optionale Felder am Kunden (leer = null), Prüfregeln wie im Formular (src/lib/validation/tenant.ts)
-- * Eine Speicherfunktion für Inhaber und Betreiber-Admin: Rolle, Aktiv-Status, Stand („zuletzt geändert am“)
--   und Betreiber-Protokoll an einer Stelle
-- * Direktes Ändern des Namens durch Inhaber wird geschlossen (läuft über die Funktion)
-- * Betreiber-Protokoll: Eintragsart „master_data“ mit geänderten Feldern
-- * Kundenübersicht des Betreibers liefert zusätzlich den Ort
--
-- Fehlercodes: 42501 keine Rechte, P0011 Kunde weg, P0016 deaktiviert (aus private.lock_tenant), P0017 inzwischen geändert

-- ---------------------------------------------------------------------------
-- Felder
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column name_line2 text check (name_line2 is null or length(btrim(name_line2)) between 1 and 200),
  add column address_line1 text check (address_line1 is null or length(btrim(address_line1)) between 1 and 200),
  add column address_line2 text check (address_line2 is null or length(btrim(address_line2)) between 1 and 200),
  add column postal_code text check (postal_code is null or length(btrim(postal_code)) between 1 and 10),
  add column city text check (city is null or length(btrim(city)) between 1 and 100),
  add column country text check (country is null or country ~ '^[A-Z]{2}$'),
  -- Nur Format: Österreich ATU + 8 Ziffern, sonst Länderkürzel + 2–13 Buchstaben/Ziffern
  add column vat_id text check (
    vat_id is null
    or (vat_id like 'AT%' and vat_id ~ '^ATU[0-9]{8}$')
    or (vat_id not like 'AT%' and vat_id ~ '^[A-Z]{2}[A-Z0-9]{2,13}$')
  ),
  add column tax_number text check (tax_number is null or length(btrim(tax_number)) between 1 and 30),
  add column register_number text check (register_number is null or length(btrim(register_number)) between 1 and 30);

comment on column public.tenants.vat_id is 'UID, ohne Leerzeichen, Großbuchstaben. Nur Formatprüfung, keine VIES-Abfrage (PROJ-28).';

-- Inhaber ändern den Kunden nur noch über private.update_tenant_master_data (Konfliktschutz + Protokoll)
revoke update (name) on public.tenants from authenticated;
drop policy "Inhaber ändern ihren Mandanten" on public.tenants;

-- ---------------------------------------------------------------------------
-- Betreiber-Protokoll
-- ---------------------------------------------------------------------------
alter table public.operator_log add column changed_fields text[];
alter table public.operator_log drop constraint operator_log_action_check;
alter table public.operator_log add constraint operator_log_action_check check (action in (
  'created', 'invited', 'resent', 'revoked', 'promoted', 'demoted', 'removed', 'deactivated', 'reactivated', 'deleted',
  'master_data'
));
comment on table public.operator_log is
  'Admin-Aktionen je Kunde (PROJ-5) und Stammdaten-Änderungen durch Inhaber oder Admin (PROJ-28). Nur der Admin liest; Einträge entstehen nur in den geschützten Funktionen.';

-- ---------------------------------------------------------------------------
-- Speichern
-- ---------------------------------------------------------------------------
create function private.update_tenant_master_data(p_tenant_id uuid, p_expected_updated_at timestamptz, p_data jsonb)
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
  -- Speichern ohne Änderung: kein Fehler, kein Protokolleintrag
  if cardinality(v_changed) = 0 then
    return;
  end if;

  -- Prüfregeln der Tabelle greifen hier (z. B. leerer Name, UID-Format)
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

  insert into public.operator_log (tenant_id, tenant_name, action, actor_id, actor_name, changed_fields)
  select p_tenant_id, v_new.name, 'master_data', (select auth.uid()), coalesce(p.display_name, p.email), v_changed
  from (select 1) one
  left join public.profiles p on p.id = (select auth.uid());
end;
$$;

revoke execute on function private.update_tenant_master_data(uuid, timestamptz, jsonb) from public, anon;
grant execute on function private.update_tenant_master_data(uuid, timestamptz, jsonb) to authenticated;

create function public.update_tenant_master_data(p_tenant_id uuid, p_expected_updated_at timestamptz, p_data jsonb)
returns void
language sql security invoker set search_path = ''
as $$ select private.update_tenant_master_data(p_tenant_id, p_expected_updated_at, p_data); $$;

revoke execute on function public.update_tenant_master_data(uuid, timestamptz, jsonb) from public, anon;
grant execute on function public.update_tenant_master_data(uuid, timestamptz, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Kundenübersicht: zusätzlich der Ort (Rückgabetyp ändert sich → neu anlegen)
-- ---------------------------------------------------------------------------
drop function public.admin_tenant_overview(text, integer, integer);
drop function private.admin_tenant_overview(text, integer, integer);

create function private.admin_tenant_overview(p_query text default '', p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid,
  name text,
  status public.tenant_status,
  created_at timestamptz,
  member_count integer,
  owners jsonb,
  invitations jsonb,
  last_sign_in_at timestamptz,
  city text,
  total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := lower(btrim(coalesce(p_query, '')));
begin
  perform private.require_admin();
  return query
  with hits as (
    select t.*
    from public.tenants t
    where v_q = ''
       or strpos(lower(t.name), v_q) > 0
       or exists (
         select 1 from public.memberships m join public.profiles p on p.id = m.user_id
         where m.tenant_id = t.id and strpos(lower(p.email), v_q) > 0
       )
       or exists (
         select 1 from public.invitations i
         where i.tenant_id = t.id and i.status = 'open' and strpos(i.email, v_q) > 0
       )
  )
  select
    h.id,
    h.name,
    h.status,
    h.created_at,
    (select count(*)::integer from public.memberships m where m.tenant_id = h.id),
    coalesce((
      select jsonb_agg(jsonb_build_object('name', p.display_name, 'email', p.email) order by coalesce(p.display_name, p.email))
      from public.memberships m join public.profiles p on p.id = m.user_id
      where m.tenant_id = h.id and m.role = 'owner'
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('email', i.email, 'role', i.role, 'expires_at', i.expires_at) order by i.sent_at desc)
      from public.invitations i
      where i.tenant_id = h.id and i.status = 'open'
    ), '[]'::jsonb),
    (select max(u.last_sign_in_at) from public.memberships m join auth.users u on u.id = m.user_id where m.tenant_id = h.id),
    h.city,
    count(*) over ()
  from hits h
  order by lower(h.name), h.id
  limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

revoke execute on function private.admin_tenant_overview(text, integer, integer) from public, anon;
grant execute on function private.admin_tenant_overview(text, integer, integer) to authenticated;

create function public.admin_tenant_overview(p_query text default '', p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, name text, status public.tenant_status, created_at timestamptz, member_count integer,
  owners jsonb, invitations jsonb, last_sign_in_at timestamptz, city text, total bigint
)
language sql stable security invoker set search_path = ''
as $$ select * from private.admin_tenant_overview(p_query, p_limit, p_offset); $$;
