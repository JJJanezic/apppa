-- PROJ-50: Firmenliste
--
-- * Firmen als eigene Einträge je Kunde (Muster PROJ-1): Lesen für Mitglieder (und den Admin), direktes Anlegen und
--   Ändern nur für Inhaber. Mitarbeiter legen Firmen nur zusammen mit einer Buchung mit neuem Gast an (save_booking).
--   Standardfelder + Änderungsprotokoll; beim Löschen werden die Altwerte im Protokoll entfernt (Ansprechpartner, E-Mail).
-- * Gast mit höchstens einer Firma (guests.company_id). Löschen der Firma leert die Verknüpfung.
-- * Überführung der bisherigen Firmenfelder am Gast: gleiche Fassung (7 Felder, Groß-/Kleinschreibung und Rand-Leerzeichen
--   egal) → eine Firma mit den Werten des zuletzt geänderten Gastes; ohne Firmenname „Firma ohne Namen“ mit Merker.
--   Zählprüfung: bricht ab, wenn nicht jeder Gast mit Firmendaten verknüpft ist. Keine Protokolleinträge je Gast.
-- * Die alten Firmenspalten am Gast bleiben als Sicherung stehen, werden aber nicht mehr gelesen oder geschrieben
--   (Entfernen in einer späteren Aufräum-Migration). Anonymisieren leert sie weiterhin.
-- * Neue Funktionen: save_guest, company_list, company_duplicate_pairs, delete_company, merge_companies.
--   Umgestellt: guests_before_write (Suchtext ohne Firma), guest_list (Firma über die Verknüpfung, Suche auch im
--   Firmen-Suchtext), merge_guests, anonymize_guest, save_booking, save_invoice, search_invoice_bookings.
--   Entfernt: guest_company_suggestions (PROJ-49).
--
-- Fehlercodes (wie Gäste, src/app/(app)/gaeste/actions.ts und gaeste/firmen/actions.ts):
--   P0701 nur Inhaber · P0702 nicht gefunden · P0703 Gast anonymisiert · P0704 Zusammenführen ungültig
--   P0706 Gast inzwischen geändert (save_guest) · P0707 gewählte Firma gibt es nicht (mehr)

-- ---------------------------------------------------------------------------
-- Firmen
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  -- Platzhalter „Firma ohne Namen“ aus der Überführung; fällt bei der ersten Namensänderung weg (Trigger)
  name_missing boolean not null default false,
  vat_id text check (vat_id is null or length(btrim(vat_id)) between 1 and 30),
  -- Länge der Adresszeile 1 erst nach der Überführung (Altdaten aus PROJ-33 können länger sein), siehe unten
  address_line1 text,
  address_line2 text check (address_line2 is null or length(btrim(address_line2)) between 1 and 200),
  postal_code text check (postal_code is null or length(btrim(postal_code)) between 1 and 10),
  city text check (city is null or length(btrim(city)) between 1 and 100),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  email text check (email is null or (email = lower(btrim(email)) and length(email) between 3 and 254 and email like '%_@_%')),
  website text check (website is null or (length(btrim(website)) between 1 and 200 and website !~ '\s')),
  contact text check (contact is null or length(btrim(contact)) between 1 and 200),
  -- von der Datenbank gepflegt (Trigger), nicht beschreibbar
  search_text text not null default '',
  name_key text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  -- Ziel zusammengesetzter Fremdschlüssel (Gäste und Dubletten-Merker desselben Kunden)
  constraint companies_id_tenant_key unique (id, tenant_id)
);
comment on table public.companies is 'Firmen je Kunde (PROJ-50). Löschen und Zusammenführen nur über Funktionen.';

create index companies_tenant_name_idx on public.companies (tenant_id, lower(name));
create index companies_name_key_idx on public.companies (tenant_id, name_key);
create index companies_vat_key_idx on public.companies (tenant_id, (upper(regexp_replace(vat_id, '\s', '', 'g')))) where vat_id is not null;
create index companies_search_trgm_idx on public.companies using gin (search_text extensions.gin_trgm_ops);

-- Suchtext (Name und UID) und Namensschlüssel pflegen; Merker „Name fehlt“ fällt bei Namensänderung weg,
-- außer er wird ausdrücklich mitgesetzt (Zusammenführen übernimmt ihn mit dem gewählten Namen)
create function private.companies_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.name is distinct from old.name and new.name_missing = old.name_missing then
    new.name_missing := false;
  end if;
  new.search_text := private.guest_norm(concat_ws(' ', new.name, new.vat_id, regexp_replace(coalesce(new.vat_id, ''), '\s', '', 'g')));
  new.name_key := private.guest_norm(new.name);
  return new;
