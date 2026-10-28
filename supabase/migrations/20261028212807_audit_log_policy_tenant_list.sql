-- Protokoll: Zugriffsregel ermittelt die Kunden des Inhabers einmal je Abfrage
-- statt private.has_role() für jede Zeile aufzurufen (Abfragen ohne Filter
-- liefen bei vielen Protokollzeilen in den statement_timeout).

-- IDs der aktiven Kunden, bei denen die angemeldete Person die Rolle hat
-- (gleiche Bedingungen wie private.has_role)
create function private.tenant_ids_with_role(p_role public.member_role)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.tenant_id
  from public.memberships m
  join public.tenants t on t.id = m.tenant_id
  where m.user_id = (select auth.uid())
    and m.role = p_role
    and t.status = 'active';
$$;

revoke execute on function private.tenant_ids_with_role(public.member_role) from public;
grant execute on function private.tenant_ids_with_role(public.member_role) to authenticated, service_role;

drop policy "Inhaber und Admin lesen das Protokoll" on public.audit_log;

create policy "Inhaber und Admin lesen das Protokoll"
  on public.audit_log for select to authenticated
  using (
    tenant_id in (select private.tenant_ids_with_role('owner'))
    or (select private.is_admin())
  );
