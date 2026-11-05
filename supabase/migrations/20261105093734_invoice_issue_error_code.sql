-- PROJ-42: Eigener Fehlercode für die Löschsperre. P0017 bedeutet schon „Aktion für diese Rolle nicht vorgesehen“.
-- Sonst unverändert gegenüber 20261105093618_invoice_issue.sql.
create or replace function private.admin_delete_tenant(p_tenant_id uuid, p_confirm_name text)
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
  if exists (
    select 1 from public.invoices i
    where i.tenant_id = p_tenant_id and i.origin = 'issued'
      and i.invoice_date >= make_date(extract(year from private.today_vienna())::integer - 7, 1, 1)
  ) then
    raise exception 'Ausgestellte Rechnungen fallen noch unter die Aufbewahrungspflicht.' using errcode = 'P0019';
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