end;
$$;

create trigger companies_before_write before insert or update on public.companies
  for each row execute function private.companies_before_write();

-- Abgelehnte Vorschläge „mögliche doppelte Firma“
create table public.company_duplicate_dismissals (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Paar in fester Reihenfolge (kleinere ID zuerst), damit es nur einmal vorkommt
  company_a uuid not null,
  company_b uuid not null,
  dismissed_by uuid default auth.uid(),
  dismissed_at timestamptz not null default now(),
  primary key (company_a, company_b),
  constraint company_duplicate_dismissals_order check (company_a < company_b),
  constraint company_duplicate_dismissals_a_fkey foreign key (company_a, tenant_id)
    references public.companies (id, tenant_id) on delete cascade,
  constraint company_duplicate_dismissals_b_fkey foreign key (company_b, tenant_id)
    references public.companies (id, tenant_id) on delete cascade
);
comment on table public.company_duplicate_dismissals is '„Keine doppelte Firma“: abgelehnte Vorschläge je Kunde (PROJ-50).';
create index company_duplicate_dismissals_tenant_idx on public.company_duplicate_dismissals (tenant_id);
create index company_duplicate_dismissals_a_idx on public.company_duplicate_dismissals (company_a, tenant_id);
create index company_duplicate_dismissals_b_idx on public.company_duplicate_dismissals (company_b, tenant_id);

-- Verknüpfung am Gast (nur Firmen desselben Kunden; Löschen der Firma leert sie)
alter table public.guests
  add column company_id uuid,
  add constraint guests_company_fkey foreign key (company_id, tenant_id)
    references public.companies (id, tenant_id) on delete set null (company_id);
create index guests_company_idx on public.guests (company_id, tenant_id) where company_id is not null;

-- ---------------------------------------------------------------------------
-- Rechte und Abschottung (Muster PROJ-1)
-- ---------------------------------------------------------------------------
revoke all on public.companies, public.company_duplicate_dismissals from anon, authenticated;

grant select on public.companies to authenticated;
grant insert (tenant_id, name, vat_id, address_line1, address_line2, postal_code, city, country, email, website, contact)
  on public.companies to authenticated;
grant update (name, vat_id, address_line1, address_line2, postal_code, city, country, email, website, contact)
  on public.companies to authenticated;
-- DELETE: keine Rechte → nur über private.delete_company / private.merge_companies bzw. das Löschen des Kunden

grant select, insert (tenant_id, company_a, company_b) on public.company_duplicate_dismissals to authenticated;

alter table public.companies enable row level security;
alter table public.company_duplicate_dismissals enable row level security;

create policy "Mitglieder und Admin lesen Firmen"
  on public.companies for select to authenticated
  using (private.is_member(tenant_id) or (select private.is_admin()));
create policy "Inhaber legen Firmen an"
  on public.companies for insert to authenticated
  with check (private.has_role(tenant_id, 'owner'));
create policy "Inhaber ändern Firmen"
  on public.companies for update to authenticated
  using (private.has_role(tenant_id, 'owner'))
  with check (private.has_role(tenant_id, 'owner'));

create policy "Inhaber lesen abgelehnte Firmen-Vorschläge"
  on public.company_duplicate_dismissals for select to authenticated
  using (private.has_role(tenant_id, 'owner'));
create policy "Inhaber lehnen Firmen-Vorschläge ab"
  on public.company_duplicate_dismissals for insert to authenticated
  with check (private.has_role(tenant_id, 'owner'));

select private.enable_tenant_table('public.companies');

-- Alte Firmenspalten am Gast nicht mehr direkt beschreibbar (Sicherung bis zur Aufräum-Migration)
revoke insert (company_name, company_vat_id, company_address_line1, company_address_line2, company_postal_code, company_city, company_country)
  on public.guests from authenticated;
revoke update (company_name, company_vat_id, company_address_line1, company_address_line2, company_postal_code, company_city, company_country)
  on public.guests from authenticated;

