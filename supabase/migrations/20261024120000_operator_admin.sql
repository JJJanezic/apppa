-- PROJ-5: Betreiber-Admin
--
-- * Betreiber-Protokoll (nur der Admin liest, niemand schreibt direkt, Bereinigung nach 2 Jahren)
-- * Admin-Aktionen als eng umrissene Funktionen: jede prüft selbst Admin-Kennzeichen + 2FA (private.is_admin),
--   ändert genau eine Sache und schreibt den Protokolleintrag im selben Zug. Der Admin bekommt damit
--   KEINE allgemeinen Schreibrechte auf Kundendaten (Entscheidung PROJ-1); bestehende Regeln für
--   Inhaber und Mitarbeiter bleiben unverändert.
-- * Logik in private.* (SECURITY DEFINER, nicht über die API erreichbar), öffentlich nur dünne Hüllen
--   ohne Systemrechte (SECURITY INVOKER) – wie PROJ-4 (Advisor 0029).
--
-- Fehlercodes (die Server-Aktionen übersetzen sie in Meldungen):
--   42501 kein Admin · P0001 letzter Inhaber (Trigger aus PROJ-1) · 23505 offene Einladung existiert
--   P0010 gleicher Kundenname · P0011 Kunde nicht vorhanden · P0012 Kunde nicht deaktiviert
--   P0013 Name stimmt nicht · P0014 bereits Mitglied · P0015 Einladung ungültig
--   P0016 Kunde deaktiviert · P0017 Aktion für diese Rolle nicht vorgesehen

-- ---------------------------------------------------------------------------
-- Betreiber-Protokoll
-- ---------------------------------------------------------------------------
create table public.operator_log (
  id bigint generated always as identity primary key,
  -- bewusst ohne Fremdschlüssel: Einträge überdauern das Löschen des Kunden (Löschnachweis)
  tenant_id uuid not null,
  tenant_name text not null,
  action text not null check (action in (
    'created', 'invited', 'resent', 'revoked', 'promoted', 'demoted', 'removed', 'deactivated', 'reactivated', 'deleted'
  )),
  actor_id uuid,
  actor_name text,
  target_email text,
  created_at timestamptz not null default now()
);
comment on table public.operator_log is 'Admin-Aktionen je Kunde (PROJ-5). Nur der Admin liest; Einträge entstehen nur in den Admin-Funktionen.';

create index operator_log_tenant_created_idx on public.operator_log (tenant_id, created_at desc);
create index operator_log_created_idx on public.operator_log (created_at);

revoke all on public.operator_log from anon, authenticated, service_role;
grant select on public.operator_log to authenticated, service_role;

alter table public.operator_log enable row level security;

create policy "Admin liest das Betreiber-Protokoll"
  on public.operator_log for select to authenticated
  using ((select private.is_admin()));
-- INSERT/UPDATE/DELETE: keine Policy und keine Rechte → nur Admin-Funktionen und Bereinigung

select cron.schedule(
  'purge-operator-log',
  '25 3 * * *',
  $$delete from public.operator_log where created_at < now() - interval '2 years'$$
);

-- ---------------------------------------------------------------------------
-- Bausteine
-- ---------------------------------------------------------------------------
create function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Nur für den Betreiber-Admin mit bestätigter 2FA.' using errcode = '42501';
  end if;
end;
$$;

