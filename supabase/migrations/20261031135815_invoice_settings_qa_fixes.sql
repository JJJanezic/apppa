-- PROJ-39, Korrekturen nach QA (BUG-3, BUG-6)

-- ---------------------------------------------------------------------------
-- BUG-6: Stand des Bausteininhalts getrennt vom allgemeinen Änderungsstempel. set_audit_fields setzt updated_at bei
-- jeder Änderung, auch beim Umschalten des Standards; die Konfliktprüfung beim Speichern meldete deshalb „inzwischen
-- geändert“, obwohl nur der Standard wechselte. content_updated_at ändert sich nur mit Name, Text oder Zahlungsregeln
-- (wie numbering_updated_at/texts_updated_at in invoice_settings). Bestehende Zeilen starten mit now(), ohne Update
-- (das würde Trigger und Protokoll für jede Zeile auslösen).
-- ---------------------------------------------------------------------------
alter table public.invoice_text_blocks add column content_updated_at timestamptz not null default now();
comment on column public.invoice_text_blocks.content_updated_at is
  'Stand von Name, Text und Zahlungsregeln (Konfliktprüfung beim Speichern); der Standard ändert ihn nicht.';

-- Baustein anlegen bzw. ändern: p_input.updated_at ist jetzt der Inhaltsstand (content_updated_at)
create or replace function private.save_invoice_text_block(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := nullif(p_input ->> 'tenant_id', '')::uuid;
  v_id uuid := nullif(p_input ->> 'id', '')::uuid;
  v_block text := p_input ->> 'block';
  v_name text := btrim(coalesce(p_input ->> 'name', ''));
  v_body jsonb := p_input -> 'body';
  v_percent numeric;
  v_deposit_days integer;
  v_due_days integer;
  v_due_basis text := nullif(p_input ->> 'due_basis', '');
  v_old public.invoice_text_blocks;
  v_changed text[] := '{}';
begin
  perform private.require_invoice_settings_editor(v_tenant);

  if v_id is not null then
    select * into v_old from public.invoice_text_blocks where id = v_id and tenant_id = v_tenant for update;
    if v_old.id is null then
      raise exception 'Der Baustein existiert nicht mehr.' using errcode = 'P0911';
    end if;
    if v_old.content_updated_at is distinct from (p_input ->> 'updated_at')::timestamptz then
      raise exception 'Der Baustein wurde inzwischen geändert.' using errcode = 'P0910';
    end if;
    -- Der Block eines Bausteins bleibt
    if v_block is distinct from v_old.block then
      raise exception 'Ungültiger Block.' using errcode = 'P0914';
    end if;
  end if;

  -- Zahlungsregeln: nur bei Zahlungsmodalitäten; Prozent 1–100 mit höchstens 2 Nachkommastellen
  if v_block = 'payment' then
    if jsonb_typeof(p_input -> 'deposit_percent') = 'number' then
      v_percent := (p_input #>> '{deposit_percent}')::numeric;
      if v_percent not between 1 and 100 or v_percent <> round(v_percent, 2) then
        raise exception 'Ungültige Anzahlung.' using errcode = 'P0914';
      end if;
      v_deposit_days := private.json_int(p_input -> 'deposit_days', 0, 365);
      if v_deposit_days is null then
        raise exception 'Ungültige Anzahlungsfrist.' using errcode = 'P0914';
      end if;
    elsif jsonb_typeof(coalesce(p_input -> 'deposit_percent', 'null'::jsonb)) <> 'null' then
      raise exception 'Ungültige Anzahlung.' using errcode = 'P0914';
    end if;
    v_due_days := private.json_int(p_input -> 'due_days', 0, 365);
    if v_due_days is null or coalesce(v_due_basis, '') not in ('after_invoice', 'before_arrival') then
      raise exception 'Ungültige Fälligkeit.' using errcode = 'P0914';
    end if;
  else
    v_due_basis := null;
  end if;

  if coalesce(v_block, '') not in ('intro', 'payment', 'closing') or length(v_name) not between 1 and 60
      or v_body is null or not private.rich_text_valid(v_body, 2000, private.invoice_placeholders(v_block, v_percent is not null)) then
    raise exception 'Ungültiger Baustein.' using errcode = 'P0914';
  end if;

  -- Name je Block eindeutig (ohne Groß-/Kleinschreibung)
  if exists (
    select 1 from public.invoice_text_blocks b
    where b.tenant_id = v_tenant and b.block = v_block and b.name_key = lower(v_name) and b.id is distinct from v_id
  ) then
    raise exception 'Dieser Name ist in diesem Block bereits vergeben.' using errcode = 'P0913';
  end if;

  begin
    if v_old.id is null then
      -- Höchstzahl je Block; die gesperrte Kundenzeile verhindert gleichzeitiges Überschreiten
      if (select count(*) from public.invoice_text_blocks b where b.tenant_id = v_tenant and b.block = v_block) >= 20 then
        raise exception 'Höchstzahl erreicht.' using errcode = 'P0912';
      end if;
      insert into public.invoice_text_blocks (tenant_id, block, name, body, deposit_percent, deposit_days, due_days, due_basis)
      values (v_tenant, v_block, v_name, v_body, v_percent, v_deposit_days, v_due_days, v_due_basis)
      returning id into v_id;
      perform private.log_invoice_settings(v_tenant, 'text_block_created', '{}', v_block, v_name);
    else
      if v_name is distinct from v_old.name then
        v_changed := v_changed || 'name'::text;
      end if;
      if v_body is distinct from v_old.body then
        v_changed := v_changed || 'body'::text;
      end if;
      if (v_percent, v_deposit_days, v_due_days, v_due_basis)
          is distinct from (v_old.deposit_percent, v_old.deposit_days::integer, v_old.due_days::integer, v_old.due_basis) then
        v_changed := v_changed || 'payment_rules'::text;
      end if;
      if cardinality(v_changed) = 0 then
        return v_id;
      end if;
      update public.invoice_text_blocks set
        name = v_name,
        body = v_body,
        deposit_percent = v_percent,
        deposit_days = v_deposit_days,
        due_days = v_due_days,
        due_basis = v_due_basis,
        content_updated_at = now()
      where id = v_id;
      perform private.log_invoice_settings(v_tenant, 'text_block_updated', v_changed, v_block, v_name);
    end if;
  exception when unique_violation then
    raise exception 'Dieser Name ist in diesem Block bereits vergeben.' using errcode = 'P0913';
  end;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- BUG-3: alle Rechnungsnummern eines Kunden für die Vorschau „Nächste Nummer“ (und den Vorschlag in PROJ-41).
-- Ein einzelner Array-Wert statt Zeilen: Die PostgREST-Grenze max_rows (1.000) greift nicht. Rechte des Aufrufers,
-- die RLS von invoices entscheidet, was sichtbar ist.
-- ---------------------------------------------------------------------------
create function public.invoice_numbers(p_tenant_id uuid)
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(i.number order by i.number), '{}') from public.invoices i where i.tenant_id = p_tenant_id;
$$;
revoke execute on function public.invoice_numbers(uuid) from public, anon;
grant execute on function public.invoice_numbers(uuid) to authenticated, service_role;