-- ---------------------------------------------------------------------------
-- Suchtext des Gastes ohne Firma (die Gästesuche liest den Suchtext der verknüpften Firma mit)
-- ---------------------------------------------------------------------------
create or replace function private.guests_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  if new.birth_date is not null and new.birth_date > (now() at time zone 'Europe/Vienna')::date then
    raise exception 'Das Geburtsdatum darf nicht in der Zukunft liegen.' using errcode = '23514';
  end if;
  -- PROJ-29: Ausstellungsdatum nicht in der Zukunft
  if new.document_issued_on is not null and new.document_issued_on > (now() at time zone 'Europe/Vienna')::date then
    raise exception 'Das Ausstellungsdatum darf nicht in der Zukunft liegen.' using errcode = '23514';
  end if;
  -- PROJ-29: Neu eingetragene Bilder müssen im Speicher liegen und dürfen an keinem anderen Gast hängen
  foreach v_path in array array[new.document_front_path, new.document_back_path] loop
    continue when v_path is null;
    continue when tg_op = 'UPDATE' and v_path in (coalesce(old.document_front_path, ''), coalesce(old.document_back_path, ''));
    if not exists (select 1 from storage.objects o where o.bucket_id = 'guest-documents' and o.name = v_path) then
      raise exception 'Das Ausweisbild wurde nicht gefunden.' using errcode = 'P0705';
    end if;
    if private.document_in_use(v_path, new.id) then
      raise exception 'Das Ausweisbild gehört bereits zu einem anderen Gast.' using errcode = 'P0705';
    end if;
  end loop;

  -- PROJ-50: Firmenname nicht mehr im Suchtext des Gastes
  new.search_text := private.guest_norm(concat_ws(' ', new.last_name, new.first_name, new.email))
    || ' ' || private.guest_phone_digits(new.phone);
  new.email_key := private.guest_email_key(new.email);
  new.phone_key := nullif(private.guest_phone_digits(new.phone), '');
  if new.phone_key is not null and length(new.phone_key) < 6 then
    new.phone_key := null;
  end if;
  new.name_key := case
    when new.first_name is null or new.anonymized_at is not null then null
    else private.guest_norm(new.first_name || ' ' || new.last_name)
  end;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Überführung der Firmenfelder am Gast (einmalig; wiederholbar, verknüpft nur Gäste ohne Firma)
-- ---------------------------------------------------------------------------
create function private.transfer_guest_companies()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected integer;
  v_linked integer;
begin
  create temporary table _company_src on commit drop as
  select
    g.id as guest_id,
    g.tenant_id,
    g.updated_at,
    nullif(btrim(g.company_name), '') as name,
    nullif(btrim(g.company_vat_id), '') as vat_id,
    nullif(btrim(g.company_address_line1), '') as line1,
    nullif(btrim(g.company_address_line2), '') as line2,
    nullif(btrim(g.company_postal_code), '') as postal_code,
    nullif(btrim(g.company_city), '') as city,
    nullif(btrim(g.company_country), '') as country
  from public.guests g
  where g.company_id is null
    and g.anonymized_at is null
    and coalesce(nullif(btrim(g.company_name), ''), nullif(btrim(g.company_vat_id), ''), nullif(btrim(g.company_address_line1), ''),
      nullif(btrim(g.company_address_line2), ''), nullif(btrim(g.company_postal_code), ''), nullif(btrim(g.company_city), ''),
      nullif(btrim(g.company_country), '')) is not null;

  alter table _company_src add column k text;
  update _company_src set k = md5(concat_ws(chr(31),
    lower(coalesce(name, '')), lower(coalesce(vat_id, '')), lower(coalesce(line1, '')), lower(coalesce(line2, '')),
    lower(coalesce(postal_code, '')), lower(coalesce(city, '')), lower(coalesce(country, ''))));

  -- Je Kunde und Fassung eine Firma mit den Werten des zuletzt geänderten Gastes
  create temporary table _company_grp on commit drop as
  select distinct on (s.tenant_id, s.k) gen_random_uuid() as id, s.*
  from _company_src s
  order by s.tenant_id, s.k, s.updated_at desc, s.guest_id;

  insert into public.companies (id, tenant_id, name, name_missing, vat_id, address_line1, address_line2, postal_code, city, country)
  select id, tenant_id, coalesce(name, 'Firma ohne Namen'), name is null, vat_id, line1, line2, postal_code, city, country
  from _company_grp;

  update public.guests g set company_id = grp.id
  from _company_src s join _company_grp grp on grp.tenant_id = s.tenant_id and grp.k = s.k
  where g.id = s.guest_id;

  select count(*) into v_expected from _company_src;
  select count(*) into v_linked from public.guests g join _company_src s on s.guest_id = g.id where g.company_id is not null;
  if v_expected <> v_linked then
    raise exception 'Überführung der Firmen unvollständig: % Gäste mit Firmendaten, % verknüpft.', v_expected, v_linked;
  end if;
  return v_linked;
