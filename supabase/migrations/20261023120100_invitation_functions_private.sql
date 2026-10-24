-- PROJ-4: Funktionen mit Systemrechten aus der öffentlichen Schnittstelle nehmen (Advisor 0029).
-- Die Logik liegt jetzt in private.* (SECURITY DEFINER, nicht über die API erreichbar);
-- öffentlich bleiben nur dünne Hüllen ohne Systemrechte (SECURITY INVOKER), die sie aufrufen.

alter function public.my_open_invitations() set schema private;
alter function public.accept_invitation(uuid) set schema private;
alter function public.decline_invitation(uuid) set schema private;
alter function public.accept_new_account_invitations() set schema private;

revoke execute on function private.my_open_invitations() from public, anon;
revoke execute on function private.accept_invitation(uuid) from public, anon;
revoke execute on function private.decline_invitation(uuid) from public, anon;
revoke execute on function private.accept_new_account_invitations() from public, anon;
grant execute on function private.my_open_invitations() to authenticated;
grant execute on function private.accept_invitation(uuid) to authenticated;
grant execute on function private.decline_invitation(uuid) to authenticated;
grant execute on function private.accept_new_account_invitations() to authenticated;

create function public.my_open_invitations()
returns table (id uuid, tenant_name text, invited_by_name text, role public.member_role, expires_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_open_invitations(); $$;

create function public.accept_invitation(p_invitation_id uuid)
returns uuid
language sql security invoker set search_path = ''
as $$ select private.accept_invitation(p_invitation_id); $$;

create function public.decline_invitation(p_invitation_id uuid)
returns void
language sql security invoker set search_path = ''
as $$ select private.decline_invitation(p_invitation_id); $$;

create function public.accept_new_account_invitations()
returns uuid
language sql security invoker set search_path = ''
as $$ select private.accept_new_account_invitations(); $$;

revoke execute on function public.my_open_invitations() from public, anon;
revoke execute on function public.accept_invitation(uuid) from public, anon;
revoke execute on function public.decline_invitation(uuid) from public, anon;
revoke execute on function public.accept_new_account_invitations() from public, anon;
grant execute on function public.my_open_invitations() to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.decline_invitation(uuid) to authenticated;
grant execute on function public.accept_new_account_invitations() to authenticated;
