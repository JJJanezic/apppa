-- PROJ-5 BUG-3 (QA): Beim endgültigen Löschen auch die offenen Einladungen an neue Personen melden.
-- Supabase legt beim Versand der Einladungsmail ein unbestätigtes Login-Konto an. Die Server-Aktion entfernt es
-- nach dem Löschen wie beim Zurückziehen einer Einladung (PROJ-4), sofern es sonst nirgends gebraucht wird;
-- der Link in der Einladungsmail führt dann ins Leere.
--
-- Rückgabe: je verwaistem Mitglied eine Zeile mit user_id, je offener Einladung an eine neue Person
-- eine Zeile mit invited_email (die andere Spalte jeweils null).

drop function public.admin_delete_tenant(uuid, text);
drop function private.admin_delete_tenant(uuid, text);

create function private.admin_delete_tenant(p_tenant_id uuid, p_confirm_name text)
returns table (user_id uuid, invited_email text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants;
  v_orphans uuid[];
  v_invitees text[];
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

  select coalesce(array_agg(distinct i.email), '{}') into v_invitees
  from public.invitations i
  where i.tenant_id = p_tenant_id and i.status = 'open' and i.kind = 'new_account';

  -- Kaskade: Mitgliedschaften, Einladungen und künftig alle Fachdaten mit tenant_id
  delete from public.tenants where id = p_tenant_id;
  -- Änderungsprotokoll dieses Kunden (auch die Einträge, die die Kaskade eben geschrieben hat)
  delete from public.audit_log where tenant_id = p_tenant_id;
  -- Betreiber-Protokoll: Personenangaben entfernen, Einträge als Nachweis behalten
  update public.operator_log set target_email = null where tenant_id = p_tenant_id;
  perform private.log_operator(p_tenant_id, v_tenant.name, 'deleted');

  return query
    select o, null::text from unnest(v_orphans) as o
    union all
    select null::uuid, e from unnest(v_invitees) as e;
end;
$$;

create function public.admin_delete_tenant(p_tenant_id uuid, p_confirm_name text)
returns table (user_id uuid, invited_email text)
language sql security invoker set search_path = ''
as $$ select * from private.admin_delete_tenant(p_tenant_id, p_confirm_name); $$;

revoke execute on function private.admin_delete_tenant(uuid, text) from public, anon;
revoke execute on function public.admin_delete_tenant(uuid, text) from public, anon;
grant execute on function private.admin_delete_tenant(uuid, text) to authenticated;
grant execute on function public.admin_delete_tenant(uuid, text) to authenticated;