end;
$$;
revoke execute on function private.transfer_guest_companies() from public, anon, authenticated;

-- Ohne Protokolleinträge je Gast und ohne „zuletzt geändert“ zu verschieben; der Suchtext aller Gäste wird neu
-- berechnet (Firmenname fällt heraus)
alter table public.guests disable trigger audit_row;
alter table public.guests disable trigger set_audit_fields;
alter table public.companies disable trigger audit_row;
select private.transfer_guest_companies();
update public.guests set search_text = search_text;
alter table public.guests enable trigger audit_row;
alter table public.guests enable trigger set_audit_fields;
alter table public.companies enable trigger audit_row;

-- Länge der Adresszeile 1 gilt für neue und geänderte Firmen (wie PROJ-33 am Gast)
alter table public.companies
  add constraint companies_address_line1_check check (address_line1 is null or length(btrim(address_line1)) between 1 and 200) not valid;

-- ---------------------------------------------------------------------------
-- Firma eines neuen Gastes (Gast speichern, Buchung bzw. Rechnung mit neuem Gast): bestehende Firma per Kennung
-- (muss zum Kunden gehören) oder neue Firma aus den Feldern in new_company; sonst keine Firma
-- ---------------------------------------------------------------------------
create function private.guest_company_from_input(p_tenant uuid, p_guest jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_guest ->> 'company_id', '')::uuid;
  v_new jsonb := case when jsonb_typeof(p_guest -> 'new_company') = 'object' then p_guest -> 'new_company' end;
