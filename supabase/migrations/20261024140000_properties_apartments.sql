-- PROJ-6: Objekte und Wohnungen, Gemeindeliste
--
-- * Gemeinden + PLZ-Zuordnung: für alle Kunden gemeinsam, nur lesbar (Daten: eigene Migration aus der
--   Gemeindeliste von Statistik Austria, CC BY 4.0, siehe supabase/data/statistik-austria/README.md)
-- * Objekte (Haus mit Adresse und Gemeinde) und Wohnungen je Kunde, Muster aus PROJ-1:
--   Lesen für Mitglieder (und den Admin), Schreiben nur für Inhaber; Standardfelder + Änderungsprotokoll
-- * Eine Wohnung gehört immer zu einem Objekt desselben Kunden (zusammengesetzter Fremdschlüssel);
--   ein Objekt mit Wohnungen lässt sich nicht löschen (Prüfung am Ende der Anweisung, damit das
--   Löschen eines ganzen Kunden – PROJ-5 – weiterhin in einem Zug funktioniert)

-- ---------------------------------------------------------------------------
-- Gemeinden
-- ---------------------------------------------------------------------------
create table public.municipalities (
  code text primary key check (code ~ '^[1-9][0-9]{4}$'),
  name text not null check (length(btrim(name)) between 1 and 100),
  state text not null check (state in (
    'burgenland', 'kaernten', 'niederoesterreich', 'oberoesterreich', 'salzburg',
    'steiermark', 'tirol', 'vorarlberg', 'wien'
  )),
  -- vereinheitlicht (src/lib/apartments.ts → municipalitySearchKey): Kleinbuchstaben, Umlaute ausgeschrieben, St. = Sankt
  search_key text not null,
  -- aufgelöste Gemeinden bleiben für bestehende Zuordnungen erhalten
  valid_until date,
  successor_code text references public.municipalities (code)
);
comment on table public.municipalities is 'Österreichische Gemeinden (Statistik Austria, CC BY 4.0). Nur lesbar; Pflege per Migration (Runbook).';

create table public.municipality_postal_codes (
  postal_code text not null check (postal_code ~ '^[0-9]{4}$'),
  municipality_code text not null references public.municipalities (code) on delete cascade,
  primary key (postal_code, municipality_code)
);
comment on table public.municipality_postal_codes is 'PLZ ↔ Gemeinde (viele zu viele), aus der Gemeindeliste von Statistik Austria.';

create index municipality_postal_codes_municipality_idx on public.municipality_postal_codes (municipality_code);

revoke all on public.municipalities, public.municipality_postal_codes from anon, authenticated;
grant select on public.municipalities, public.municipality_postal_codes to authenticated;

alter table public.municipalities enable row level security;
alter table public.municipality_postal_codes enable row level security;

create policy "Angemeldete lesen Gemeinden"
  on public.municipalities for select to authenticated using (true);
create policy "Angemeldete lesen PLZ-Zuordnungen"
  on public.municipality_postal_codes for select to authenticated using (true);
-- INSERT/UPDATE/DELETE: keine Policy und keine Rechte → nur per Migration

-- ---------------------------------------------------------------------------
-- Objekte
-- ---------------------------------------------------------------------------
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (name = btrim(name) and length(name) between 1 and 100),
  street text not null check (length(btrim(street)) between 1 and 200),
  postal_code text not null check (postal_code ~ '^[0-9]{4}$'),
  city text not null check (length(btrim(city)) between 1 and 100),
  municipality_code text not null references public.municipalities (code),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  -- Ziel des zusammengesetzten Fremdschlüssels der Wohnungen (gleicher Kunde)
  constraint properties_id_tenant_key unique (id, tenant_id)
);
comment on table public.properties is 'Objekte (Haus mit Adresse und Gemeinde) je Kunde (PROJ-6).';

create unique index properties_tenant_name_key on public.properties (tenant_id, lower(name));
create index properties_municipality_idx on public.properties (municipality_code);

