-- PROJ-4: Einladungen und geschärfte Regeln für Mitgliedschaften (vom Nutzer freigegeben am 2026-10-23)
--
-- 1. Einladungen als eigene Datensätze (offen/angenommen/abgelehnt/zurückgezogen)
-- 2. Mitgliedschaften entstehen nur noch durch Annehmen einer Einladung (oder serverseitig, PROJ-5)
-- 3. Inhaber ändern/entfernen nur Mitarbeiter; jede Person darf sich selbst herabstufen/entfernen;
--    „mindestens ein Inhaber“ (PROJ-1) gilt weiter

-- ---------------------------------------------------------------------------
-- Einladungen
-- ---------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and length(email) between 3 and 320),
  role public.member_role not null,
  -- new_account: Supabase-Einladungsmail (Link 24 h); existing_account: Hinweis-Mail, Annehmen in der App (14 Tage)
  kind text not null check (kind in ('new_account', 'existing_account')),
  status text not null default 'open' check (status in ('open', 'accepted', 'declined', 'revoked')),
  invited_by uuid references public.profiles (id) on delete set null,
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
comment on table public.invitations is 'Einladungen zu einem Kunden (PROJ-4). Höchstens eine offene je Kunde und Adresse.';

create unique index invitations_one_open_per_email on public.invitations (tenant_id, email) where status = 'open';
create index invitations_email_open_idx on public.invitations (email) where status = 'open';
create index invitations_tenant_sent_idx on public.invitations (tenant_id, sent_at desc);
create index invitations_invited_by_idx on public.invitations (invited_by);

select private.enable_tenant_table('public.invitations');

revoke all on public.invitations from anon, authenticated;
grant select, insert on public.invitations to authenticated;
grant update (status, role, kind, sent_at, expires_at, closed_at) on public.invitations to authenticated;

alter table public.invitations enable row level security;

create policy "Inhaber und Admin lesen Einladungen"
  on public.invitations for select to authenticated
  using (private.has_role(tenant_id, 'owner') or (select private.is_admin()));

create policy "Inhaber laden ein"
  on public.invitations for insert to authenticated
  with check (private.has_role(tenant_id, 'owner') and invited_by = (select auth.uid()) and status = 'open');

create policy "Inhaber ändern Einladungen"
  on public.invitations for update to authenticated
  using (private.has_role(tenant_id, 'owner'))
  with check (private.has_role(tenant_id, 'owner'));
-- DELETE: keine Policy (nur Bereinigung); Eingeladene lesen/annehmen nur über die Funktionen unten

-- Abgeschlossene Einladungen nach 90 Tagen löschen (Datensparsamkeit), täglich 03:25 UTC
select cron.schedule(
  'purge-closed-invitations',
  '25 3 * * *',
  $$delete from public.invitations where status <> 'open' and closed_at < now() - interval '90 days'$$
);

-- ---------------------------------------------------------------------------
-- Mitgliedschaften: neue Regeln (ersetzen die Policies aus PROJ-1)
-- ---------------------------------------------------------------------------
drop policy "Inhaber fügen Mitglieder hinzu" on public.memberships;
drop policy "Inhaber ändern Rollen" on public.memberships;
drop policy "Inhaber entfernen Mitglieder" on public.memberships;
revoke insert on public.memberships from authenticated;

-- Hochstufen eines Mitarbeiters durch einen Inhaber, oder Selbst-Herabstufung eines Inhabers
create policy "Inhaber stufen Mitarbeiter hoch, Inhaber stufen sich selbst herab"
  on public.memberships for update to authenticated
  using (
    (private.has_role(tenant_id, 'owner') and role = 'staff' and user_id <> (select auth.uid()))
    or (user_id = (select auth.uid()) and role = 'owner')
  )
  with check (
    (role = 'owner' and user_id <> (select auth.uid()) and private.has_role(tenant_id, 'owner'))
    or (role = 'staff' and user_id = (select auth.uid()))
  );

-- Inhaber entfernen Mitarbeiter; jede Person kann selbst austreten
create policy "Inhaber entfernen Mitarbeiter, jeder tritt selbst aus"
  on public.memberships for delete to authenticated
  using (
    (private.has_role(tenant_id, 'owner') and role = 'staff')
    or user_id = (select auth.uid())
  );
