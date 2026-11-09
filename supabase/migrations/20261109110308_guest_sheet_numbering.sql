-- PROJ-26 Erweiterung (refine 2026-11-09): Kennzahl und Gästeblattnummer je Kunde und Gemeinde.
-- * Kennzahlen: establishment_numbers (je Kunde und Gemeinde, optional), gepflegt in Einstellungen → Stammdaten.
-- * Nummernbereiche: guest_sheet_number_ranges je Kunde und Gemeinde, in der Reihenfolge der Eingabe verbraucht. Der erste
--   offene Bereich ist „in Verwendung“, weitere „folgen“; der Stand wird berechnet, nicht gespeichert.
-- * Nummernregel wie src/lib/guest-sheet-numbering.ts: Text aus Buchstaben, Ziffern, „-“, „/“, „.“ (bis 30 Zeichen), endet mit
--   Ziffern; weitergezählt werden die Ziffern am Ende mit gleicher Stellenzahl (0042 → 0043, 9999 → 10000). Gleich ist eine
--   Nummer ohne Rücksicht auf Groß-/Kleinschreibung, führende Nullen zählen mit.
-- * Vergabe beim „Fertig“: assign_guest_sheet_number (nur Server) sperrt die Bereiche der Gemeinde, überspringt belegte
--   Nummern, springt nach „bis“ in den nächsten Bereich und schreibt die Nummer an die Buchung.
-- * Schalter tenants.guest_sheet_backfill_enabled („Gästeblätter nacherfassen“): Startwert ein bei Kunden mit Nummern oder
--   hochgeladenen Blättern.
-- * save_booking: fehlender Schlüssel guest_sheet_number = unverändert; Doppelt-Prüfung nur in derselben Gemeinde (auch in
--   der Vorschau booking_warnings). register_guest_sheet_upload: Nummer aus der Buchung, nur mit Schalter.
--   save_guest_sheet_field: kein Ziel „booking“ mehr (Lfd.-Nr. auf dem Blatt nur lesen).
-- Fehlercodes: P0982 Stand der Bereiche, P0983 Überschneidung, P0984 ungültiger Bereich, P0985 Bereich gesperrt,
-- P0986 keine Nummer verfügbar, P0987 Hochladen ohne Schalter; P0011/P0016 aus private.lock_tenant; 42501 keine Berechtigung.

