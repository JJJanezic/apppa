-- PROJ-1: Fundament – Mandanten, Profile, Mitgliedschaften, Prüf-Bausteine, RLS
--
-- Muster für alle späteren Fachtabellen:
--   * jede Zeile hat tenant_id
--   * Lesen:     private.is_member(tenant_id) or private.is_admin()
--   * Schreiben: private.is_member(tenant_id) bzw. private.has_role(tenant_id, 'owner')
--   * Standardfelder + Änderungsprotokoll: select private.enable_tenant_table('public.<tabelle>');

-- ---------------------------------------------------------------------------
-- Schema für interne Funktionen (nicht über die API erreichbar)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- Typen
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'staff');
create type public.tenant_status as enum ('active', 'deactivated');

-- ---------------------------------------------------------------------------
-- Standardfelder: angelegt am/von, geändert am/von – immer von der Datenbank gesetzt
-- ---------------------------------------------------------------------------
create function private.set_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := auth.uid();
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  status public.tenant_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
comment on table public.tenants is 'Mandanten (Kunden/Vermieter). Anlegen und Deaktivieren nur serverseitig (PROJ-5).';

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text check (display_name is null or length(display_name) <= 200),
  is_operator_admin boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
comment on table public.profiles is 'Ein Profil pro Login-Konto. is_operator_admin nur direkt in der Datenbank setzbar (Runbook).';

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint memberships_tenant_user_key unique (tenant_id, user_id)
);
comment on table public.memberships is 'Person ↔ Mandant mit Rolle. Jeder Mandant hat mindestens einen Inhaber.';

create index memberships_user_id_idx on public.memberships (user_id);

create trigger set_audit_fields before insert or update on public.tenants
  for each row execute function private.set_audit_fields();
create trigger set_audit_fields before insert or update on public.profiles
  for each row execute function private.set_audit_fields();
create trigger set_audit_fields before insert or update on public.memberships
  for each row execute function private.set_audit_fields();

-- ---------------------------------------------------------------------------
-- Prüf-Bausteine (SECURITY DEFINER: umgehen RLS, damit Policies nicht rekursiv werden)
-- ---------------------------------------------------------------------------
create function private.is_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.tenant_id = p_tenant_id
      and m.user_id = (select auth.uid())
      and t.status = 'active'
  );
$$;

create function private.has_role(p_tenant_id uuid, p_role public.member_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.tenant_id = p_tenant_id
      and m.user_id = (select auth.uid())
      and m.role = p_role
      and t.status = 'active'
  );
$$;

-- Admin-Rechte gelten nur in einer mit 2FA bestätigten Sitzung (aal2).
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    and coalesce(
      (select p.is_operator_admin from public.profiles p where p.id = (select auth.uid())),
      false
    );
$$;

-- Teilen zwei Personen mindestens einen aktiven Mandanten? (für Profil-Sichtbarkeit)
create function private.shares_tenant_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.tenant_id = mine.tenant_id
    join public.tenants t on t.id = mine.tenant_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
      and t.status = 'active'
  );
$$;

revoke execute on function private.is_member(uuid) from public;
revoke execute on function private.has_role(uuid, public.member_role) from public;
revoke execute on function private.is_admin() from public;
revoke execute on function private.shares_tenant_with(uuid) from public;
grant execute on function private.is_member(uuid) to authenticated, service_role;
grant execute on function private.has_role(uuid, public.member_role) to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.shares_tenant_with(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Profil automatisch zum Login-Konto anlegen und E-Mail aktuell halten
-- ---------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '')
  );
  return new;
end;
$$;

create function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Admin-Kennzeichen: über die App von niemandem setzbar
-- (Spaltenrechte verhindern es für angemeldete Nutzer; dieser Trigger ist die zweite Sicherung.
--  Gesetzt wird es per SQL-Editor bzw. für Tests serverseitig mit dem Secret Key.)
-- ---------------------------------------------------------------------------
create function private.protect_operator_admin_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (
       (tg_op = 'INSERT' and new.is_operator_admin)
       or (tg_op = 'UPDATE' and new.is_operator_admin is distinct from old.is_operator_admin)
     )
  then
    raise exception 'Admin-Rechte können nicht über die App vergeben oder entzogen werden.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_operator_admin_flag
  before insert or update on public.profiles
  for each row execute function private.protect_operator_admin_flag();

-- ---------------------------------------------------------------------------
-- Jeder Mandant braucht mindestens einen Inhaber
-- ---------------------------------------------------------------------------
create function private.ensure_tenant_has_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role <> 'owner' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.role = 'owner' and new.tenant_id = old.tenant_id then
    return new;
  end if;

  -- Mandant sperren, damit parallele Änderungen nicht beide den „letzten“ Inhaber entfernen
  perform 1 from public.tenants where id = old.tenant_id for update;

  -- Wird der Mandant selbst gelöscht (Kaskade), ist das erlaubt
  if not found then
    return coalesce(new, old);
  end if;

  if not exists (
    select 1 from public.memberships m
    where m.tenant_id = old.tenant_id
      and m.role = 'owner'
      and m.id <> old.id
  ) then
    raise exception 'Jeder Kunde braucht mindestens einen Inhaber.'
      using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger ensure_tenant_has_owner
  before update or delete on public.memberships
  for each row execute function private.ensure_tenant_has_owner();

-- ---------------------------------------------------------------------------
-- Rechte (Tabellen- und Spaltenebene) – anon hat keinerlei Zugriff
-- ---------------------------------------------------------------------------
revoke all on public.tenants, public.profiles, public.memberships from anon, authenticated;

grant select on public.tenants to authenticated;
grant update (name) on public.tenants to authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select, insert, delete on public.memberships to authenticated;
grant update (role) on public.memberships to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Fehlende Policies bedeuten „verweigert“ (z. B. Mandanten anlegen/löschen nur serverseitig).
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;

-- tenants
create policy "Mitglieder und Admin lesen Mandanten"
  on public.tenants for select to authenticated
  using (private.is_member(id) or (select private.is_admin()));

create policy "Inhaber ändern ihren Mandanten"
  on public.tenants for update to authenticated
  using (private.has_role(id, 'owner'))
  with check (private.has_role(id, 'owner'));
-- INSERT/DELETE: keine Policy → nur serverseitig (Secret Key, PROJ-5)

-- profiles
create policy "Eigenes Profil, Teamkollegen und Admin lesen"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or private.shares_tenant_with(id)
    or (select private.is_admin())
  );

create policy "Eigenes Profil ändern"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- INSERT: nur per Trigger beim Anlegen des Login-Kontos; DELETE: nur über Löschung des Kontos

-- memberships
create policy "Mitglieder und Admin lesen Mitgliedschaften"
  on public.memberships for select to authenticated
  using (private.is_member(tenant_id) or (select private.is_admin()));

create policy "Inhaber fügen Mitglieder hinzu"
  on public.memberships for insert to authenticated
  with check (private.has_role(tenant_id, 'owner'));

create policy "Inhaber ändern Rollen"
  on public.memberships for update to authenticated
  using (private.has_role(tenant_id, 'owner'))
  with check (private.has_role(tenant_id, 'owner'));

create policy "Inhaber entfernen Mitglieder"
  on public.memberships for delete to authenticated
  using (private.has_role(tenant_id, 'owner'));
