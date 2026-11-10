-- PROJ-51: Ausweis automatisch auslesen (experimentell)
-- * id_reading_settings: Schalter, Tageslimit und Hinweis „Datenschutz-Text prüfen“ je Kunde (keine Zeile = aus). Eigene
--   Tabelle wie guest_sheet_options (Umschalten ändert nicht den Stand der Stammdaten). Lesen: Mitglieder und Betreiber;
--   Schreiben nur über Funktionen (Betreiber: Schalter/Limit, Inhaber: Hinweis bestätigen).
-- * id_readings: Zähler und Protokoll der Auslesungen (Zeitpunkt, Person, Gast, Stelle, Ergebnis, Verbrauch), ohne gelesene
--   Werte und ohne Bilder. Lesen nur der Betreiber; Vormerken (mit Tageslimit) und Abschließen nur der Server (Service-Rolle).
--   Gast gelöscht oder anonymisiert → guest_id leer.
-- * Herkunftsvermerk im Änderungsprotokoll: save_guest_from_id_document („Ausweis“) und
--   save_guest_sheet_field_from_id_document („Gästeblatt, aus Ausweis gelesen“).
-- * Betreiber-Protokoll: id_reading_on, id_reading_off, id_reading_limit (target_label = Tageslimit).

-- ---------------------------------------------------------------------------
-- Einstellungen je Kunde
-- ---------------------------------------------------------------------------
create table public.id_reading_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  enabled boolean not null default false,
  daily_limit integer not null default 50 check (daily_limit between 1 and 1000),
  privacy_hint_seen_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
comment on table public.id_reading_settings is
  'PROJ-51: „Ausweis automatisch auslesen“ je Kunde – Schalter (nur Betreiber), Tageslimit, Hinweis „Datenschutz-Text prüfen“ bestätigt.';

revoke all on public.id_reading_settings from anon, authenticated;
grant select on public.id_reading_settings to authenticated;
alter table public.id_reading_settings enable row level security;
create policy "Mitglieder und Admin lesen Ausweis-Einstellungen" on public.id_reading_settings for select to authenticated
  using (private.is_member(tenant_id) or (select private.is_admin()));
select private.enable_tenant_table('public.id_reading_settings');

-- ---------------------------------------------------------------------------
-- Auslesungen (Zähler und Protokoll)
-- ---------------------------------------------------------------------------
create table public.id_readings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  guest_id uuid references public.guests (id) on delete set null,
  place text not null check (place in ('guestForm', 'guestSheet')),
  -- started: läuft; read: gelesen; no_document: kein Ausweis erkannt; failed: Antwort unbrauchbar oder Zeitüberschreitung;
  -- unreachable: keine Verbindung zum Dienst (zählt nicht)
  outcome text not null default 'started' check (outcome in ('started', 'read', 'no_document', 'failed', 'unreachable')),
  counted boolean not null default true,
  model text check (model is null or length(model) <= 100),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
comment on table public.id_readings is
  'PROJ-51: Ausweis-Auslesungen als Zähler (Tageslimit, Monatszähler) und Protokoll – ohne gelesene Werte und ohne Bilder.';
create index id_readings_tenant_started_idx on public.id_readings (tenant_id, started_at desc);
create index id_readings_guest_idx on public.id_readings (guest_id) where guest_id is not null;
create index id_readings_user_idx on public.id_readings (user_id) where user_id is not null;

revoke all on public.id_readings from anon, authenticated;
grant select on public.id_readings to authenticated;
alter table public.id_readings enable row level security;
create policy "Admin liest Ausweis-Auslesungen" on public.id_readings for select to authenticated
  using ((select private.is_admin()));

-- Anonymisierter Gast: Bezug aus dem Protokoll entfernen (Löschen erledigt der Fremdschlüssel)
create function private.id_readings_forget_guest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.anonymized_at is not null and old.anonymized_at is null then
    update public.id_readings set guest_id = null where guest_id = new.id;
  end if;
  return null;
end;
$$;
revoke execute on function private.id_readings_forget_guest() from public, anon, authenticated;
create trigger id_readings_forget_guest after update of anonymized_at on public.guests
  for each row execute function private.id_readings_forget_guest();