-- INSERT: keine Policy und keine Rechte → nur über accept_invitation bzw. serverseitig (PROJ-5)

-- ---------------------------------------------------------------------------
-- Eingeladene Person: eigene offene Einladungen lesen, annehmen, ablehnen
-- Abgleich über die E-Mail-Adresse des angemeldeten Kontos (aus der Datenbank, nicht aus dem Token)
-- ---------------------------------------------------------------------------
create function private.current_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(btrim(u.email)) from auth.users u where u.id = (select auth.uid());
$$;

create function public.my_open_invitations()
returns table (id uuid, tenant_name text, invited_by_name text, role public.member_role, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, t.name, p.display_name, i.role, i.expires_at
  from public.invitations i
  join public.tenants t on t.id = i.tenant_id and t.status = 'active'
  left join public.profiles p on p.id = i.invited_by
  where i.status = 'open'
    and i.kind = 'existing_account'
    and i.expires_at > now()
    and i.email = private.current_email()
    and not exists (
      select 1 from public.memberships m where m.tenant_id = i.tenant_id and m.user_id = (select auth.uid())
    )
  order by i.sent_at desc;
$$;

-- Annehmen: legt die Mitgliedschaft an und schließt die Einladung (in einem Schritt). Gibt den Kunden zurück.
create function public.accept_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
begin
  select * into v_inv from public.invitations where id = p_invitation_id for update;

  if v_inv.id is null
     or v_inv.status <> 'open'
     or v_inv.email <> private.current_email()
     or (v_inv.kind = 'existing_account' and v_inv.expires_at <= now())
     or not exists (select 1 from public.tenants t where t.id = v_inv.tenant_id and t.status = 'active')
  then
    raise exception 'Diese Einladung ist nicht mehr gültig.' using errcode = 'P0002';
  end if;

  insert into public.memberships (tenant_id, user_id, role)
  values (v_inv.tenant_id, (select auth.uid()), v_inv.role)
  on conflict (tenant_id, user_id) do nothing;

  update public.invitations set status = 'accepted', closed_at = now() where id = v_inv.id;
  return v_inv.tenant_id;
end;
$$;

create function public.decline_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invitations
  set status = 'declined', closed_at = now()
  where id = p_invitation_id and status = 'open' and email = private.current_email();
  if not found then
    raise exception 'Diese Einladung ist nicht mehr gültig.' using errcode = 'P0002';
  end if;
end;
$$;

-- Neues Konto (Einladungsmail aus PROJ-3): Nach dem Festlegen von Name und Passwort werden alle offenen
-- Einladungen dieser Art für die eigene Adresse eingelöst. Die 24-h-Frist betraf nur den Mail-Link,
-- der hier bereits eingelöst ist. Gibt den zuletzt eingeladenen Kunden zurück (oder null).
create function public.accept_new_account_invitations()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_last uuid;
begin
  for v_inv in
    select i.* from public.invitations i
    join public.tenants t on t.id = i.tenant_id and t.status = 'active'
    where i.status = 'open' and i.kind = 'new_account' and i.email = private.current_email()
    order by i.sent_at
    for update of i
  loop
    insert into public.memberships (tenant_id, user_id, role)
    values (v_inv.tenant_id, (select auth.uid()), v_inv.role)
    on conflict (tenant_id, user_id) do nothing;
    update public.invitations set status = 'accepted', closed_at = now() where id = v_inv.id;
    v_last := v_inv.tenant_id;
  end loop;
  return v_last;
end;
$$;

revoke execute on function private.current_email() from public;
grant execute on function private.current_email() to authenticated;
revoke execute on function public.my_open_invitations() from public, anon;
revoke execute on function public.accept_invitation(uuid) from public, anon;
revoke execute on function public.decline_invitation(uuid) from public, anon;
revoke execute on function public.accept_new_account_invitations() from public, anon;
grant execute on function public.my_open_invitations() to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.decline_invitation(uuid) to authenticated;
grant execute on function public.accept_new_account_invitations() to authenticated;
