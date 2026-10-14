-- PROJ-1: Änderungsprotokoll für fachliche Tabellen
--
-- Neue Fachtabelle anschließen (Standardfelder + Protokoll):
--   select private.enable_tenant_table('public.<tabelle>');
-- Voraussetzung: Spalten id uuid, tenant_id uuid sowie die vier Standardfelder.
--
-- Serverseitige Prozesse (z. B. Channex-Import) können sich im Protokoll benennen:
--   select set_config('app.actor', 'channex-import', true);

create table public.audit_log (
  id bigint generated always as identity primary key,
  -- bewusst ohne Fremdschlüssel: das Protokoll überdauert gelöschte Datensätze
  tenant_id uuid not null,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_data jsonb,
  new_data jsonb,
  actor_id uuid,
  actor_label text not null,
  created_at timestamptz not null default now()
);
comment on table public.audit_log is 'Änderungsprotokoll. Nur lesbar für Inhaber und Admin; nur die automatische Bereinigung löscht.';

create index audit_log_tenant_created_idx on public.audit_log (tenant_id, created_at desc);
create index audit_log_record_idx on public.audit_log (table_name, record_id);
create index audit_log_created_idx on public.audit_log (created_at);

-- ---------------------------------------------------------------------------
-- Protokoll-Trigger
-- ---------------------------------------------------------------------------
create function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_column text := coalesce(tg_argv[0], 'tenant_id');
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_actor uuid := auth.uid();
begin
  insert into public.audit_log (
    tenant_id, table_name, record_id, action, old_data, new_data, actor_id, actor_label
  )
  values (
    (v_row ->> v_tenant_column)::uuid,
    tg_table_name,
    (v_row ->> 'id')::uuid,
    lower(tg_op),
    v_old,
    v_new,
    v_actor,
    case
      when v_actor is not null then 'user'
      else coalesce(nullif(current_setting('app.actor', true), ''), 'system')
    end
  );
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ein Befehl pro Fachtabelle: Standardfelder + Protokoll aktivieren
-- ---------------------------------------------------------------------------
create function private.enable_tenant_table(
  p_table regclass,
  p_tenant_column text default 'tenant_id'
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format(
    'create or replace trigger set_audit_fields before insert or update on %s '
    'for each row execute function private.set_audit_fields()',
    p_table
  );
  execute format(
    'create or replace trigger audit_row after insert or update or delete on %s '
    'for each row execute function private.audit_row(%L)',
    p_table, p_tenant_column
  );
end;
$$;

revoke execute on function private.enable_tenant_table(regclass, text) from public;

-- ---------------------------------------------------------------------------
-- DSGVO: personenbezogene Daten eines Datensatzes aus dem Protokoll entfernen
-- (wird von PROJ-7 bei der Löschung eines Gastes aufgerufen)
-- ---------------------------------------------------------------------------
create function private.purge_audit_personal_data(p_table_name text, p_record_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.audit_log
  set old_data = null, new_data = null
  where table_name = p_table_name
    and record_id = p_record_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function private.purge_audit_personal_data(text, uuid) from public;
grant execute on function private.purge_audit_personal_data(text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Rechte: niemand schreibt direkt – auch nicht der Secret Key
-- ---------------------------------------------------------------------------
revoke all on public.audit_log from anon, authenticated, service_role;
grant select on public.audit_log to authenticated, service_role;

alter table public.audit_log enable row level security;

create policy "Inhaber und Admin lesen das Protokoll"
  on public.audit_log for select to authenticated
  using (private.has_role(tenant_id, 'owner') or (select private.is_admin()));
-- INSERT/UPDATE/DELETE: keine Policy und keine Rechte → nur Trigger und Bereinigung

-- ---------------------------------------------------------------------------
-- Bestehende mandantenbezogene Tabellen anschließen
-- ---------------------------------------------------------------------------
select private.enable_tenant_table('public.tenants', 'id');
select private.enable_tenant_table('public.memberships');
