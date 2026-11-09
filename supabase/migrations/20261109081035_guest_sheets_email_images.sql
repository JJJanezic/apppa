-- PROJ-26 Nachbesserung nach dem Deploy: Auf dem Gästeblatt lassen sich auch die Ausweisbilder (wenn noch keine hinterlegt
-- sind) und auf Seite 2 die E-Mail-Adresse des Gastes speichern (nur, solange er keine hat). Sonst unverändert gegenüber
-- 20261109055811_guest_sheets.sql. Rechte bleiben wie dort vergeben.

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
  if p_values is null or jsonb_typeof(p_values) <> 'object' or p_target not in ('guest', 'booking', 'companions') then
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
  -- Im Änderungsprotokoll als „Gästeblatt“ vermerkt
  perform set_config('app.source', 'Gästeblatt', true);

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

  if p_target = 'booking' then
    if exists (select 1 from jsonb_object_keys(p_values) k where k <> 'guest_sheet_number') then
      raise exception 'Ungültige Eingabe.' using errcode = '22023';
    end if;
    begin
      update public.bookings set guest_sheet_number = nullif(btrim(v ->> 'guest_sheet_number'), '')
      where id = p_booking_id
      returning updated_at into v_updated;
    exception when check_violation then
      raise exception 'Ungültige Eingabe.' using errcode = '22023';
    end;
    return v_updated;
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