create function private.log_operator(p_tenant_id uuid, p_tenant_name text, p_action text, p_target_email text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.operator_log (tenant_id, tenant_name, action, actor_id, actor_name, target_email)
  select p_tenant_id, p_tenant_name, p_action, (select auth.uid()),
         coalesce(p.display_name, p.email), p_target_email
  from (select 1) one
  left join public.profiles p on p.id = (select auth.uid());
$$;

-- Art der Einladung wie PROJ-4: Konto mit bestätigter Adresse → Hinweis-Mail, sonst Einladungsmail
create function private.invitation_kind_for(p_email text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when exists (
    select 1 from auth.users u where lower(btrim(u.email)) = p_email and u.email_confirmed_at is not null
  ) then 'existing_account' else 'new_account' end;
$$;

create function private.invitation_expiry(p_kind text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now() + case when p_kind = 'new_account' then interval '1 day' else interval '14 days' end;
$$;

-- Kunde sperren und lesen; nicht vorhanden → P0011, deaktiviert (falls verlangt) → P0016
create function private.lock_tenant(p_tenant_id uuid, p_require_active boolean default true)
returns public.tenants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants;
begin
  select * into v_tenant from public.tenants where id = p_tenant_id for update;
  if v_tenant.id is null then
    raise exception 'Diesen Kunden gibt es nicht mehr.' using errcode = 'P0011';
  end if;
  if p_require_active and v_tenant.status <> 'active' then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  return v_tenant;
end;
$$;

-- Inhaber-Einladung anlegen (gemeinsam für „Kunde anlegen“ und „Inhaber einladen“); gibt die Art zurück
create function private.insert_owner_invitation(p_tenant_id uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_kind text;
begin
  if exists (
    select 1 from public.memberships m join public.profiles p on p.id = m.user_id
    where m.tenant_id = p_tenant_id and lower(p.email) = v_email
  ) then
    raise exception 'Diese Person gehört bereits zu diesem Kunden.' using errcode = 'P0014';
  end if;
  v_kind := private.invitation_kind_for(v_email);
  insert into public.invitations (tenant_id, email, role, kind, invited_by, expires_at)
  values (p_tenant_id, v_email, 'owner', v_kind, (select auth.uid()), private.invitation_expiry(v_kind));
  return v_kind;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin-Aktionen
-- ---------------------------------------------------------------------------

-- Kunde + Inhaber-Einladung in einem Zug
create function private.admin_create_tenant(p_name text, p_email text, p_allow_duplicate boolean default false)
returns table (tenant_id uuid, kind text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_id uuid;
  v_kind text;
begin
  perform private.require_admin();
  if not coalesce(p_allow_duplicate, false)
     and exists (select 1 from public.tenants t where lower(t.name) = lower(v_name)) then
    raise exception 'Es gibt bereits einen Kunden mit diesem Namen.' using errcode = 'P0010';
  end if;
  insert into public.tenants (name) values (v_name) returning id into v_id;
  v_kind := private.insert_owner_invitation(v_id, p_email);
  perform private.log_operator(v_id, v_name, 'created', lower(btrim(p_email)));
  return query select v_id, v_kind;
end;
$$;

create function private.admin_invite_owner(p_tenant_id uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants;
  v_kind text;
begin
  perform private.require_admin();
  v_tenant := private.lock_tenant(p_tenant_id);
  v_kind := private.insert_owner_invitation(p_tenant_id, p_email);
  perform private.log_operator(p_tenant_id, v_tenant.name, 'invited', lower(btrim(p_email)));
  return v_kind;
end;
$$;

-- Erneut senden: Art neu bestimmen, Frist beginnt neu. Ist die Person inzwischen Mitglied,
-- wird die Einladung geschlossen (P0014). Gibt Adresse, Rolle, Art und Kundenname für den Mailversand zurück.
create function private.admin_resend_invitation(p_tenant_id uuid, p_invitation_id uuid)
returns table (email text, role public.member_role, kind text, tenant_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants;
  v_inv public.invitations;
  v_kind text;
begin
  perform private.require_admin();
  v_tenant := private.lock_tenant(p_tenant_id);
  select * into v_inv from public.invitations i
  where i.id = p_invitation_id and i.tenant_id = p_tenant_id and i.status = 'open'
  for update;
  if v_inv.id is null then
    raise exception 'Diese Einladung ist nicht mehr gültig.' using errcode = 'P0015';
  end if;
  if exists (
    select 1 from public.memberships m join public.profiles p on p.id = m.user_id
    where m.tenant_id = p_tenant_id and lower(p.email) = v_inv.email
  ) then
    update public.invitations set status = 'accepted', closed_at = now() where id = v_inv.id;
    raise exception 'Diese Person gehört bereits zu diesem Kunden.' using errcode = 'P0014';
  end if;
  v_kind := private.invitation_kind_for(v_inv.email);
  update public.invitations
  set kind = v_kind, sent_at = now(), expires_at = private.invitation_expiry(v_kind)
  where id = v_inv.id;
  perform private.log_operator(p_tenant_id, v_tenant.name, 'resent', v_inv.email);
  return query select v_inv.email, v_inv.role, v_kind, v_tenant.name;
end;
$$;

create function private.admin_revoke_invitation(p_tenant_id uuid, p_invitation_id uuid)
returns table (email text, kind text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants;
  v_inv public.invitations;
begin
  perform private.require_admin();
  v_tenant := private.lock_tenant(p_tenant_id);
  update public.invitations i
  set status = 'revoked', closed_at = now()
  where i.id = p_invitation_id and i.tenant_id = p_tenant_id and i.status = 'open'
  returning * into v_inv;
  if v_inv.id is null then
    raise exception 'Diese Einladung ist nicht mehr gültig.' using errcode = 'P0015';
  end if;
  perform private.log_operator(p_tenant_id, v_tenant.name, 'revoked', v_inv.email);
  return query select v_inv.email, v_inv.kind;
end;
$$;

-- promote: Mitarbeiter → Inhaber · demote: Inhaber → Mitarbeiter · remove: Inhaber entfernen.
-- Mitarbeiter entfernen bleibt bei den Inhabern (P0017); der letzte Inhaber ist durch den Trigger geschützt (P0001).
create function private.admin_change_member(p_tenant_id uuid, p_user_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants;
  v_member public.memberships;
  v_email text;
begin
  perform private.require_admin();
  v_tenant := private.lock_tenant(p_tenant_id);
  select * into v_member from public.memberships m
  where m.tenant_id = p_tenant_id and m.user_id = p_user_id
  for update;
  if v_member.id is null then
    raise exception 'Diese Person gehört nicht (mehr) zu diesem Kunden.' using errcode = 'P0017';
  end if;
  select p.email into v_email from public.profiles p where p.id = p_user_id;

  if p_action = 'promote' and v_member.role = 'staff' then
    update public.memberships set role = 'owner' where id = v_member.id;
    perform private.log_operator(p_tenant_id, v_tenant.name, 'promoted', v_email);
  elsif p_action = 'demote' and v_member.role = 'owner' then
    update public.memberships set role = 'staff' where id = v_member.id;
    perform private.log_operator(p_tenant_id, v_tenant.name, 'demoted', v_email);
  elsif p_action = 'remove' and v_member.role = 'owner' then
    delete from public.memberships where id = v_member.id;
    perform private.log_operator(p_tenant_id, v_tenant.name, 'removed', v_email);
  else
    raise exception 'Diese Aktion ist für diese Rolle nicht vorgesehen.' using errcode = 'P0017';
  end if;
end;
$$;

create function private.admin_set_tenant_status(p_tenant_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants;
  v_status public.tenant_status := case when p_active then 'active' else 'deactivated' end;
begin
  perform private.require_admin();
  v_tenant := private.lock_tenant(p_tenant_id, false);
  if v_tenant.status = v_status then
    return;
  end if;
  update public.tenants set status = v_status where id = p_tenant_id;
  perform private.log_operator(p_tenant_id, v_tenant.name, case when p_active then 'reactivated' else 'deactivated' end);
end;
$$;

-- Endgültig löschen: nur deaktivierte Kunden, nur mit exakt eingetipptem aktuellem Namen.
-- Gibt die Login-Konten zurück, die danach zu keinem Kunden mehr gehören, keine offene Einladung haben
-- und nicht Admin sind – die Server-Aktion löscht sie über die Supabase-Verwaltung.
create function private.admin_delete_tenant(p_tenant_id uuid, p_confirm_name text)
returns table (user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants;
  v_orphans uuid[];
begin
  perform private.require_admin();
  v_tenant := private.lock_tenant(p_tenant_id, false);
  if v_tenant.status <> 'deactivated' then
    raise exception 'Nur deaktivierte Kunden lassen sich endgültig löschen.' using errcode = 'P0012';
  end if;
  if btrim(coalesce(p_confirm_name, '')) <> btrim(v_tenant.name) then
    raise exception 'Der eingetippte Name stimmt nicht mit dem Kundennamen überein.' using errcode = 'P0013';
  end if;

  select coalesce(array_agg(m.user_id), '{}') into v_orphans
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  where m.tenant_id = p_tenant_id
    and not p.is_operator_admin
    and not exists (
      select 1 from public.memberships other where other.user_id = m.user_id and other.tenant_id <> p_tenant_id
    )
    and not exists (
      select 1 from public.invitations i
      where lower(i.email) = lower(p.email) and i.status = 'open' and i.tenant_id <> p_tenant_id
    );

  -- Kaskade: Mitgliedschaften, Einladungen und künftig alle Fachdaten mit tenant_id
  delete from public.tenants where id = p_tenant_id;
  -- Änderungsprotokoll dieses Kunden (auch die Einträge, die die Kaskade eben geschrieben hat)
  delete from public.audit_log where tenant_id = p_tenant_id;
  -- Betreiber-Protokoll: Personenangaben entfernen, Einträge als Nachweis behalten
  update public.operator_log set target_email = null where tenant_id = p_tenant_id;
  perform private.log_operator(p_tenant_id, v_tenant.name, 'deleted');

  return query select unnest(v_orphans);
end;
$$;

-- Kundenliste für den Admin: Suche (Name, Mitglieds- oder Einladungsadresse), Seiten, letzte Anmeldung
-- (aus der geschützten Login-Verwaltung). total = Anzahl aller Treffer.
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
    count(*) over ()
  from hits h
  order by lower(h.name), h.id
  limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

-- Gehört die angemeldete Person zu einem deaktivierten Kunden? (nur Auskunft über sich selbst)
create function private.belongs_to_deactivated_tenant()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m join public.tenants t on t.id = m.tenant_id
    where m.user_id = (select auth.uid()) and t.status = 'deactivated'
  );
$$;

-- ---------------------------------------------------------------------------
-- Rechte auf die internen Funktionen
-- ---------------------------------------------------------------------------
revoke execute on function private.require_admin() from public, anon;
revoke execute on function private.log_operator(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function private.invitation_kind_for(text) from public, anon, authenticated;
revoke execute on function private.invitation_expiry(text) from public, anon, authenticated;
revoke execute on function private.lock_tenant(uuid, boolean) from public, anon, authenticated;
revoke execute on function private.insert_owner_invitation(uuid, text) from public, anon, authenticated;
revoke execute on function private.admin_create_tenant(text, text, boolean) from public, anon;
revoke execute on function private.admin_invite_owner(uuid, text) from public, anon;
revoke execute on function private.admin_resend_invitation(uuid, uuid) from public, anon;
revoke execute on function private.admin_revoke_invitation(uuid, uuid) from public, anon;
revoke execute on function private.admin_change_member(uuid, uuid, text) from public, anon;
revoke execute on function private.admin_set_tenant_status(uuid, boolean) from public, anon;
revoke execute on function private.admin_delete_tenant(uuid, text) from public, anon;
revoke execute on function private.admin_tenant_overview(text, integer, integer) from public, anon;
revoke execute on function private.belongs_to_deactivated_tenant() from public, anon;

grant execute on function private.require_admin() to authenticated;
grant execute on function private.admin_create_tenant(text, text, boolean) to authenticated;
grant execute on function private.admin_invite_owner(uuid, text) to authenticated;
grant execute on function private.admin_resend_invitation(uuid, uuid) to authenticated;
grant execute on function private.admin_revoke_invitation(uuid, uuid) to authenticated;
grant execute on function private.admin_change_member(uuid, uuid, text) to authenticated;
grant execute on function private.admin_set_tenant_status(uuid, boolean) to authenticated;
grant execute on function private.admin_delete_tenant(uuid, text) to authenticated;
grant execute on function private.admin_tenant_overview(text, integer, integer) to authenticated;
grant execute on function private.belongs_to_deactivated_tenant() to authenticated;

-- ---------------------------------------------------------------------------
-- Öffentliche Hüllen (ohne Systemrechte) für die Server-Aktionen
-- ---------------------------------------------------------------------------
create function public.admin_create_tenant(p_name text, p_email text, p_allow_duplicate boolean default false)
returns table (tenant_id uuid, kind text)
language sql security invoker set search_path = ''
as $$ select * from private.admin_create_tenant(p_name, p_email, p_allow_duplicate); $$;

create function public.admin_invite_owner(p_tenant_id uuid, p_email text)
returns text
language sql security invoker set search_path = ''
as $$ select private.admin_invite_owner(p_tenant_id, p_email); $$;

create function public.admin_resend_invitation(p_tenant_id uuid, p_invitation_id uuid)
returns table (email text, role public.member_role, kind text, tenant_name text)
language sql security invoker set search_path = ''
as $$ select * from private.admin_resend_invitation(p_tenant_id, p_invitation_id); $$;

create function public.admin_revoke_invitation(p_tenant_id uuid, p_invitation_id uuid)
returns table (email text, kind text)
language sql security invoker set search_path = ''
as $$ select * from private.admin_revoke_invitation(p_tenant_id, p_invitation_id); $$;

create function public.admin_change_member(p_tenant_id uuid, p_user_id uuid, p_action text)
returns void
language sql security invoker set search_path = ''
as $$ select private.admin_change_member(p_tenant_id, p_user_id, p_action); $$;

create function public.admin_set_tenant_status(p_tenant_id uuid, p_active boolean)
returns void
language sql security invoker set search_path = ''
as $$ select private.admin_set_tenant_status(p_tenant_id, p_active); $$;

create function public.admin_delete_tenant(p_tenant_id uuid, p_confirm_name text)
returns table (user_id uuid)
language sql security invoker set search_path = ''
as $$ select * from private.admin_delete_tenant(p_tenant_id, p_confirm_name); $$;

create function public.admin_tenant_overview(p_query text default '', p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, name text, status public.tenant_status, created_at timestamptz, member_count integer,
  owners jsonb, invitations jsonb, last_sign_in_at timestamptz, total bigint
)
language sql stable security invoker set search_path = ''
as $$ select * from private.admin_tenant_overview(p_query, p_limit, p_offset); $$;

create function public.belongs_to_deactivated_tenant()
returns boolean
language sql stable security invoker set search_path = ''
as $$ select private.belongs_to_deactivated_tenant(); $$;

revoke execute on function public.admin_create_tenant(text, text, boolean) from public, anon;
revoke execute on function public.admin_invite_owner(uuid, text) from public, anon;
revoke execute on function public.admin_resend_invitation(uuid, uuid) from public, anon;
revoke execute on function public.admin_revoke_invitation(uuid, uuid) from public, anon;
revoke execute on function public.admin_change_member(uuid, uuid, text) from public, anon;
revoke execute on function public.admin_set_tenant_status(uuid, boolean) from public, anon;
revoke execute on function public.admin_delete_tenant(uuid, text) from public, anon;
revoke execute on function public.admin_tenant_overview(text, integer, integer) from public, anon;
revoke execute on function public.belongs_to_deactivated_tenant() from public, anon;
grant execute on function public.admin_create_tenant(text, text, boolean) to authenticated;
grant execute on function public.admin_invite_owner(uuid, text) to authenticated;
grant execute on function public.admin_resend_invitation(uuid, uuid) to authenticated;
grant execute on function public.admin_revoke_invitation(uuid, uuid) to authenticated;
grant execute on function public.admin_change_member(uuid, uuid, text) to authenticated;
grant execute on function public.admin_set_tenant_status(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_tenant(uuid, text) to authenticated;
grant execute on function public.admin_tenant_overview(text, integer, integer) to authenticated;
grant execute on function public.belongs_to_deactivated_tenant() to authenticated;