-- ---------------------------------------------------------------------------
-- Wohnungen
-- ---------------------------------------------------------------------------
create table public.apartments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  property_id uuid not null,
  name text not null check (name = btrim(name) and length(name) between 1 and 100),
  max_guests integer not null check (max_guests between 1 and 50),
  kind text not null default 'holiday' check (kind in ('holiday', 'service')),
  -- Standardpreis pro Nacht in Cent; leer = keiner
  price_cents integer check (price_cents between 0 and 1000000),
  check_in time not null default '15:00',
  check_out time not null default '10:00',
  note text check (note is null or length(note) <= 2000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  -- gleicher Kunde wie das Objekt; NO ACTION (Prüfung am Ende der Anweisung) statt RESTRICT, damit das
  -- Löschen eines Kunden Objekte und Wohnungen gemeinsam entfernen kann
  constraint apartments_property_fkey foreign key (property_id, tenant_id)
    references public.properties (id, tenant_id)
);
comment on table public.apartments is 'Wohnungen je Objekt (PROJ-6). Archivieren statt Löschen, sobald Buchungen existieren (PROJ-8).';

create unique index apartments_property_name_key on public.apartments (property_id, lower(name));
create index apartments_tenant_idx on public.apartments (tenant_id);

-- ---------------------------------------------------------------------------
-- Rechte und Abschottung (Muster PROJ-1)
-- ---------------------------------------------------------------------------
revoke all on public.properties, public.apartments from anon, authenticated;
grant select, delete on public.properties, public.apartments to authenticated;
grant insert (tenant_id, name, street, postal_code, city, municipality_code) on public.properties to authenticated;
grant update (name, street, postal_code, city, municipality_code) on public.properties to authenticated;
grant insert (tenant_id, property_id, name, max_guests, kind, price_cents, check_in, check_out, note) on public.apartments to authenticated;
grant update (property_id, name, max_guests, kind, price_cents, check_in, check_out, note, archived_at) on public.apartments to authenticated;

alter table public.properties enable row level security;
alter table public.apartments enable row level security;

create policy "Mitglieder und Admin lesen Objekte"
  on public.properties for select to authenticated
  using (private.is_member(tenant_id) or (select private.is_admin()));
create policy "Inhaber legen Objekte an"
  on public.properties for insert to authenticated
  with check (private.has_role(tenant_id, 'owner'));
create policy "Inhaber ändern Objekte"
  on public.properties for update to authenticated
  using (private.has_role(tenant_id, 'owner'))
  with check (private.has_role(tenant_id, 'owner'));
create policy "Inhaber löschen Objekte"
  on public.properties for delete to authenticated
  using (private.has_role(tenant_id, 'owner'));

create policy "Mitglieder und Admin lesen Wohnungen"
  on public.apartments for select to authenticated
  using (private.is_member(tenant_id) or (select private.is_admin()));
create policy "Inhaber legen Wohnungen an"
  on public.apartments for insert to authenticated
  with check (private.has_role(tenant_id, 'owner'));
create policy "Inhaber ändern Wohnungen"
  on public.apartments for update to authenticated
  using (private.has_role(tenant_id, 'owner'))
  with check (private.has_role(tenant_id, 'owner'));
create policy "Inhaber löschen Wohnungen"
  on public.apartments for delete to authenticated
  using (private.has_role(tenant_id, 'owner'));

select private.enable_tenant_table('public.properties');
select private.enable_tenant_table('public.apartments');

-- ---------------------------------------------------------------------------
-- Wohnung samt neuem Objekt in einem Zug (ohne Systemrechte: Zugriffsregeln gelten wie bei Einzelaufrufen)
-- ---------------------------------------------------------------------------
create function public.create_apartment_with_property(
  p_tenant_id uuid,
  p_property_name text,
  p_street text,
  p_postal_code text,
  p_city text,
  p_municipality_code text,
  p_name text,
  p_max_guests integer,
  p_kind text,
  p_price_cents integer,
  p_check_in time,
  p_check_out time,
  p_note text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_property_id uuid;
  v_apartment_id uuid;
begin
  insert into public.properties (tenant_id, name, street, postal_code, city, municipality_code)
  values (p_tenant_id, p_property_name, p_street, p_postal_code, p_city, p_municipality_code)
  returning id into v_property_id;

  insert into public.apartments (tenant_id, property_id, name, max_guests, kind, price_cents, check_in, check_out, note)
  values (p_tenant_id, v_property_id, p_name, p_max_guests, p_kind, p_price_cents, p_check_in, p_check_out, p_note)
  returning id into v_apartment_id;

  return v_apartment_id;
end;
$$;

revoke execute on function public.create_apartment_with_property(uuid, text, text, text, text, text, text, integer, text, integer, time, time, text) from public, anon;
grant execute on function public.create_apartment_with_property(uuid, text, text, text, text, text, text, integer, text, integer, time, time, text) to authenticated;