-- ---------------------------------------------------------------------------
-- Betreiber-Protokoll: neue Aktionen
-- ---------------------------------------------------------------------------
alter table public.operator_log drop constraint operator_log_action_check;
alter table public.operator_log add constraint operator_log_action_check check (action in (
  'created', 'invited', 'resent', 'revoked', 'promoted', 'demoted', 'removed', 'deactivated', 'reactivated', 'deleted',
  'master_data', 'invoice_settings', 'text_block_created', 'text_block_updated', 'text_block_deleted',
  'id_reading_on', 'id_reading_off', 'id_reading_limit'
));

-- ---------------------------------------------------------------------------
-- Betreiber: Schalter und Tageslimit
-- ---------------------------------------------------------------------------
create function private.admin_set_id_reading(p_tenant_id uuid, p_enabled boolean, p_daily_limit integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants;
  v_old public.id_reading_settings;
  v_action text;
begin
  perform private.require_admin();
  if p_enabled is null or p_daily_limit is null or p_daily_limit not between 1 and 1000 then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;
  v_tenant := private.lock_tenant(p_tenant_id, true);
  select * into v_old from public.id_reading_settings where tenant_id = p_tenant_id for update;

  insert into public.id_reading_settings (tenant_id, enabled, daily_limit)
  values (p_tenant_id, p_enabled, p_daily_limit)
  on conflict (tenant_id) do update set
    enabled = excluded.enabled,
    daily_limit = excluded.daily_limit,
    -- Beim Einschalten erscheint der Hinweis „Datenschutz-Text prüfen“ erneut
    privacy_hint_seen_at = case when excluded.enabled and not public.id_reading_settings.enabled then null
                                else public.id_reading_settings.privacy_hint_seen_at end
  where public.id_reading_settings.enabled is distinct from excluded.enabled
     or public.id_reading_settings.daily_limit is distinct from excluded.daily_limit;

  v_action := case
    when coalesce(v_old.enabled, false) <> p_enabled then case when p_enabled then 'id_reading_on' else 'id_reading_off' end
    when coalesce(v_old.daily_limit, 50) <> p_daily_limit then 'id_reading_limit'
  end;
  if v_action is not null then
    insert into public.operator_log (tenant_id, tenant_name, action, actor_id, actor_name, target_label)
    select p_tenant_id, v_tenant.name, v_action, (select auth.uid()), coalesce(p.display_name, p.email), p_daily_limit::text
    from (select 1) one
    left join public.profiles p on p.id = (select auth.uid());
  end if;
end;
$$;

-- Betreiber: Auslesungen im laufenden und im letzten Monat (Wiener Zeit), gezählt wie das Tageslimit
create function private.id_reading_usage(p_tenant_id uuid)
returns table (this_month integer, last_month integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', private.today_vienna())::date;
begin
  perform private.require_admin();
  return query
  select
    count(*) filter (where (r.started_at at time zone 'Europe/Vienna')::date >= v_month)::integer,
    count(*) filter (where (r.started_at at time zone 'Europe/Vienna')::date >= (v_month - interval '1 month')::date
                       and (r.started_at at time zone 'Europe/Vienna')::date < v_month)::integer
  from public.id_readings r
  where r.tenant_id = p_tenant_id
    and r.counted
    and r.started_at >= ((v_month - interval '1 month')::timestamp at time zone 'Europe/Vienna');
end;
$$;

-- ---------------------------------------------------------------------------
-- Inhaber: Hinweis „Datenschutz-Text prüfen“ bestätigen
-- ---------------------------------------------------------------------------
create function private.dismiss_id_reading_privacy_hint(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = '42501';
  end if;
  if exists (select 1 from public.tenants t where t.id = p_tenant_id and t.status = 'deactivated') then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  update public.id_reading_settings set privacy_hint_seen_at = now()
  where tenant_id = p_tenant_id and privacy_hint_seen_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Server (Service-Rolle): Auslesung vormerken und abschließen
-- ---------------------------------------------------------------------------
-- Prüft Freischaltung und Tageslimit in einem Schritt (Sperre auf der Einstellungszeile: gleichzeitige Klicks zählen
-- nacheinander). Fehler: P0990 nicht freigeschaltet, P0991 Tageslimit erreicht, P0016 Kunde deaktiviert.
create function private.reserve_id_reading(p_tenant_id uuid, p_user_id uuid, p_guest_id uuid, p_place text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.id_reading_settings;
  v_used integer;
  v_id uuid;
begin
  if p_place not in ('guestForm', 'guestSheet') then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;
  if exists (select 1 from public.tenants t where t.id = p_tenant_id and t.status = 'deactivated') then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  select * into v_settings from public.id_reading_settings where tenant_id = p_tenant_id for update;
  if v_settings.id is null or not v_settings.enabled then
    raise exception 'Das Auslesen ist für diesen Kunden nicht freigeschaltet.' using errcode = 'P0990';
  end if;
  select count(*) into v_used from public.id_readings r
  where r.tenant_id = p_tenant_id and r.counted
    and r.started_at >= (private.today_vienna()::timestamp at time zone 'Europe/Vienna');
  if v_used >= v_settings.daily_limit then
    raise exception 'Das Tageslimit für das Auslesen ist erreicht.' using errcode = 'P0991';
  end if;
  insert into public.id_readings (tenant_id, user_id, guest_id, place) values (p_tenant_id, p_user_id, p_guest_id, p_place)
  returning id into v_id;
  return v_id;
end;
$$;

create function private.finish_id_reading(
  p_id uuid, p_outcome text, p_model text, p_input_tokens integer, p_output_tokens integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_outcome not in ('read', 'no_document', 'failed', 'unreachable') then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;
  update public.id_readings set
    outcome = p_outcome,
    -- keine Verbindung zum Dienst: es sind keine Kosten entstanden, zählt nicht fürs Limit
    counted = p_outcome <> 'unreachable',
    model = p_model,
    input_tokens = p_input_tokens,
    output_tokens = p_output_tokens,
    finished_at = now()
  where id = p_id and outcome = 'started';
end;
$$;

-- ---------------------------------------------------------------------------
-- Herkunftsvermerk im Änderungsprotokoll
-- ---------------------------------------------------------------------------
-- Gästeblatt: Vermerk aus der Hülle bleibt stehen (sonst unverändert gegenüber 20261109110308_guest_sheet_numbering.sql)
create or replace function private.save_guest_sheet_field(p_booking_id uuid, p_target text, p_values jsonb, p_expected_updated_at timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_guest public.guests;
  v_allowed constant text[] := array['last_name', 'first_name', 'gender', 'birth_date', 'country', 'document_type', 'document_number',
    'document_issued_on', 'document_authority', 'document_country', 'street', 'postal_code', 'city', 'address_country',
    -- Ausweisbilder (Speicherort prüft der Gast-Trigger) und E-Mail (nur, solange keine hinterlegt ist)
    'document_front_path', 'document_back_path', 'email'];
  v_key text;
  v_updated timestamptz;
  v jsonb := p_values;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if p_values is null or jsonb_typeof(p_values) <> 'object' or p_target not in ('guest', 'companions') then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'Buchung nicht gefunden.' using errcode = '42501';
  end if;
  if exists (select 1 from public.tenants t where t.id = v_booking.tenant_id and t.status = 'deactivated') then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  if not private.is_member(v_booking.tenant_id) then
    raise exception 'Buchung nicht gefunden.' using errcode = '42501';
  end if;
  if not private.guest_sheet_expected(v_booking) then
    raise exception 'Für diese Buchung ist kein Gästeblatt vorgesehen.' using errcode = 'P0976';
  end if;
  -- Im Änderungsprotokoll als „Gästeblatt“ vermerkt; über save_guest_sheet_field_from_id_document (PROJ-51) bleibt der
  -- Vermerk „Gästeblatt, aus Ausweis gelesen“ stehen
  if coalesce(current_setting('app.source', true), '') <> 'Gästeblatt, aus Ausweis gelesen' then
    perform set_config('app.source', 'Gästeblatt', true);
  end if;

  if p_target = 'guest' then
    if v_booking.guest_id is null then
      raise exception 'Kein Gast verknüpft.' using errcode = 'P0977';
    end if;
    select * into v_guest from public.guests where id = v_booking.guest_id for update;
    if v_guest.anonymized_at is not null then
      raise exception 'Der Gast ist anonymisiert.' using errcode = 'P0978';
    end if;
    if v_guest.updated_at is distinct from p_expected_updated_at then
      raise exception 'Der Gast wurde inzwischen geändert.' using errcode = 'P0975';
    end if;
    for v_key in select jsonb_object_keys(p_values) loop
      if not v_key = any (v_allowed) then
        raise exception 'Ungültige Eingabe.' using errcode = '22023';
      end if;
    end loop;
    -- Eine vorhandene E-Mail ändert das Gästeblatt nicht (Gastformular, nur Inhaber)
    if v ? 'email' and v_guest.email is not null then
      raise exception 'Ungültige Eingabe.' using errcode = '22023';
    end if;
    begin
      update public.guests set
        last_name = case when v ? 'last_name' then btrim(v ->> 'last_name') else last_name end,
        first_name = case when v ? 'first_name' then nullif(btrim(v ->> 'first_name'), '') else first_name end,
        gender = case when v ? 'gender' then v ->> 'gender' else gender end,
        birth_date = case when v ? 'birth_date' then nullif(v ->> 'birth_date', '')::date else birth_date end,
        country = case when v ? 'country' then upper(v ->> 'country') else country end,
        document_type = case when v ? 'document_type' then nullif(v ->> 'document_type', '') else document_type end,
        document_number = case when v ? 'document_number' then nullif(btrim(v ->> 'document_number'), '') else document_number end,
        document_issued_on = case when v ? 'document_issued_on' then nullif(v ->> 'document_issued_on', '')::date else document_issued_on end,
        document_authority = case when v ? 'document_authority' then nullif(btrim(v ->> 'document_authority'), '') else document_authority end,
        document_country = case when v ? 'document_country' then nullif(upper(v ->> 'document_country'), '') else document_country end,
        street = case when v ? 'street' then nullif(btrim(v ->> 'street'), '') else street end,
        postal_code = case when v ? 'postal_code' then nullif(btrim(v ->> 'postal_code'), '') else postal_code end,
        city = case when v ? 'city' then nullif(btrim(v ->> 'city'), '') else city end,
        address_country = case when v ? 'address_country' then nullif(upper(v ->> 'address_country'), '') else address_country end,
        document_front_path = case when v ? 'document_front_path' then nullif(v ->> 'document_front_path', '') else document_front_path end,
        document_back_path = case when v ? 'document_back_path' then nullif(v ->> 'document_back_path', '') else document_back_path end,
        email = case when v ? 'email' then nullif(lower(btrim(v ->> 'email')), '') else email end
      where id = v_guest.id
      returning updated_at into v_updated;
    exception
      when check_violation or invalid_datetime_format or datetime_field_overflow or not_null_violation then
        raise exception 'Ungültige Eingabe.' using errcode = '22023';
    end;
    return v_updated;
  end if;

  if v_booking.updated_at is distinct from p_expected_updated_at then
    raise exception 'Die Buchung wurde inzwischen geändert.' using errcode = 'P0975';
  end if;


  -- Mitreisende: dieselbe Regel wie im Buchungsformular (Höchstzahl, Geburtsdatum, Ortstaxe neu rechnen)
  if jsonb_typeof(v -> 'companions') is distinct from 'array' then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;
  begin
    perform private.save_companions(p_booking_id, p_expected_updated_at, v -> 'companions');
  exception
    when sqlstate 'P0808' then raise exception 'Zu viele Mitreisende.' using errcode = 'P0979';
    when sqlstate 'P0803' then raise exception 'Die Buchung wurde inzwischen geändert.' using errcode = 'P0975';
    when sqlstate 'P0807' or check_violation or not_null_violation or invalid_datetime_format then
      raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end;
  select updated_at into v_updated from public.bookings where id = p_booking_id;
  return v_updated;
end;
$$;

-- ---------------------------------------------------------------------------
-- Öffentliche Hüllen und Rechte
-- ---------------------------------------------------------------------------
create function public.admin_set_id_reading(p_tenant_id uuid, p_enabled boolean, p_daily_limit integer)
returns void language sql security invoker set search_path = ''
as $$ select private.admin_set_id_reading(p_tenant_id, p_enabled, p_daily_limit); $$;

create function public.id_reading_usage(p_tenant_id uuid)
returns table (this_month integer, last_month integer) language sql security invoker set search_path = ''
as $$ select * from private.id_reading_usage(p_tenant_id); $$;

create function public.dismiss_id_reading_privacy_hint(p_tenant_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.dismiss_id_reading_privacy_hint(p_tenant_id); $$;

create function public.reserve_id_reading(p_tenant_id uuid, p_user_id uuid, p_guest_id uuid, p_place text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.reserve_id_reading(p_tenant_id, p_user_id, p_guest_id, p_place); $$;

create function public.finish_id_reading(p_id uuid, p_outcome text, p_model text, p_input_tokens integer, p_output_tokens integer)
returns void language sql security invoker set search_path = ''
as $$ select private.finish_id_reading(p_id, p_outcome, p_model, p_input_tokens, p_output_tokens); $$;

-- Gast speichern mit Vermerk „Ausweis“ (gleiche Prüfungen wie save_guest; set_config gilt nur in dieser Transaktion)
create function public.save_guest_from_id_document(p_input jsonb)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
begin
  perform set_config('app.source', 'Ausweis', true);
  return private.save_guest(p_input);
end;
$$;

-- Gästeblatt-Feld speichern mit Vermerk „Gästeblatt, aus Ausweis gelesen“
create function public.save_guest_sheet_field_from_id_document(
  p_booking_id uuid, p_target text, p_values jsonb, p_expected_updated_at timestamptz
)
returns timestamptz
language plpgsql security invoker set search_path = ''
as $$
begin
  perform set_config('app.source', 'Gästeblatt, aus Ausweis gelesen', true);
  return private.save_guest_sheet_field(p_booking_id, p_target, p_values, p_expected_updated_at);
end;
$$;

revoke execute on function private.admin_set_id_reading(uuid, boolean, integer) from public, anon;
revoke execute on function private.id_reading_usage(uuid) from public, anon;
revoke execute on function private.dismiss_id_reading_privacy_hint(uuid) from public, anon;
revoke execute on function private.reserve_id_reading(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function private.finish_id_reading(uuid, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.admin_set_id_reading(uuid, boolean, integer) from public, anon;
revoke execute on function public.id_reading_usage(uuid) from public, anon;
revoke execute on function public.dismiss_id_reading_privacy_hint(uuid) from public, anon;
revoke execute on function public.reserve_id_reading(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.finish_id_reading(uuid, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.save_guest_from_id_document(jsonb) from public, anon;
revoke execute on function public.save_guest_sheet_field_from_id_document(uuid, text, jsonb, timestamptz) from public, anon;

grant execute on function private.admin_set_id_reading(uuid, boolean, integer) to authenticated;
grant execute on function private.id_reading_usage(uuid) to authenticated;
grant execute on function private.dismiss_id_reading_privacy_hint(uuid) to authenticated;
grant execute on function public.admin_set_id_reading(uuid, boolean, integer) to authenticated;
grant execute on function public.id_reading_usage(uuid) to authenticated;
grant execute on function public.dismiss_id_reading_privacy_hint(uuid) to authenticated;
grant execute on function public.save_guest_from_id_document(jsonb) to authenticated;
grant execute on function public.save_guest_sheet_field_from_id_document(uuid, text, jsonb, timestamptz) to authenticated;
grant execute on function private.reserve_id_reading(uuid, uuid, uuid, text) to service_role;
grant execute on function private.finish_id_reading(uuid, text, text, integer, integer) to service_role;
grant execute on function public.reserve_id_reading(uuid, uuid, uuid, text) to service_role;
grant execute on function public.finish_id_reading(uuid, text, text, integer, integer) to service_role;