-- ---------------------------------------------------------------------------
-- Nummernregel
-- ---------------------------------------------------------------------------
-- Gültige Nummer (Kennzahl: ohne Pflicht der Ziffer am Ende, siehe Tabelle)
create function private.sheet_number_ok(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_value is not null and length(p_value) between 1 and 30 and p_value ~ '^[A-Za-z0-9./-]*[0-9]$';
$$;

-- Vorsatz (vor den Ziffern am Ende)
create function private.sheet_number_prefix(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select substring(p_value from '^(.*?)[0-9]+$');
$$;

-- Ziffern am Ende
create function private.sheet_number_digits(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select substring(p_value from '([0-9]+)$');
$$;

-- Nummer aus Vorsatz, Zahlenwert und Mindest-Stellenzahl (wächst bei Bedarf; lpad würde kürzen)
create function private.sheet_number_format(p_prefix text, p_value numeric, p_width integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select p_prefix || case when length(p_value::text) >= p_width then p_value::text else lpad(p_value::text, p_width, '0') end;
$$;

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------
create table public.establishment_numbers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  municipality_code text not null references public.municipalities (code),
  establishment_number text check (establishment_number is null
    or (length(establishment_number) between 1 and 30 and establishment_number ~ '^[A-Za-z0-9./-]+$')),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (tenant_id, municipality_code)
);
comment on table public.establishment_numbers is 'Kennzahl des Betriebs je Kunde und Gemeinde (PROJ-26); steht auf dem Gästeblatt im Kopf.';
create index establishment_numbers_municipality_idx on public.establishment_numbers (municipality_code);

create table public.guest_sheet_number_ranges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  municipality_code text not null references public.municipalities (code),
  -- Reihenfolge der Eingabe
  position bigint generated always as identity,
  range_from text not null check (private.sheet_number_ok(range_from)),
  range_to text not null check (private.sheet_number_ok(range_to)),
  -- nächste Nummer des Bereichs (null = „von“); nach der Vergabe weitergezählt
  next_number text check (next_number is null or private.sheet_number_ok(next_number)),
  exhausted_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (lower(private.sheet_number_prefix(range_from)) = lower(private.sheet_number_prefix(range_to))),
  check (private.sheet_number_digits(range_from)::numeric <= private.sheet_number_digits(range_to)::numeric)
);
comment on table public.guest_sheet_number_ranges is 'Von der Gemeinde zugeteilte Nummernbereiche der Gästeblätter je Kunde und Gemeinde (PROJ-26).';
create index guest_sheet_number_ranges_lookup_idx on public.guest_sheet_number_ranges (tenant_id, municipality_code, position);
create index guest_sheet_number_ranges_municipality_idx on public.guest_sheet_number_ranges (municipality_code);

alter table public.tenants add column guest_sheet_backfill_enabled boolean not null default false;
comment on column public.tenants.guest_sheet_backfill_enabled is
  'Gästeblätter nacherfassen (PROJ-26): Feld „Gästeblattnummer“ im Buchungsformular und „Gästeblatt hochladen“.';
update public.tenants t set guest_sheet_backfill_enabled = true
where exists (select 1 from public.bookings b where b.tenant_id = t.id and b.guest_sheet_number is not null)
   or exists (select 1 from public.guest_sheets s where s.tenant_id = t.id and s.kind = 'uploaded');

-- Doppelt-Prüfung und Vergabe nutzen den vorhandenen Index bookings_guest_sheet_idx (PROJ-30)

-- ---------------------------------------------------------------------------
-- Rechte: Mitglieder und Admin lesen; geschrieben wird nur über die Funktionen unten
-- ---------------------------------------------------------------------------
revoke all on public.establishment_numbers from anon, authenticated;
revoke all on public.guest_sheet_number_ranges from anon, authenticated;
grant select on public.establishment_numbers to authenticated;
grant select on public.guest_sheet_number_ranges to authenticated;

alter table public.establishment_numbers enable row level security;
alter table public.guest_sheet_number_ranges enable row level security;

create policy "Mitglieder und Admin lesen Kennzahlen" on public.establishment_numbers for select to authenticated
  using (private.is_member(tenant_id) or (select private.is_admin()));
create policy "Mitglieder und Admin lesen Nummernbereiche" on public.guest_sheet_number_ranges for select to authenticated
  using (private.is_member(tenant_id) or (select private.is_admin()));

select private.enable_tenant_table('public.establishment_numbers');
select private.enable_tenant_table('public.guest_sheet_number_ranges');

-- ---------------------------------------------------------------------------
-- Belegte Nummern und freie Nummern eines Bereichs
-- ---------------------------------------------------------------------------
-- Nummern an Buchungen des Kunden in der Gemeinde (Gemeinde des Objekts der Wohnung), ohne p_exclude
create function private.sheet_numbers_used(p_tenant_id uuid, p_code text)
returns table (number text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.guest_sheet_number
  from public.bookings b
  join public.apartments a on a.id = b.apartment_id
  join public.properties p on p.id = a.property_id
  where b.tenant_id = p_tenant_id and p.municipality_code = p_code and b.guest_sheet_number is not null
    and (private.is_member(p_tenant_id) or private.is_admin());
$$;

-- Ein Bereich ab p_start: nächster freier Zahlenwert (null = keiner) und Anzahl belegter Nummern ab p_start.
-- Belegt ist ein Wert, wenn genau seine Schreibweise (Vorsatz, Stellenzahl) an einer Buchung der Gemeinde steht.
create function private.sheet_range_scan(p_tenant_id uuid, p_code text, p_start text, p_to text)
returns table (next_value numeric, used_count bigint, last_used numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with r as (
    select private.sheet_number_prefix(p_start) as prefix, length(private.sheet_number_digits(p_start)) as width,
      private.sheet_number_digits(p_start)::numeric as s, private.sheet_number_digits(p_to)::numeric as e
  ),
  used as (
    select distinct private.sheet_number_digits(u.number)::numeric as v
    from private.sheet_numbers_used(p_tenant_id, p_code) u, r
    where private.sheet_number_ok(u.number)
      and lower(private.sheet_number_prefix(u.number)) = lower(r.prefix)
      and private.sheet_number_digits(u.number)::numeric between r.s and r.e
      and lower(u.number) = lower(private.sheet_number_format(r.prefix, private.sheet_number_digits(u.number)::numeric, r.width))
  )
  select
    (select min(c) from (select r.s as c from r union select v + 1 from used) cand, r
      where c <= r.e and c not in (select v from used)),
    (select count(*) from used),
    (select max(v) from used);
$$;

-- Stand einer Gemeinde: nächste freie Nummer, freie Nummern über alle offenen Bereiche, ob es Bereiche gibt
create function private.sheet_numbering_state(p_tenant_id uuid, p_code text)
returns table (next_number text, free_count numeric, has_ranges boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
  s record;
  v_start text;
begin
  next_number := null;
  free_count := 0;
  has_ranges := false;
  for r in
    select * from public.guest_sheet_number_ranges g
    where g.tenant_id = p_tenant_id and g.municipality_code = p_code
    order by g.position
  loop
    has_ranges := true;
    continue when r.exhausted_at is not null;
    v_start := coalesce(r.next_number, r.range_from);
    continue when private.sheet_number_digits(v_start)::numeric > private.sheet_number_digits(r.range_to)::numeric;
    select * into s from private.sheet_range_scan(p_tenant_id, p_code, v_start, r.range_to);
    free_count := free_count + (private.sheet_number_digits(r.range_to)::numeric - private.sheet_number_digits(v_start)::numeric + 1) - s.used_count;
    if next_number is null and s.next_value is not null then
      next_number := private.sheet_number_format(private.sheet_number_prefix(v_start), s.next_value,
        length(private.sheet_number_digits(v_start)));
    end if;
  end loop;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lesesichten (mit den Rechten der lesenden Person; die Zählung oben läuft als security definer, damit auch der Betreiber
-- belegte Nummern sieht)
-- ---------------------------------------------------------------------------
-- Gemeinden des Kunden mit Objekten bzw. gespeicherter Kennzahl
create view public.establishment_number_list with (security_invoker = true) as
select x.tenant_id, x.municipality_code, m.name as municipality_name, e.establishment_number,
  exists (select 1 from public.properties p where p.tenant_id = x.tenant_id and p.municipality_code = x.municipality_code) as has_properties
from (
  select p.tenant_id, p.municipality_code from public.properties p
  union
  select e.tenant_id, e.municipality_code from public.establishment_numbers e
) x
join public.municipalities m on m.code = x.municipality_code
left join public.establishment_numbers e on e.tenant_id = x.tenant_id and e.municipality_code = x.municipality_code;

-- Nummernstand je Kunde und Gemeinde mit Objekten
create view public.guest_sheet_numbering with (security_invoker = true) as
select g.tenant_id, t.name as tenant_name, g.municipality_code, m.name as municipality_name,
  s.next_number, s.free_count::bigint as free_count, s.has_ranges,
  exists (
    select 1 from public.apartments a join public.properties p on p.id = a.property_id
    where p.tenant_id = g.tenant_id and p.municipality_code = g.municipality_code and a.archived_at is null
  ) as has_apartments
from (select distinct p.tenant_id, p.municipality_code from public.properties p) g
join public.tenants t on t.id = g.tenant_id
join public.municipalities m on m.code = g.municipality_code
cross join lateral private.sheet_numbering_state(g.tenant_id, g.municipality_code) s;

-- Bereiche mit berechnetem Stand; last_issued = höchste belegte Nummer im Bereich in Verwendung (Grenze für „bis“)
create view public.guest_sheet_number_range_list with (security_invoker = true) as
select r.id, r.tenant_id, r.municipality_code, r.position, r.range_from, r.range_to,
  case when o.rn = 1 then coalesce(r.next_number, r.range_from) end as next_number,
  case when r.exhausted_at is not null then 'exhausted' when o.rn = 1 then 'active' else 'queued' end as state,
  r.exhausted_at,
  case when o.rn = 1 then (
    select private.sheet_number_format(private.sheet_number_prefix(r.range_from), s.last_used, length(private.sheet_number_digits(r.range_from)))
    from private.sheet_range_scan(r.tenant_id, r.municipality_code, r.range_from, r.range_to) s
    where s.last_used is not null
  ) end as last_issued,
  r.updated_at
from public.guest_sheet_number_ranges r
left join (
  select g.id, row_number() over (partition by g.tenant_id, g.municipality_code order by g.position) as rn
  from public.guest_sheet_number_ranges g
  where g.exhausted_at is null
) o on o.id = r.id;

grant select on public.establishment_number_list, public.guest_sheet_numbering, public.guest_sheet_number_range_list to authenticated;

-- ---------------------------------------------------------------------------
-- Schreiben: Inhaber des Kunden und Admin mit 2FA
-- ---------------------------------------------------------------------------
create function private.require_guest_sheet_numbering_editor(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_tenant_id is null or not (private.is_admin() or private.has_role(p_tenant_id, 'owner')) then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;
  perform private.lock_tenant(p_tenant_id, true);
end;
$$;

-- Kennzahlen: p_items = [{municipality_code, establishment_number}], leer = keine
create function private.save_establishment_numbers(p_tenant_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_code text;
  v_number text;
begin
  perform private.require_guest_sheet_numbering_editor(p_tenant_id);
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 500 then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_code := v_item ->> 'municipality_code';
    v_number := nullif(btrim(coalesce(v_item ->> 'establishment_number', '')), '');
    if v_code is null or not exists (
      select 1 from public.properties p where p.tenant_id = p_tenant_id and p.municipality_code = v_code
      union all
      select 1 from public.establishment_numbers e where e.tenant_id = p_tenant_id and e.municipality_code = v_code
    ) then
      raise exception 'Ungültige Gemeinde.' using errcode = '22023';
    end if;
    begin
      insert into public.establishment_numbers (tenant_id, municipality_code, establishment_number)
      values (p_tenant_id, v_code, v_number)
      on conflict (tenant_id, municipality_code) do update set establishment_number = excluded.establishment_number
      where public.establishment_numbers.establishment_number is distinct from excluded.establishment_number;
    exception when check_violation then
      raise exception 'Ungültige Kennzahl.' using errcode = '22023';
    end;
  end loop;
end;
$$;

-- Nummernbereich anlegen (id null, hinten angereiht) oder ändern (id + updated_at).
-- p_input: tenant_id, municipality_code, id, updated_at, range_from, range_to, next_number
create function private.save_guest_sheet_number_range(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := nullif(p_input ->> 'tenant_id', '')::uuid;
  v_code text := p_input ->> 'municipality_code';
  v_id uuid := nullif(p_input ->> 'id', '')::uuid;
  v_from text := btrim(coalesce(p_input ->> 'range_from', ''));
  v_to text := btrim(coalesce(p_input ->> 'range_to', ''));
  v_next text := nullif(btrim(coalesce(p_input ->> 'next_number', '')), '');
  v_old public.guest_sheet_number_ranges;
  v_active uuid;
  v_last numeric;
begin
  perform private.require_guest_sheet_numbering_editor(v_tenant);
  if v_code is null or not exists (select 1 from public.properties p where p.tenant_id = v_tenant and p.municipality_code = v_code) then
    raise exception 'Ungültige Gemeinde.' using errcode = 'P0984';
  end if;
  if not private.sheet_number_ok(v_from) or not private.sheet_number_ok(v_to)
      or lower(private.sheet_number_prefix(v_from)) <> lower(private.sheet_number_prefix(v_to))
      or private.sheet_number_digits(v_from)::numeric > private.sheet_number_digits(v_to)::numeric
      or (v_next is not null and (not private.sheet_number_ok(v_next)
        or lower(private.sheet_number_prefix(v_next)) <> lower(private.sheet_number_prefix(v_from))
        or private.sheet_number_digits(v_next)::numeric not between private.sheet_number_digits(v_from)::numeric
          and private.sheet_number_digits(v_to)::numeric)) then
    raise exception 'Ungültiger Nummernbereich.' using errcode = 'P0984';
  end if;

  -- Bereiche der Gemeinde sperren (gleiche Reihenfolge wie die Vergabe)
  perform 1 from public.guest_sheet_number_ranges g
  where g.tenant_id = v_tenant and g.municipality_code = v_code order by g.position for update;
  select g.id into v_active from public.guest_sheet_number_ranges g
  where g.tenant_id = v_tenant and g.municipality_code = v_code and g.exhausted_at is null order by g.position limit 1;

  if v_id is not null then
    select * into v_old from public.guest_sheet_number_ranges g where g.id = v_id and g.tenant_id = v_tenant and g.municipality_code = v_code;
    if v_old.id is null or v_old.updated_at is distinct from (p_input ->> 'updated_at')::timestamptz then
      raise exception 'Die Nummernbereiche wurden inzwischen geändert.' using errcode = 'P0982';
    end if;
    if v_old.exhausted_at is not null then
      raise exception 'Der Bereich ist aufgebraucht.' using errcode = 'P0985';
    end if;
  end if;

  -- keine Überschneidung mit anderen Bereichen derselben Gemeinde (gleicher Vorsatz)
  if exists (
    select 1 from public.guest_sheet_number_ranges g
    where g.tenant_id = v_tenant and g.municipality_code = v_code and g.id is distinct from v_id
      and lower(private.sheet_number_prefix(g.range_from)) = lower(private.sheet_number_prefix(v_from))
      and private.sheet_number_digits(v_from)::numeric <= private.sheet_number_digits(g.range_to)::numeric
      and private.sheet_number_digits(g.range_from)::numeric <= private.sheet_number_digits(v_to)::numeric
  ) then
    raise exception 'Der Bereich überschneidet sich mit einem anderen Bereich.' using errcode = 'P0983';
  end if;

  if v_id is null then
    insert into public.guest_sheet_number_ranges (tenant_id, municipality_code, range_from, range_to, next_number)
    -- „Nächste Nummer“ nur, wenn der neue Bereich sofort verwendet wird
    values (v_tenant, v_code, v_from, v_to, case when v_active is null then v_next end)
    returning id into v_id;
    return v_id;
  end if;

  if v_id = v_active then
    -- In Verwendung: „von“ bleibt, „bis“ nicht unter die höchste belegte Nummer
    if lower(v_from) <> lower(v_old.range_from) then
      raise exception '„von“ ist nicht mehr änderbar.' using errcode = 'P0985';
    end if;
    select s.last_used into v_last from private.sheet_range_scan(v_tenant, v_code, v_old.range_from, v_old.range_to) s;
    if v_last is not null and private.sheet_number_digits(v_to)::numeric < v_last then
      raise exception '„bis“ liegt unter der zuletzt vergebenen Nummer.' using errcode = 'P0984';
    end if;
    update public.guest_sheet_number_ranges set range_to = v_to, next_number = coalesce(v_next, next_number) where id = v_id;
  else
    update public.guest_sheet_number_ranges set range_from = v_from, range_to = v_to, next_number = null where id = v_id;
  end if;
  return v_id;
end;
$$;

-- Nur folgende Bereiche (offen, nicht in Verwendung) lassen sich löschen
create function private.delete_guest_sheet_number_range(p_id uuid, p_expected_updated_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.guest_sheet_number_ranges;
  v_active uuid;
begin
  select * into v_old from public.guest_sheet_number_ranges where id = p_id;
  if v_old.id is null then
    raise exception 'Die Nummernbereiche wurden inzwischen geändert.' using errcode = 'P0982';
  end if;
  perform private.require_guest_sheet_numbering_editor(v_old.tenant_id);
  perform 1 from public.guest_sheet_number_ranges g
  where g.tenant_id = v_old.tenant_id and g.municipality_code = v_old.municipality_code order by g.position for update;
  select * into v_old from public.guest_sheet_number_ranges where id = p_id;
  if v_old.id is null or v_old.updated_at is distinct from p_expected_updated_at then
    raise exception 'Die Nummernbereiche wurden inzwischen geändert.' using errcode = 'P0982';
  end if;
  select g.id into v_active from public.guest_sheet_number_ranges g
  where g.tenant_id = v_old.tenant_id and g.municipality_code = v_old.municipality_code and g.exhausted_at is null
  order by g.position limit 1;
  if v_old.exhausted_at is not null or v_old.id = v_active then
    raise exception 'Dieser Bereich lässt sich nicht löschen.' using errcode = 'P0985';
  end if;
  delete from public.guest_sheet_number_ranges where id = p_id;
end;
$$;

-- Schalter „Gästeblätter nacherfassen“
create function private.save_guest_sheet_backfill(p_tenant_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_guest_sheet_numbering_editor(p_tenant_id);
  if p_enabled is null then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;
  update public.tenants set guest_sheet_backfill_enabled = p_enabled
  where id = p_tenant_id and guest_sheet_backfill_enabled is distinct from p_enabled;
end;
$$;

create function public.save_establishment_numbers(p_tenant_id uuid, p_items jsonb)
returns void language sql security invoker set search_path = ''
as $$ select private.save_establishment_numbers(p_tenant_id, p_items); $$;

create function public.save_guest_sheet_number_range(p_input jsonb)
returns uuid language sql security invoker set search_path = ''
as $$ select private.save_guest_sheet_number_range(p_input); $$;

create function public.delete_guest_sheet_number_range(p_id uuid, p_expected_updated_at timestamptz)
returns void language sql security invoker set search_path = ''
as $$ select private.delete_guest_sheet_number_range(p_id, p_expected_updated_at); $$;

create function public.save_guest_sheet_backfill(p_tenant_id uuid, p_enabled boolean)
returns void language sql security invoker set search_path = ''
as $$ select private.save_guest_sheet_backfill(p_tenant_id, p_enabled); $$;

-- ---------------------------------------------------------------------------
-- Vergabe beim „Fertig“ (nur der Server, im Namen der Person). Hat die Buchung schon eine Nummer, bleibt sie.
-- Ergebnis: {sheet_number, updated_at}
-- ---------------------------------------------------------------------------
create function public.assign_guest_sheet_number(p_booking_id uuid, p_actor_id uuid, p_expected_updated_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_code text;
  r record;
  v_value numeric;
  v_start text;
  v_number text;
  v_updated timestamptz;
begin
  if p_actor_id is null or p_booking_id is null then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_actor_id, 'role', 'authenticated')::text, true);
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null or not private.is_member(v_booking.tenant_id) then
    raise exception 'Buchung nicht gefunden.' using errcode = '42501';
  end if;
  if exists (select 1 from public.tenants t where t.id = v_booking.tenant_id and t.status = 'deactivated') then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  if v_booking.updated_at is distinct from p_expected_updated_at then
    raise exception 'Die Buchung wurde inzwischen geändert.' using errcode = 'P0975';
  end if;
  if v_booking.guest_sheet_number is not null then
    return jsonb_build_object('sheet_number', v_booking.guest_sheet_number, 'updated_at', v_booking.updated_at);
  end if;
  if not private.guest_sheet_expected(v_booking) then
    raise exception 'Für diese Buchung ist kein Gästeblatt vorgesehen.' using errcode = 'P0976';
  end if;
  select p.municipality_code into v_code
  from public.apartments a join public.properties p on p.id = a.property_id where a.id = v_booking.apartment_id;

  -- Bereiche der Gemeinde sperren: zwei Tablets bekommen nie dieselbe Nummer
  for r in
    select * from public.guest_sheet_number_ranges g
    where g.tenant_id = v_booking.tenant_id and g.municipality_code = v_code and g.exhausted_at is null
    order by g.position
    for update
  loop
    v_start := coalesce(r.next_number, r.range_from);
    v_value := null;
    if private.sheet_number_digits(v_start)::numeric <= private.sheet_number_digits(r.range_to)::numeric then
      select x.next_value into v_value from private.sheet_range_scan(v_booking.tenant_id, v_code, v_start, r.range_to) x;
    end if;
    if v_value is null then
      update public.guest_sheet_number_ranges set exhausted_at = now(), next_number = null where id = r.id;
      continue;
    end if;
    v_number := private.sheet_number_format(private.sheet_number_prefix(v_start), v_value, length(private.sheet_number_digits(v_start)));
    if v_value >= private.sheet_number_digits(r.range_to)::numeric then
      update public.guest_sheet_number_ranges set exhausted_at = now(), next_number = null where id = r.id;
    else
      update public.guest_sheet_number_ranges
      set next_number = private.sheet_number_format(private.sheet_number_prefix(v_start), v_value + 1, length(private.sheet_number_digits(v_start)))
      where id = r.id;
    end if;
    -- Im Änderungsprotokoll als „Gästeblatt“ vermerkt
    perform set_config('app.source', 'Gästeblatt', true);
    update public.bookings set guest_sheet_number = v_number where id = v_booking.id returning updated_at into v_updated;
    return jsonb_build_object('sheet_number', v_number, 'updated_at', v_updated);
  end loop;
  raise exception 'Keine Gästeblattnummer verfügbar.' using errcode = 'P0986';
end;
$$;

-- ---------------------------------------------------------------------------
-- Doppelte Gästeblattnummer: nur in derselben Gemeinde wie die Wohnung (neue Fassung mit Wohnung)
-- ---------------------------------------------------------------------------
create function private.guest_sheet_duplicates(p_tenant_id uuid, p_number text, p_exclude uuid, p_apartment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_key text := lower(nullif(btrim(p_number), ''));
  v_code text;
begin
  select p.municipality_code into v_code
  from public.apartments a join public.properties p on p.id = a.property_id
  where a.id = p_apartment_id and a.tenant_id = p_tenant_id;
  if v_key is null or v_code is null or exists (
    select 1 from public.bookings e
    where e.id = p_exclude and e.tenant_id = p_tenant_id and lower(e.guest_sheet_number) = v_key
  ) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', b.id,
      'kind', b.kind,
      'number', b.number,
      'guest_name', case when g.id is null then null else concat_ws(', ', g.last_name,
        nullif(concat_ws(' ', g.title_prefix, g.first_name), ''), g.title_suffix) end,
      'cancelled', b.cancelled_at is not null
    ) order by b.arrival desc)
    from public.bookings b
    join public.apartments a on a.id = b.apartment_id
    join public.properties p on p.id = a.property_id
    left join public.guests g on g.id = b.guest_id
    where b.tenant_id = p_tenant_id
      and p.municipality_code = v_code
      and lower(b.guest_sheet_number) = v_key
      and b.id is distinct from p_exclude
  ), '[]'::jsonb);
end;
$$;

create or replace function private.booking_warnings(
  p_tenant_id uuid,
  p_apartment_id uuid,
  p_arrival date,
  p_departure date,
  p_persons integer,
  p_adults integer,
  p_exclude uuid,
  p_guest_sheet_number text,
  p_source text,
  p_platform_number text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_duplicates jsonb;
  v_platform jsonb;
begin
  if not private.is_member(p_tenant_id) then
    raise exception 'Keine Berechtigung.' using errcode = 'P0801';
  end if;
  v_duplicates := private.guest_sheet_duplicates(p_tenant_id, p_guest_sheet_number, p_exclude, p_apartment_id);
  v_platform := private.platform_number_duplicate(p_tenant_id, p_source, p_platform_number, p_exclude);
  if p_arrival is null or p_departure is null or p_departure <= p_arrival then
    return jsonb_build_object('conflicts', '[]'::jsonb, 'over_capacity', null, 'guest_sheet_duplicates', v_duplicates,
      'platform_number_duplicate', v_platform);
  end if;
  return private.booking_warnings_for(p_tenant_id, p_apartment_id, p_arrival, p_departure, p_persons, p_adults, p_exclude)
    || jsonb_build_object('guest_sheet_duplicates', v_duplicates, 'platform_number_duplicate', v_platform);
end;
$$;

-- ---------------------------------------------------------------------------
-- Buchung speichern: fehlender Schlüssel guest_sheet_number = unverändert, Doppelt-Prüfung je Gemeinde
-- (sonst unverändert gegenüber 20261108164726_company_list.sql)
-- ---------------------------------------------------------------------------
create or replace function private.save_booking(p_input jsonb, p_confirm boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tenant uuid := (p_input ->> 'tenant_id')::uuid;
  v_id uuid := nullif(p_input ->> 'id', '')::uuid;
  v_apartment_id uuid := nullif(p_input ->> 'apartment_id', '')::uuid;
  v_arrival date := (p_input ->> 'arrival')::date;
  -- PROJ-30: departure = tatsächliche Abreise (Belegung), planned_departure = vereinbarte (Preis)
  v_departure date := (p_input ->> 'departure')::date;
  v_planned date := (p_input ->> 'planned_departure')::date;
  v_sheet text := nullif(btrim(p_input ->> 'guest_sheet_number'), '');
  -- PROJ-26 (2026-11-09): ohne Schlüssel bleibt die Nummer unverändert (Schalter „Gästeblätter nacherfassen“ aus)
  v_sheet_given boolean := p_input ? 'guest_sheet_number';
  v_source text := coalesce(p_input ->> 'source', 'none');
  v_source_custom text := case when coalesce(p_input ->> 'source', 'none') = 'custom' then nullif(btrim(p_input ->> 'source_custom'), '') end;
  -- PROJ-47: Plattform-Nummer nur bei booking.com/Airbnb, alle Leerzeichen entfernt; sonst gelöscht
  v_platform text := case when coalesce(p_input ->> 'source', 'none') in ('booking_com', 'airbnb')
    then nullif(regexp_replace(coalesce(p_input ->> 'platform_number', ''), '\s', '', 'g'), '') end;
  v_residence boolean := coalesce((p_input ->> 'residence_registered')::boolean, false);
  -- PROJ-15: Ortstaxe – Häkchen (alle Mitglieder), Zustand und Neuberechnung (nur Inhaber)
  v_main_exempt boolean := coalesce((p_input ->> 'main_guest_tourist_tax_exempt')::boolean, false);
  v_mode_in text := nullif(p_input ->> 'tourist_tax_mode', '');
  v_recalc boolean := coalesce((p_input ->> 'tourist_tax_recalculate')::boolean, false);
  v_mode text;
  v_basis jsonb;
  v_tax_rows jsonb;
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
  if v_mode_in is not null and v_mode_in not in ('pending', 'auto', 'manual') then
    raise exception 'Ungültiger Ortstaxe-Zustand.' using errcode = '22023';
  end if;
  v_recalc := v_recalc and v_owner;
  if v_platform is not null and v_platform !~ '^[A-Za-z0-9-]{1,30}$' then
    raise exception 'Ungültige Plattform-Nummer.' using errcode = 'P0807';
  end if;

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
    -- Ortstaxe (PROJ-15): Berechnungsgrundlage und Abgabe-Positionen vor dem Speichern. Zustand nur vom Inhaber;
    -- zurück auf „noch nicht berechnet“ geht nicht; aus „noch nicht berechnet“ nach „automatisch“ nur mit Neuberechnung
    v_basis := private.tourist_tax_basis(v_id);
    v_tax_rows := private.tourist_tax_rows(v_id);
    v_mode := case
      when not v_owner or v_mode_in is null then v_old.tourist_tax_mode
      when v_mode_in = 'pending' then v_old.tourist_tax_mode
      else v_mode_in
    end;
    if v_old.tourist_tax_mode = 'pending' and v_mode = 'auto' then
      v_recalc := true;
    end if;
  else
    -- Neue Buchungen rechnen automatisch; „von Hand“ nur vom Inhaber
    v_mode := case when v_owner and v_mode_in = 'manual' then 'manual' else 'auto' end;
    v_kind := p_input ->> 'kind';
    if v_kind is null or v_kind not in ('booking', 'option') then
      raise exception 'Ungültige Art.' using errcode = 'P0807';
    end if;
    perform private.lock_apartment(v_apartment_id);
  end if;
  if not v_sheet_given then
    v_sheet := v_old.guest_sheet_number;
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
  -- PROJ-26 (2026-11-09): nur in derselben Gemeinde und nur bei eingegebener Nummer
  v_duplicates := case when v_sheet_given then private.guest_sheet_duplicates(v_tenant, v_sheet, v_id, v_apartment.id) else '[]'::jsonb end;
  if (v_override and not (v_owner and coalesce(p_confirm, false)))
      or (jsonb_array_length(v_duplicates) > 0 and not coalesce((p_input ->> 'confirm_guest_sheet_number')::boolean, false)) then
    return jsonb_build_object('status', 'warnings', 'warnings', v_warnings || jsonb_build_object('guest_sheet_duplicates', v_duplicates));
  end if;

  -- Neuer Gast entsteht im selben Vorgang (auch für Mitarbeiter, Entscheidung PROJ-7)
  if v_new_guest is not null then
    insert into public.guests (
      tenant_id, last_name, first_name, country, email, phone, language, birth_date, street, postal_code, city,
      address_country, marketing_source, marketing_custom, company_id, note,
      title_prefix, title_suffix, gender, document_type, document_number, document_issued_on, document_authority,
      document_country, document_front_path, document_back_path
    ) values (
      v_tenant, v_new_guest ->> 'last_name', v_new_guest ->> 'first_name', v_new_guest ->> 'country',
      v_new_guest ->> 'email', v_new_guest ->> 'phone', v_new_guest ->> 'language',
      (v_new_guest ->> 'birth_date')::date, v_new_guest ->> 'street', v_new_guest ->> 'postal_code',
      v_new_guest ->> 'city', v_new_guest ->> 'address_country', v_new_guest ->> 'marketing_source',
      -- PROJ-50: bestehende Firma (company_id) oder neue Firma (new_company) im selben Vorgang
      v_new_guest ->> 'marketing_custom', private.guest_company_from_input(v_tenant, v_new_guest),
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
      platform_number, note, override_at, override_by, price_review, tourist_tax_mode, main_guest_tourist_tax_exempt
    ) values (
      v_tenant, v_apartment.id, v_kind, extract(year from v_arrival)::integer, v_seq, v_arrival, v_planned, v_departure,
      -- ohne Angabe die Zeiten der Wohnung
      coalesce((p_input ->> 'check_in')::time, v_apartment.check_in),
      coalesce((p_input ->> 'check_out')::time, v_apartment.check_out),
      v_guest_id, v_adults, v_child_ages, v_option_until, v_sheet, v_residence, v_source, v_source_custom,
      v_platform, nullif(btrim(p_input ->> 'note'), ''),
      case when v_override then now() end, case when v_override then auth.uid() end,
      -- Mitarbeiter-Buchung ohne Preis der Wohnung: Inhaber soll den Preis setzen
      not v_owner and private.suggested_nights_cents(v_apartment, v_adults, v_child_ages, v_planned - v_arrival) is null,
      v_mode, v_main_exempt
    ) returning id into v_id;

    if v_owner then
      -- Umsatzsteuersätze Pflicht, als exakte Dezimalzahl geprüft (PROJ-35)
      insert into public.booking_amounts (id, tenant_id, nights_cents, nights_vat_rate, nights_extension_pricing)
      values (v_id, v_tenant, (v_amounts ->> 'nights_cents')::integer, private.vat_rate(v_amounts ->> 'nights_vat_rate'),
        coalesce(v_pricing, 'total'));
      insert into public.booking_charges (tenant_id, booking_id, position, label, amount_cents, vat_rate,
        tourist_tax, tourist_tax_rate_id, tax_person_nights)
      select v_tenant, v_id, c.ord, btrim(c.value ->> 'label'), (c.value ->> 'amount_cents')::integer, private.vat_rate(c.value ->> 'vat_rate'),
        t.tourist_tax, t.rate_id, t.person_nights
      from jsonb_array_elements(coalesce(v_amounts -> 'charges', '[]'::jsonb)) with ordinality as c(value, ord)
      cross join lateral private.tourist_tax_mark(v_tenant, c.value -> 'tourist_tax') t;
    else
      -- Preisvorschlag für Mitarbeiter je nach Preisart der Wohnung (PROJ-27) und Reinigungsgebühr
      -- Vorschlag für den geplanten Zeitraum (PROJ-30)
      v_suggested := private.suggested_nights_cents(v_apartment, v_adults, v_child_ages, v_planned - v_arrival);
      insert into public.booking_amounts (id, tenant_id, nights_cents)
      values (v_id, v_tenant, coalesce(v_suggested, 0));
      if v_apartment.cleaning_fee_cents is not null then
        -- Endreinigung 10 % (PROJ-35; Bezeichnung seit PROJ-8 refine 2026-11-05); die Übernachtung erhält den Standard 10 %
        insert into public.booking_charges (tenant_id, booking_id, position, label, amount_cents, vat_rate)
        values (v_tenant, v_id, 1, 'Endreinigung', v_apartment.cleaning_fee_cents, 10.00);
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
      main_guest_tourist_tax_exempt = v_main_exempt,
      tourist_tax_mode = v_mode,
      source = v_source,
      source_custom = v_source_custom,
      platform_number = v_platform,
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
        vat_rate = private.vat_rate(e -> 'value' ->> 'vat_rate'),
        tourist_tax = t.tourist_tax,
        tourist_tax_rate_id = t.rate_id,
        tax_person_nights = t.person_nights
      from jsonb_array_elements(v_charges) e
      cross join lateral private.tourist_tax_mark(v_tenant, e -> 'value' -> 'tourist_tax') t
      where bc.booking_id = v_id and bc.id = private.json_uuid(e ->> 'id')
        and (bc.position, bc.label, bc.amount_cents, bc.vat_rate, bc.tourist_tax, bc.tourist_tax_rate_id, bc.tax_person_nights)
          is distinct from (
          (e ->> 'ord')::integer, btrim(e -> 'value' ->> 'label'), (e -> 'value' ->> 'amount_cents')::integer,
          private.vat_rate(e -> 'value' ->> 'vat_rate'), t.tourist_tax, t.rate_id, t.person_nights
        );

      insert into public.booking_charges (tenant_id, booking_id, position, label, amount_cents, vat_rate,
        tourist_tax, tourist_tax_rate_id, tax_person_nights)
      select v_tenant, v_id, (e ->> 'ord')::integer, btrim(e -> 'value' ->> 'label'), (e -> 'value' ->> 'amount_cents')::integer,
        private.vat_rate(e -> 'value' ->> 'vat_rate'), t.tourist_tax, t.rate_id, t.person_nights
      from jsonb_array_elements(v_charges) e
      cross join lateral private.tourist_tax_mark(v_tenant, e -> 'value' -> 'tourist_tax') t
      where private.json_uuid(e ->> 'id') is null;
    end if;
  end if;

  -- Abgerechneter Übernachtungspreis nach jedem Speichern, für Inhaber und Mitarbeiter (PROJ-30)
  perform private.refresh_billed_nights(v_id);

  -- Ortstaxe (PROJ-15). „Automatisch“: neu rechnen bei neuer Buchung, „Abgabe (neu) berechnen“, geänderter
  -- Berechnungsgrundlage oder veränderten Abgabe-Positionen (gesendete Beträge werden so nie übernommen).
  -- Tarifänderungen allein ziehen nicht nach. „Von Hand“: Mitarbeiter-Änderung der Grundlage → „Preis prüfen“.
  if v_mode = 'auto' and (v_old.id is null or v_recalc
      or private.tourist_tax_basis(v_id) is distinct from v_basis
      or private.tourist_tax_rows(v_id) is distinct from v_tax_rows) then
    perform private.apply_tourist_tax(v_id);
  elsif v_mode = 'manual' and v_old.id is not null and not v_owner and private.tourist_tax_basis(v_id) is distinct from v_basis then
    update public.bookings set price_review = true where id = v_id;
  end if;

  return jsonb_build_object('status', 'saved', 'id', v_id);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Seite 1: ohne Ziel „booking“ (Lfd.-Nr. nur lesen; sonst unverändert gegenüber 20261109081035_guest_sheets_email_images.sql)
-- ---------------------------------------------------------------------------
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
-- Hochladen: Nummer aus der Buchung, nur mit Schalter (sonst unverändert gegenüber 20261109055811_guest_sheets.sql)
-- p_input: booking_id, pdf_path, signed_on, marketing_consent, previous_sheet_id
-- ---------------------------------------------------------------------------
create or replace function private.register_guest_sheet_upload(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_guest public.guests;
  v_path text := p_input ->> 'pdf_path';
  v_number text;
  v_signed_on date;
  v_consent boolean := coalesce((p_input ->> 'marketing_consent')::boolean, false);
  v_previous uuid := nullif(p_input ->> 'previous_sheet_id', '')::uuid;
  v_current uuid;
  v_id uuid;
begin
  begin
    v_signed_on := nullif(p_input ->> 'signed_on', '')::date;
  exception when others then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end;
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  select * into v_booking from public.bookings where id = (p_input ->> 'booking_id')::uuid for update;
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
  -- PROJ-26 (2026-11-09): nur mit „Gästeblätter nacherfassen“; die Lfd.-Nr. kommt aus der Buchung
  if not exists (select 1 from public.tenants t where t.id = v_booking.tenant_id and t.guest_sheet_backfill_enabled) then
    raise exception 'Hochladen ist nur mit „Gästeblätter nacherfassen“ möglich.' using errcode = 'P0987';
  end if;
  v_number := v_booking.guest_sheet_number;
  if (v_signed_on is not null and (v_signed_on > private.today_vienna() or v_signed_on < date '1900-01-01')) then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;
  if v_path is null or v_path !~ '\.pdf$' or private.guest_sheet_file_tenant(v_path) is distinct from v_booking.tenant_id
      or not exists (select 1 from storage.objects o where o.bucket_id = 'guest-sheets' and o.name = v_path)
      or exists (select 1 from public.guest_sheets s where s.pdf_path = v_path) then
    raise exception 'Die Datei wurde nicht gefunden.' using errcode = 'P0980';
  end if;
  select id into v_current from public.guest_sheets where booking_id = v_booking.id and replaced_at is null;
  if v_current is distinct from v_previous then
    raise exception 'Für diese Buchung wurde inzwischen ein Gästeblatt gespeichert.' using errcode = 'P0973';
  end if;
  if v_booking.guest_id is not null then
    select * into v_guest from public.guests where id = v_booking.guest_id;
  end if;
  -- Marketing nur mit verknüpftem, nicht anonymisiertem Gast
  v_consent := v_consent and v_guest.id is not null and v_guest.anonymized_at is null;

  v_id := gen_random_uuid();
  if v_current is not null then
    update public.guest_sheets set replaced_at = now() where id = v_current;
  end if;
  insert into public.guest_sheets (id, tenant_id, booking_id, guest_id, kind, sheet_number, marketing_consent, pdf_path, signed_on)
  values (v_id, v_booking.tenant_id, v_booking.id, v_guest.id, 'uploaded', v_number, v_consent, v_path, v_signed_on);
  if v_current is not null then
    update public.guest_sheets set replaced_by = v_id where id = v_current;
  end if;
  if v_consent then
    perform private.note_marketing_consent(v_guest.id, coalesce(v_signed_on::timestamp at time zone 'Europe/Vienna', now()), v_id);
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte der Funktionen
-- ---------------------------------------------------------------------------
revoke execute on function private.sheet_number_ok(text) from public, anon;
revoke execute on function private.sheet_number_prefix(text) from public, anon;
revoke execute on function private.sheet_number_digits(text) from public, anon;
revoke execute on function private.sheet_number_format(text, numeric, integer) from public, anon;
revoke execute on function private.sheet_numbers_used(uuid, text) from public, anon;
revoke execute on function private.sheet_range_scan(uuid, text, text, text) from public, anon;
revoke execute on function private.sheet_numbering_state(uuid, text) from public, anon;
revoke execute on function private.require_guest_sheet_numbering_editor(uuid) from public, anon, authenticated;
revoke execute on function private.save_establishment_numbers(uuid, jsonb) from public, anon;
revoke execute on function private.save_guest_sheet_number_range(jsonb) from public, anon;
revoke execute on function private.delete_guest_sheet_number_range(uuid, timestamptz) from public, anon;
revoke execute on function private.save_guest_sheet_backfill(uuid, boolean) from public, anon;
revoke execute on function public.save_establishment_numbers(uuid, jsonb) from public, anon;
revoke execute on function public.save_guest_sheet_number_range(jsonb) from public, anon;
revoke execute on function public.delete_guest_sheet_number_range(uuid, timestamptz) from public, anon;
revoke execute on function public.save_guest_sheet_backfill(uuid, boolean) from public, anon;
revoke execute on function public.assign_guest_sheet_number(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function private.guest_sheet_duplicates(uuid, text, uuid, uuid) from public, anon, authenticated;

-- Lesesichten laufen mit den Rechten der lesenden Person
grant execute on function private.sheet_number_ok(text) to authenticated, service_role;
grant execute on function private.sheet_number_prefix(text) to authenticated, service_role;
grant execute on function private.sheet_number_digits(text) to authenticated, service_role;
grant execute on function private.sheet_number_format(text, numeric, integer) to authenticated, service_role;
grant execute on function private.sheet_numbers_used(uuid, text) to authenticated, service_role;
grant execute on function private.sheet_range_scan(uuid, text, text, text) to authenticated, service_role;
grant execute on function private.sheet_numbering_state(uuid, text) to authenticated, service_role;
grant execute on function private.save_establishment_numbers(uuid, jsonb) to authenticated;
grant execute on function private.save_guest_sheet_number_range(jsonb) to authenticated;
grant execute on function private.delete_guest_sheet_number_range(uuid, timestamptz) to authenticated;
grant execute on function private.save_guest_sheet_backfill(uuid, boolean) to authenticated;
grant execute on function public.save_establishment_numbers(uuid, jsonb) to authenticated;
grant execute on function public.save_guest_sheet_number_range(jsonb) to authenticated;
grant execute on function public.delete_guest_sheet_number_range(uuid, timestamptz) to authenticated;
grant execute on function public.save_guest_sheet_backfill(uuid, boolean) to authenticated;
grant execute on function public.assign_guest_sheet_number(uuid, uuid, timestamptz) to service_role;

-- alte Fassung ohne Wohnung wird nicht mehr verwendet
drop function private.guest_sheet_duplicates(uuid, text, uuid);