begin
  if v_id is not null then
    if not exists (select 1 from public.companies where id = v_id and tenant_id = p_tenant) then
      raise exception 'Die gewählte Firma gibt es nicht.' using errcode = 'P0707';
    end if;
    return v_id;
  end if;
  if v_new is null then
    return null;
  end if;
  insert into public.companies (tenant_id, name, vat_id, address_line1, address_line2, postal_code, city, country, email, website, contact)
  values (
    p_tenant, v_new ->> 'name', v_new ->> 'vat_id', v_new ->> 'address_line1', v_new ->> 'address_line2',
    v_new ->> 'postal_code', v_new ->> 'city', v_new ->> 'country', v_new ->> 'email', v_new ->> 'website', v_new ->> 'contact'
  )
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function private.guest_company_from_input(uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Gast speichern (Gästeseite, nur Inhaber): Gast und gegebenenfalls neue Firma in einem Schritt.
-- p_input: tenant_id, optional id + updated_at (Bearbeiten), Gastspalten, email_source/phone_source,
-- company_id oder new_company
-- ---------------------------------------------------------------------------
create function private.save_guest(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := nullif(p_input ->> 'tenant_id', '')::uuid;
  v_id uuid := nullif(p_input ->> 'id', '')::uuid;
  v_guest public.guests;
  v_company uuid;
begin
  if v_tenant is null or not private.has_role(v_tenant, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0701';
  end if;

  if v_id is not null then
    select * into v_guest from public.guests where id = v_id and tenant_id = v_tenant for update;
    if v_guest.id is null then
      raise exception 'Gast nicht gefunden.' using errcode = 'P0702';
    end if;
    if v_guest.anonymized_at is not null then
      raise exception 'Der Gast ist anonymisiert.' using errcode = 'P0703';
    end if;
    if v_guest.updated_at is distinct from nullif(p_input ->> 'updated_at', '')::timestamptz then
      raise exception 'Der Gast wurde inzwischen geändert.' using errcode = 'P0706';
    end if;
  end if;

  v_company := private.guest_company_from_input(v_tenant, p_input);

  if v_id is null then
    insert into public.guests (
      tenant_id, last_name, first_name, country, email, phone, language, birth_date, street, postal_code, city,
      address_country, marketing_source, marketing_custom, note, company_id,
      title_prefix, title_suffix, gender, document_type, document_number, document_issued_on, document_authority,
      document_country, document_front_path, document_back_path
    ) values (
      v_tenant, p_input ->> 'last_name', p_input ->> 'first_name', p_input ->> 'country',
      p_input ->> 'email', p_input ->> 'phone', p_input ->> 'language',
      (p_input ->> 'birth_date')::date, p_input ->> 'street', p_input ->> 'postal_code',
      p_input ->> 'city', p_input ->> 'address_country', p_input ->> 'marketing_source',
      p_input ->> 'marketing_custom', p_input ->> 'note', v_company,
      p_input ->> 'title_prefix', p_input ->> 'title_suffix',
      coalesce(p_input ->> 'gender', 'unspecified'), p_input ->> 'document_type',
      p_input ->> 'document_number', (p_input ->> 'document_issued_on')::date,
      p_input ->> 'document_authority', p_input ->> 'document_country',
      p_input ->> 'document_front_path', p_input ->> 'document_back_path'
    ) returning id into v_id;
    return v_id;
  end if;

  update public.guests set
    last_name = p_input ->> 'last_name',
    first_name = p_input ->> 'first_name',
    country = p_input ->> 'country',
    email = p_input ->> 'email',
    email_source = coalesce(p_input ->> 'email_source', v_guest.email_source),
    phone = p_input ->> 'phone',
    phone_source = coalesce(p_input ->> 'phone_source', v_guest.phone_source),
    language = p_input ->> 'language',
    birth_date = (p_input ->> 'birth_date')::date,
    street = p_input ->> 'street',
    postal_code = p_input ->> 'postal_code',
    city = p_input ->> 'city',
    address_country = p_input ->> 'address_country',
    marketing_source = p_input ->> 'marketing_source',
    marketing_custom = p_input ->> 'marketing_custom',
    note = p_input ->> 'note',
    company_id = v_company,
    title_prefix = p_input ->> 'title_prefix',
    title_suffix = p_input ->> 'title_suffix',
    gender = coalesce(p_input ->> 'gender', 'unspecified'),
    document_type = p_input ->> 'document_type',
    document_number = p_input ->> 'document_number',
    document_issued_on = (p_input ->> 'document_issued_on')::date,
    document_authority = p_input ->> 'document_authority',
    document_country = p_input ->> 'document_country',
    document_front_path = p_input ->> 'document_front_path',
    document_back_path = p_input ->> 'document_back_path'
  where id = v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Firmenliste und Firmensuche (Zugriffsregeln gelten wie bei direkten Abfragen)
-- p_query: Wörter in Name oder UID; p_exact_name: gleicher vereinheitlichter Name (Hinweis bei „Neue Firma“)
-- ---------------------------------------------------------------------------
create function public.company_list(
  p_tenant_id uuid,
  p_query text default '',
  p_exact_name text default null,
  p_exclude_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  name_missing boolean,
  vat_id text,
  address_line1 text,
  postal_code text,
  city text,
  country text,
  guest_count integer,
  total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with needle as (
    select array_remove(string_to_array(
      replace(replace(replace(private.guest_norm(left(coalesce(p_query, ''), 200)), '\', '\\'), '%', '\%'), '_', '\_'),
      ' '
    ), '') as words
  ),
  matches as (
    select c.*
    from public.companies c
    cross join needle n
    where c.tenant_id = p_tenant_id
      and (p_exclude_id is null or c.id <> p_exclude_id)
      and (p_exact_name is null or c.name_key = private.guest_norm(left(p_exact_name, 200)))
      and (cardinality(n.words) = 0 or not exists (select 1 from unnest(n.words) w where c.search_text not like '%' || w || '%'))
  )
  select m.id, m.name, m.name_missing, m.vat_id, m.address_line1, m.postal_code, m.city, m.country,
    (select count(*)::integer from public.guests g where g.company_id = m.id and g.tenant_id = m.tenant_id) as guest_count,
    count(*) over () as total
  from matches m
  order by lower(m.name), m.id
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

-- ---------------------------------------------------------------------------
-- Mögliche doppelte Firmen: gleicher Name (nicht bei Platzhaltern) oder gleiche UID, ohne abgelehnte; nur Inhaber
-- ---------------------------------------------------------------------------
create function private.company_duplicate_pairs(p_tenant_id uuid)
returns table (company_a uuid, company_b uuid, reasons text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0701';
  end if;
  return query
    with pairs as (
      select a.id as a_id, b.id as b_id, 'name' as reason
        from public.companies a join public.companies b on b.tenant_id = a.tenant_id and b.name_key = a.name_key and a.id < b.id
        where a.tenant_id = p_tenant_id and not a.name_missing and not b.name_missing
      union all
      select a.id, b.id, 'vatId'
        from public.companies a join public.companies b on b.tenant_id = a.tenant_id and a.id < b.id
          and upper(regexp_replace(b.vat_id, '\s', '', 'g')) = upper(regexp_replace(a.vat_id, '\s', '', 'g'))
        where a.tenant_id = p_tenant_id and a.vat_id is not null and b.vat_id is not null
    )
    select p.a_id, p.b_id, array_agg(distinct p.reason order by p.reason)
    from pairs p
    where not exists (
      select 1 from public.company_duplicate_dismissals d where d.company_a = p.a_id and d.company_b = p.b_id
    )
    group by p.a_id, p.b_id
    order by p.a_id, p.b_id
    limit 200;
end;
$$;

-- ---------------------------------------------------------------------------
-- Firma löschen (nur Inhaber): Verknüpfungen der Gäste werden geleert (Fremdschlüssel), Altwerte im Protokoll
-- entfernt. Rückgabe: Anzahl der Gäste, die danach keine Firma mehr haben.
-- ---------------------------------------------------------------------------
create function private.delete_company(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_guests integer;
begin
  select * into v_company from public.companies where id = p_company_id for update;
  if v_company.id is null then
    raise exception 'Firma nicht gefunden.' using errcode = 'P0702';
  end if;
  if not private.has_role(v_company.tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0701';
  end if;
  select count(*) into v_guests from public.guests where company_id = p_company_id and tenant_id = v_company.tenant_id;
  delete from public.companies where id = p_company_id;
  -- Es bleibt nur der Vermerk „gelöscht“ mit Person und Zeitpunkt (Ansprechpartner und E-Mail können Personendaten sein)
  perform private.purge_audit_personal_data('companies', p_company_id);
  return v_guests;
end;
$$;

-- ---------------------------------------------------------------------------
-- Firmen zusammenführen (nur Inhaber): p_keep bleibt mit den je Angabe gewählten Werten ('a' = p_keep,
-- 'b' = p_remove), die Gäste von p_remove gehen auf p_keep über, p_remove wird gelöscht
-- ---------------------------------------------------------------------------
create function private.merge_companies(p_keep uuid, p_remove uuid, p_choice jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keep public.companies;
  v_remove public.companies;
  b_name boolean := p_choice ->> 'name' = 'b';
  b_vat boolean := p_choice ->> 'vatId' = 'b';
  b_address boolean := p_choice ->> 'address' = 'b';
  b_email boolean := p_choice ->> 'email' = 'b';
  b_website boolean := p_choice ->> 'website' = 'b';
  b_contact boolean := p_choice ->> 'contact' = 'b';
begin
  if p_keep is null or p_remove is null or p_keep = p_remove then
    raise exception 'Eine Firma lässt sich nicht mit sich selbst zusammenführen.' using errcode = 'P0704';
  end if;
  -- feste Sperr-Reihenfolge gegen Verklemmungen bei gleichzeitigen Aufrufen
  perform 1 from public.companies where id in (p_keep, p_remove) order by id for update;
  select * into v_keep from public.companies where id = p_keep;
  select * into v_remove from public.companies where id = p_remove;
  if v_keep.id is null or v_remove.id is null then
    raise exception 'Firma nicht gefunden.' using errcode = 'P0702';
  end if;
  if v_keep.tenant_id <> v_remove.tenant_id then
    raise exception 'Firmen verschiedener Kunden lassen sich nicht zusammenführen.' using errcode = 'P0704';
  end if;
  if not private.has_role(v_keep.tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0701';
  end if;

  update public.guests set company_id = p_keep where company_id = p_remove and tenant_id = v_keep.tenant_id;
  delete from public.companies where id = p_remove;

  update public.companies set
    name = case when b_name then v_remove.name else v_keep.name end,
    name_missing = case when b_name then v_remove.name_missing else v_keep.name_missing end,
    vat_id = case when b_vat then v_remove.vat_id else v_keep.vat_id end,
    -- Rechnungsadresse als Ganzes
    address_line1 = case when b_address then v_remove.address_line1 else v_keep.address_line1 end,
    address_line2 = case when b_address then v_remove.address_line2 else v_keep.address_line2 end,
    postal_code = case when b_address then v_remove.postal_code else v_keep.postal_code end,
    city = case when b_address then v_remove.city else v_keep.city end,
    country = case when b_address then v_remove.country else v_keep.country end,
    email = case when b_email then v_remove.email else v_keep.email end,
    website = case when b_website then v_remove.website else v_keep.website end,
    contact = case when b_contact then v_remove.contact else v_keep.contact end
  where id = p_keep;

  -- Verknüpfung im Protokoll: „zusammengeführt mit …“ bei der verbleibenden Firma
  insert into public.audit_log (tenant_id, table_name, record_id, action, old_data, new_data, actor_id, actor_label)
  values (v_keep.tenant_id, 'companies', p_keep, 'update', null, jsonb_build_object('merged_from', p_remove), auth.uid(), 'user');
end;
$$;

-- ---------------------------------------------------------------------------
-- Gästeliste: Firma über die Verknüpfung; Suche trifft Gast- oder Firmen-Suchtext (neue Rückgabespalte → neu anlegen)
-- ---------------------------------------------------------------------------
drop function public.guest_list(uuid, text, text, text, text, integer, integer);
create function public.guest_list(
  p_tenant_id uuid,
  p_query text default '',
  p_country text default null,
  p_marketing text default null,
  p_sort text default 'name',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  last_name text,
  first_name text,
  title_prefix text,
  title_suffix text,
  company_id uuid,
  company_name text,
  country text,
  anonymized_at timestamptz,
  stay_count integer,
  last_stay date,
  total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with needle as (
    select
      -- Wörter des Suchbegriffs; LIKE-Platzhalter wörtlich nehmen
      array_remove(string_to_array(
        replace(replace(replace(private.guest_norm(left(p_query, 200)), '\', '\\'), '%', '\%'), '_', '\_'),
        ' '
      ), '') as words,
      private.guest_phone_digits(left(p_query, 200)) as digits
  ),
  matches as (
    select g.*, c.name as c_name, s.stay_count, s.last_stay
    from public.guests g
    cross join needle n
    left join public.companies c on c.id = g.company_id and c.tenant_id = g.tenant_id
    left join lateral (
      select
        count(*)::integer as stay_count,
        max(b.arrival) filter (where b.arrival <= private.today_vienna()) as last_stay
      from public.bookings b
      where b.guest_id = g.id and b.tenant_id = g.tenant_id and b.kind = 'booking' and b.cancelled_at is null
    ) s on true
    where g.tenant_id = p_tenant_id
      and (
        cardinality(n.words) = 0
        or not exists (
          select 1 from unnest(n.words) w
          where (g.search_text || ' ' || coalesce(c.search_text, '')) not like '%' || w || '%'
        )
        or (length(n.digits) >= 3 and g.phone_key like '%' || n.digits || '%')
      )
      and (p_country is null or g.country = p_country)
      and (
        p_marketing is null
        or (p_marketing = 'none' and g.marketing_source is null and g.marketing_custom is null)
        or (p_marketing = 'custom' and g.marketing_custom is not null)
        or g.marketing_source = p_marketing
      )
  )
  select m.id, m.last_name, m.first_name, m.title_prefix, m.title_suffix, m.company_id, m.c_name, m.country, m.anonymized_at,
    m.stay_count, m.last_stay, count(*) over () as total
  from matches m
  order by
    case when p_sort = 'lastStay' then m.last_stay end desc nulls last,
    lower(m.last_name), lower(coalesce(m.first_name, '')), m.id
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

-- ---------------------------------------------------------------------------
-- Gäste zusammenführen: unter „Firma“ wird die Verknüpfung gewählt
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
    -- PROJ-50: Verknüpfung mit der Firma statt Firmenfelder
    company_id = case when b_company then v_remove.company_id else v_keep.company_id end,
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

-- ---------------------------------------------------------------------------
-- Anonymisieren: zusätzlich die Verknüpfung mit der Firma entfernen (die Firma bleibt bestehen)
-- ---------------------------------------------------------------------------
create or replace function private.anonymize_guest(p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_companions uuid[];
begin
  update public.guests set
    last_name = 'Gelöschter Gast',
    first_name = null,
    email = null,
    email_source = 'direct',
    phone = null,
    phone_source = 'direct',
    language = null,
    birth_date = null,
    street = null,
    postal_code = null,
    city = null,
    address_country = null,
    marketing_source = null,
    marketing_custom = null,
    -- PROJ-50: Verknüpfung; die alten Firmenspalten (Sicherung) ebenfalls leeren
    company_id = null,
    company_name = null,
    company_vat_id = null,
    company_address_line1 = null,
    company_address_line2 = null,
    company_postal_code = null,
    company_city = null,
    company_country = null,
    note = null,
    -- PROJ-29 (die Ausweisbilder löscht danach der Server aus dem Speicher)
    title_prefix = null,
    title_suffix = null,
    gender = 'unspecified',
    document_type = null,
    document_number = null,
    document_issued_on = null,
    document_authority = null,
    document_country = null,
    document_front_path = null,
    document_back_path = null,
    anonymized_at = now()
  where id = p_guest_id;
  delete from public.guest_duplicate_dismissals where guest_a = p_guest_id or guest_b = p_guest_id;
  perform private.purge_audit_personal_data('guests', p_guest_id);

  -- PROJ-8: Mitreisende aller Buchungen dieses Gastes entfernen (samt Altwerten im Protokoll);
  -- Anzahl und Alter der Personen bleiben an der Buchung
  select array_agg(c.id) into v_companions
  from public.booking_companions c join public.bookings b on b.id = c.booking_id
  where b.guest_id = p_guest_id;
  if v_companions is not null then
    delete from public.booking_companions where id = any (v_companions);
    update public.audit_log set old_data = null, new_data = null
    where table_name = 'booking_companions' and record_id = any (v_companions);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Buchung speichern mit neuem Gast: Firma über die Verknüpfung (sonst unverändert)
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
-- Rechnung nacherfassen mit neuem Gast: Firma über die Verknüpfung (sonst unverändert)
-- ---------------------------------------------------------------------------
create or replace function private.save_invoice(p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

-- ---------------------------------------------------------------------------
-- Buchungssuche für Rechnungen: Firmenname über die Verknüpfung
-- ---------------------------------------------------------------------------
create or replace function private.search_invoice_bookings(p_tenant_id uuid, p_query text, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, kind text, number text, guest_last_name text, guest_first_name text, apartment_name text, property_name text, arrival date, departure date, cancelled boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  left join public.companies c on c.id = g.company_id
  where b.tenant_id = p_tenant_id
    and b.kind <> 'block'
    and not exists (
      select 1
      from unnest(v_texts, v_froms, v_tos) as w(t, f, u)
      where not case
        when w.f is not null then b.arrival < w.u and b.departure >= w.f
        else private.guest_norm(concat_ws(' ', g.last_name, g.first_name, c.name, a.name, p.name, b.number))
          like '%' || w.t || '%'
      end
    )
  order by b.arrival desc, b.number desc
  limit least(greatest(coalesce(p_limit, 20), 1), 20);
end;
$function$;

-- PROJ-49 entfällt
drop function if exists public.guest_company_suggestions(uuid, text, uuid);

-- ---------------------------------------------------------------------------
-- Aufrufbar über die API (security invoker; die privaten Funktionen prüfen die Rolle selbst)
-- ---------------------------------------------------------------------------
create function public.save_guest(p_input jsonb)
returns uuid
language sql security invoker set search_path = ''
as $$ select private.save_guest(p_input); $$;

create function public.company_duplicate_pairs(p_tenant_id uuid)
returns table (company_a uuid, company_b uuid, reasons text[])
language sql stable security invoker set search_path = ''
as $$ select * from private.company_duplicate_pairs(p_tenant_id); $$;

create function public.delete_company(p_company_id uuid)
returns integer
language sql security invoker set search_path = ''
as $$ select private.delete_company(p_company_id); $$;

create function public.merge_companies(p_keep uuid, p_remove uuid, p_choice jsonb)
returns void
language sql security invoker set search_path = ''
as $$ select private.merge_companies(p_keep, p_remove, p_choice); $$;

revoke execute on function private.companies_before_write() from public, anon, authenticated;
revoke execute on function private.save_guest(jsonb) from public, anon;
revoke execute on function private.company_duplicate_pairs(uuid) from public, anon;
revoke execute on function private.delete_company(uuid) from public, anon;
revoke execute on function private.merge_companies(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.save_guest(jsonb) from public, anon;
revoke execute on function public.company_duplicate_pairs(uuid) from public, anon;
revoke execute on function public.delete_company(uuid) from public, anon;
revoke execute on function public.merge_companies(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.company_list(uuid, text, text, uuid, integer, integer) from public, anon;
revoke execute on function public.guest_list(uuid, text, text, text, text, integer, integer) from public, anon;
