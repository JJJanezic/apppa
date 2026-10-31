-- PROJ-39: Einstellungen → Rechnungen
-- * Tabelle invoice_settings (eine Zeile je Kunde): Nummernkreis, Kleinunternehmer-Hinweis, Fußzeile, Schalter
--   „Rechnungen nacherfassen“ (aus tenants hierher verschoben). Ein Änderungsstempel je Abschnitt.
-- * Tabelle invoice_text_blocks: Textbausteine der Blöcke 4 (intro), 6 (payment, mit Zahlungsregeln) und 7 (closing),
--   höchstens 20 je Block, Name je Block eindeutig, höchstens ein Standard je Block.
-- * Formatierter Text als kleine JSON-Struktur (Teilmenge des Tiptap-Formats, nie HTML); die Datenbank prüft Struktur,
--   Länge und Platzhalter (gleiche Regeln wie src/lib/rich-text.ts und src/lib/invoice-texts.ts).
-- * Lesen: Inhaber des Kunden und Admin mit 2FA (Mitarbeiter nicht). Schreiben nur über die Funktionen
--   save_invoice_numbering, save_invoice_fixed_texts, save_invoice_backfill, save_invoice_text_block,
--   set_invoice_text_block_default, delete_invoice_text_block; sie schreiben das Betreiber-Protokoll (ohne Text).
-- * Vorbelegung für bestehende Kunden und automatisch für jeden neuen Kunden (Trigger auf tenants).
-- * save_invoice (PROJ-37) und update_tenant_master_data (PROJ-38) ohne tenants.invoice_backfill_enabled.
-- Fehlercodes: P0910 Stand veraltet, P0911 Baustein nicht vorhanden, P0912 Höchstzahl, P0913 Name vergeben,
-- P0914 Inhalt ungültig; P0011/P0016 aus private.lock_tenant; 42501 keine Berechtigung.

-- ---------------------------------------------------------------------------
-- Formatierter Text: Prüfung
-- doc → paragraph | bulletList | orderedList; listItem → paragraph+; Inline: text (nicht leer, marks nur bold/italic,
-- je höchstens einmal) | hardBreak; keine weiteren Schlüssel.
-- ---------------------------------------------------------------------------
-- Array oder leeres Array (damit die Prüfung bei falschen Typen „ungültig“ meldet statt abzubrechen)
create function private.rich_array(p_value jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_value) = 'array' then p_value else '[]'::jsonb end;
$$;

-- Objekt nur mit den erlaubten Schlüsseln
create function private.rich_keys_ok(p_node jsonb, p_allowed text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_node) is distinct from 'object' then false
    else not exists (select 1 from jsonb_object_keys(p_node) k where k <> all (p_allowed))
  end;
$$;

create function private.rich_inline_ok(p_node jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_node) is distinct from 'object' then false
    when p_node ->> 'type' = 'hardBreak' then private.rich_keys_ok(p_node, array['type'])
    when p_node ->> 'type' = 'text' then
      private.rich_keys_ok(p_node, array['type', 'text', 'marks'])
      and jsonb_typeof(p_node -> 'text') = 'string'
      and length(p_node ->> 'text') > 0
      and (
        not (p_node ? 'marks')
        or (
          jsonb_typeof(p_node -> 'marks') = 'array'
          and not exists (
            select 1 from jsonb_array_elements(private.rich_array(p_node -> 'marks')) m
            where not private.rich_keys_ok(m, array['type']) or coalesce(m ->> 'type', '') not in ('bold', 'italic')
          )
          and (select count(distinct m ->> 'type') from jsonb_array_elements(private.rich_array(p_node -> 'marks')) m)
            = jsonb_array_length(private.rich_array(p_node -> 'marks'))
        )
      )
    else false
  end;
$$;

create function private.rich_paragraph_ok(p_node jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select private.rich_keys_ok(p_node, array['type', 'content'])
    and p_node ->> 'type' = 'paragraph'
    and (
      not (p_node ? 'content')
      or (
        jsonb_typeof(p_node -> 'content') = 'array'
        and not exists (
          select 1 from jsonb_array_elements(private.rich_array(p_node -> 'content')) n where not private.rich_inline_ok(n)
        )
      )
    );
$$;

create function private.rich_list_ok(p_node jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select private.rich_keys_ok(p_node, array['type', 'content'])
    and coalesce(p_node ->> 'type', '') in ('bulletList', 'orderedList')
    and jsonb_array_length(private.rich_array(p_node -> 'content')) > 0
    and not exists (
      select 1 from jsonb_array_elements(private.rich_array(p_node -> 'content')) i
      where not (
        private.rich_keys_ok(i, array['type', 'content'])
        and i ->> 'type' = 'listItem'
        and jsonb_array_length(private.rich_array(i -> 'content')) > 0
        and not exists (
          select 1 from jsonb_array_elements(private.rich_array(i -> 'content')) p where not private.rich_paragraph_ok(p)
        )
      )
    );
$$;

create function private.rich_doc_ok(p_doc jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select private.rich_keys_ok(p_doc, array['type', 'content'])
    and p_doc ->> 'type' = 'doc'
    and jsonb_typeof(p_doc -> 'content') = 'array'
    and not exists (
      select 1 from jsonb_array_elements(private.rich_array(p_doc -> 'content')) b
      where not (private.rich_paragraph_ok(b) or private.rich_list_ok(b))
    );
$$;

-- Textzeilen (Absätze und Listenpunkte) eines Dokuments; Umbruch = Zeilenumbruch. Reihenfolge der Zeilen egal,
-- innerhalb einer Zeile in Textreihenfolge (ein Platzhalter kann über Formatierungen reichen).
create function private.rich_paragraphs(p_doc jsonb)
returns setof text
language sql
immutable
set search_path = ''
as $$
  with paras as (
    select b.value as p
    from jsonb_array_elements(private.rich_array(p_doc -> 'content')) b
    where b.value ->> 'type' = 'paragraph'
    union all
    select p.value
    from jsonb_array_elements(private.rich_array(p_doc -> 'content')) b
    cross join lateral jsonb_array_elements(private.rich_array(b.value -> 'content')) i
    cross join lateral jsonb_array_elements(private.rich_array(i.value -> 'content')) p
    where b.value ->> 'type' in ('bulletList', 'orderedList')
  )
  select coalesce((
    select string_agg(case when n.value ->> 'type' = 'text' then n.value ->> 'text' else E'\n' end, '' order by n.ord)
    from jsonb_array_elements(private.rich_array(paras.p -> 'content')) with ordinality n(value, ord)
  ), '')
  from paras;
$$;

-- Platzhalter je Block (gleiche Liste wie PLACEHOLDERS in src/lib/invoice-texts.ts); andere Werte = keine
create function private.invoice_placeholders(p_block text, p_deposit boolean)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when p_block in ('intro', 'closing') then
      array['Anrede', 'Gast', 'Wohnung', 'Anreise', 'Abreise', 'Nächte', 'Rechnungsnummer', 'Rechnungsdatum', 'Betrag']
    when p_block = 'payment' then
      array['Anrede', 'Gast', 'Wohnung', 'Anreise', 'Abreise', 'Nächte', 'Rechnungsnummer', 'Rechnungsdatum', 'Betrag',
        'Fälligkeitsdatum']
      || case when p_deposit then array['Anzahlung', 'Anzahlung fällig', 'Restbetrag'] else array[]::text[] end
    else array[]::text[]
  end;
$$;

-- Ist der Text leer (nur Leerraum, Formatierung oder Leerzeilen)?
create function private.rich_doc_empty(p_doc jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(regexp_replace(string_agg(t, ''), E'[[:space:] ]', '', 'g'), '') = ''
  from private.rich_paragraphs(p_doc) t;
$$;

-- Gültiger, nicht leerer Text mit höchstens p_max Zeichen (ohne Umbrüche) und nur erlaubten Platzhaltern
create function private.rich_text_valid(p_doc jsonb, p_max integer, p_allowed text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when not coalesce(private.rich_doc_ok(p_doc), false) then false
    when private.rich_doc_empty(p_doc) then false
    when (select coalesce(sum(length(replace(t, E'\n', ''))), 0) from private.rich_paragraphs(p_doc) t) > p_max then false
    else not exists (
      select 1
      from private.rich_paragraphs(p_doc) t
      cross join lateral regexp_matches(t, '\{([^{}\n]{1,40})\}', 'g') m
      where m[1] <> all (p_allowed)
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------
create table public.invoice_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Nummernkreis: [Präfix][JJJJ][Trennzeichen][laufende Nummer]
  number_prefix text not null default '' check (number_prefix ~ '^[A-Za-z0-9/_.-]{0,10}$'),
  number_with_year boolean not null default true,
  number_separator text not null default '-' check (number_separator in ('-', '/', '.', '')),
  number_digits smallint not null default 4 check (number_digits between 3 and 6),
  number_yearly_reset boolean not null default true,
  number_start integer not null default 1 check (number_start between 1 and 999999999),
  number_start_year smallint check (number_start_year between 2000 and 2200),
  numbering_updated_at timestamptz not null default now(),
  -- Feste Texte (keine Platzhalter)
  small_business_note jsonb not null check (private.rich_text_valid(small_business_note, 500, array[]::text[])),
  footer jsonb check (footer is null or private.rich_text_valid(footer, 2000, array[]::text[])),
  texts_updated_at timestamptz not null default now(),
  -- Schalter „Rechnungen nacherfassen“ (PROJ-37)
  backfill_enabled boolean not null default true,
  backfill_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint invoice_settings_tenant_key unique (tenant_id),
  constraint invoice_settings_yearly_check check (not number_yearly_reset or number_with_year)
);
comment on table public.invoice_settings is
  'Rechnungseinstellungen je Kunde (PROJ-39). Lesen: Inhaber und Admin; Schreiben nur über die save_invoice_*-Funktionen.';
comment on column public.invoice_settings.number_start_year is 'Jahr, in dem die Startnummer eingetragen wurde; bei „jährlich neu“ gilt sie nur dann.';
comment on column public.invoice_settings.backfill_enabled is
  'Knopf „Rechnung nacherfassen“ anzeigen (PROJ-37, bis PROJ-39 in tenants). Wirkt nur auf das Anlegen.';

create table public.invoice_text_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  block text not null check (block in ('intro', 'payment', 'closing')),
  name text not null check (name = btrim(name) and length(name) between 1 and 60),
  name_key text generated always as (lower(name)) stored,
  body jsonb not null,
  is_default boolean not null default false,
  -- Zahlungsregeln (nur Zahlungsmodalitäten): Anzahlung optional, Fälligkeit Pflicht
  deposit_percent numeric(5, 2) check (deposit_percent between 1 and 100),
  deposit_days smallint check (deposit_days between 0 and 365),
  due_days smallint check (due_days between 0 and 365),
  due_basis text check (due_basis in ('after_invoice', 'before_arrival')),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint invoice_text_blocks_name_key unique (tenant_id, block, name_key),
  constraint invoice_text_blocks_deposit_check check ((deposit_percent is null) = (deposit_days is null)),
  constraint invoice_text_blocks_payment_check check (
    case when block = 'payment' then due_days is not null and due_basis is not null
    else deposit_percent is null and due_days is null and due_basis is null end
  ),
  constraint invoice_text_blocks_body_check check (
    private.rich_text_valid(body, 2000, private.invoice_placeholders(block, deposit_percent is not null))
  )
);
comment on table public.invoice_text_blocks is
  'Textbausteine der Rechnung (PROJ-39): intro = Block 4, payment = Block 6 mit Zahlungsregeln, closing = Block 7.';

-- höchstens ein Standard je Kunde und Block
create unique index invoice_text_blocks_default_key on public.invoice_text_blocks (tenant_id, block) where is_default;

revoke all on public.invoice_settings from anon, authenticated;
revoke all on public.invoice_text_blocks from anon, authenticated;
grant select on public.invoice_settings to authenticated;
grant select on public.invoice_text_blocks to authenticated;

alter table public.invoice_settings enable row level security;
alter table public.invoice_text_blocks enable row level security;

create policy "Inhaber und Admin lesen Rechnungseinstellungen" on public.invoice_settings for select to authenticated
  using (private.has_role(tenant_id, 'owner') or (select private.is_admin()));
create policy "Inhaber und Admin lesen Textbausteine" on public.invoice_text_blocks for select to authenticated
  using (private.has_role(tenant_id, 'owner') or (select private.is_admin()));
-- kein insert/update/delete: nur über die Funktionen unten

select private.enable_tenant_table('public.invoice_settings');
select private.enable_tenant_table('public.invoice_text_blocks');

-- ---------------------------------------------------------------------------
-- Betreiber-Protokoll: Rechnungseinstellungen und Textbausteine (Block und Name, nie der Text)
-- ---------------------------------------------------------------------------
alter table public.operator_log add column target_block text, add column target_label text;
alter table public.operator_log drop constraint operator_log_action_check;
alter table public.operator_log add constraint operator_log_action_check check (action in (
  'created', 'invited', 'resent', 'revoked', 'promoted', 'demoted', 'removed', 'deactivated', 'reactivated', 'deleted',
  'master_data', 'invoice_settings', 'text_block_created', 'text_block_updated', 'text_block_deleted'
));
comment on column public.operator_log.target_block is 'Textbausteine (PROJ-39): Block intro/payment/closing.';
comment on column public.operator_log.target_label is 'Textbausteine (PROJ-39): Name des Bausteins.';

create function private.log_invoice_settings(
  p_tenant_id uuid, p_action text, p_fields text[], p_block text default null, p_label text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.operator_log (tenant_id, tenant_name, action, actor_id, actor_name, changed_fields, target_block, target_label)
  select t.id, t.name, p_action, (select auth.uid()), coalesce(p.display_name, p.email), p_fields, p_block, p_label
  from public.tenants t
  left join public.profiles p on p.id = (select auth.uid())
  where t.id = p_tenant_id;
$$;

-- ---------------------------------------------------------------------------
-- Vorbelegung (eigene Kopie je Kunde; spätere Änderungen hier wirken nicht auf bestehende Kunden)
-- ---------------------------------------------------------------------------
create function private.rich_doc_from_text(p_text text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', p_text)))
  ));
$$;

create function private.seed_invoice_settings(p_tenant_id uuid, p_backfill boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.invoice_settings (tenant_id, small_business_note, backfill_enabled)
  values (
    p_tenant_id,
    private.rich_doc_from_text('Umsatzsteuerfrei aufgrund der Kleinunternehmerregelung gemäß § 6 Abs. 1 Z 27 UStG'),
    p_backfill
  )
  on conflict (tenant_id) do nothing;
  if not found then
    return;
  end if;

  insert into public.invoice_text_blocks (tenant_id, block, name, body, is_default, deposit_percent, deposit_days, due_days, due_basis)
  values
    (p_tenant_id, 'intro', 'Dank für den Aufenthalt', private.rich_doc_from_text(
      '{Anrede}, vielen Dank für Ihren Aufenthalt in {Wohnung} vom {Anreise} bis {Abreise}. Wir erlauben uns, wie folgt zu verrechnen:'
    ), true, null, null, null, null),
    (p_tenant_id, 'payment', 'Überweisung 14 Tage', private.rich_doc_from_text(
      'Bitte überweisen Sie den Betrag von {Betrag} bis {Fälligkeitsdatum}.'
    ), true, null, null, 14, 'after_invoice'),
    (p_tenant_id, 'payment', 'Anzahlung 20 %, Rest vor Anreise', private.rich_doc_from_text(
      'Bitte überweisen Sie die Anzahlung von {Anzahlung} bis {Anzahlung fällig}, damit Ihre Buchung fix ist. '
      || 'Den Restbetrag von {Restbetrag} bitten wir bis {Fälligkeitsdatum} zu begleichen.'
    ), false, 20, 3, 1, 'before_arrival'),
    (p_tenant_id, 'closing', 'Nächster Besuch', private.rich_doc_from_text('Wir freuen uns auf Ihren nächsten Besuch!'),
      true, null, null, null, null);
end;
$$;

create function private.seed_invoice_settings_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_invoice_settings(new.id);
  return new;
end;
$$;

create trigger seed_invoice_settings after insert on public.tenants
  for each row execute function private.seed_invoice_settings_trigger();

-- Bestehende Kunden: Schalter-Zustand übernehmen
select private.seed_invoice_settings(t.id, t.invoice_backfill_enabled) from public.tenants t;

-- ---------------------------------------------------------------------------
-- Gemeinsame Prüfung der Funktionen: Inhaber dieses (aktiven) Kunden oder Admin mit 2FA; Kunde aktiv.
-- Sperrt die Kundenzeile bis zum Ende des Vorgangs (gleichzeitige Änderungen laufen nacheinander).
-- ---------------------------------------------------------------------------
create function private.require_invoice_settings_editor(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_tenant_id is null or not (private.is_admin() or private.has_role(p_tenant_id, 'owner')) then
    raise exception 'Keine Berechtigung für diese Rechnungseinstellungen.' using errcode = '42501';
  end if;
  perform private.lock_tenant(p_tenant_id, true);
end;
$$;

-- Ganze Zahl aus JSON in einem Bereich, sonst null
create function private.json_int(p_value jsonb, p_min integer, p_max integer)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v numeric;
begin
  if jsonb_typeof(p_value) is distinct from 'number' then
    return null;
  end if;
  v := (p_value #>> '{}')::numeric;
  if v <> trunc(v) or v < p_min or v > p_max then
    return null;
  end if;
  return v::integer;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nummernkreis speichern
-- p_data: prefix, with_year, separator, digits, yearly_reset, start
-- ---------------------------------------------------------------------------
create function private.save_invoice_numbering(p_tenant_id uuid, p_expected_updated_at timestamptz, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.invoice_settings;
  v_prefix text := btrim(coalesce(p_data ->> 'prefix', ''));
  v_with_year boolean;
  v_separator text := p_data ->> 'separator';
  v_digits integer := private.json_int(p_data -> 'digits', 3, 6);
  v_yearly boolean;
  v_start integer := private.json_int(p_data -> 'start', 1, 999999999);
  v_start_year smallint;
begin
  perform private.require_invoice_settings_editor(p_tenant_id);
  select * into v_old from public.invoice_settings where tenant_id = p_tenant_id for update;
  if v_old.id is null then
    raise exception 'Diesen Kunden gibt es nicht mehr.' using errcode = 'P0011';
  end if;
  if v_old.numbering_updated_at is distinct from p_expected_updated_at then
    raise exception 'Die Einstellungen wurden inzwischen geändert.' using errcode = 'P0910';
  end if;

  if jsonb_typeof(p_data -> 'with_year') is distinct from 'boolean' or jsonb_typeof(p_data -> 'yearly_reset') is distinct from 'boolean'
      or v_prefix !~ '^[A-Za-z0-9/_.-]{0,10}$' or coalesce(v_separator, '#') not in ('-', '/', '.', '')
      or v_digits is null or v_start is null then
    raise exception 'Ungültiger Nummernkreis.' using errcode = 'P0914';
  end if;
  v_with_year := (p_data ->> 'with_year')::boolean;
  v_yearly := (p_data ->> 'yearly_reset')::boolean;
  if v_yearly and not v_with_year then
    raise exception 'Jährlich neu beginnen geht nur mit Jahreszahl.' using errcode = 'P0914';
  end if;

  -- Eine geänderte Startnummer gilt ab dem Jahr, in dem sie eingetragen wird
  v_start_year := case when v_start is distinct from v_old.number_start
    then extract(year from private.today_vienna())::smallint else v_old.number_start_year end;

  -- Speichern ohne Änderung: kein Fehler, kein Protokolleintrag
  if (v_prefix, v_with_year, v_separator, v_digits, v_yearly, v_start)
      is not distinct from (v_old.number_prefix, v_old.number_with_year, v_old.number_separator, v_old.number_digits::integer,
        v_old.number_yearly_reset, v_old.number_start) then
    return;
  end if;

  update public.invoice_settings set
    number_prefix = v_prefix,
    number_with_year = v_with_year,
    number_separator = v_separator,
    number_digits = v_digits,
    number_yearly_reset = v_yearly,
    number_start = v_start,
    number_start_year = v_start_year,
    numbering_updated_at = now()
  where id = v_old.id;

  perform private.log_invoice_settings(p_tenant_id, 'invoice_settings', array['numbering']);
end;
$$;

-- ---------------------------------------------------------------------------
-- Feste Texte speichern. p_data: small_business_note (Pflicht), footer (null oder leer = keine Fußzeile)
-- ---------------------------------------------------------------------------
create function private.save_invoice_fixed_texts(p_tenant_id uuid, p_expected_updated_at timestamptz, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.invoice_settings;
  v_note jsonb := p_data -> 'small_business_note';
  v_footer jsonb := case when jsonb_typeof(p_data -> 'footer') = 'object' then p_data -> 'footer' end;
  v_changed text[] := '{}';
begin
  perform private.require_invoice_settings_editor(p_tenant_id);
  select * into v_old from public.invoice_settings where tenant_id = p_tenant_id for update;
  if v_old.id is null then
    raise exception 'Diesen Kunden gibt es nicht mehr.' using errcode = 'P0011';
  end if;
  if v_old.texts_updated_at is distinct from p_expected_updated_at then
    raise exception 'Die Einstellungen wurden inzwischen geändert.' using errcode = 'P0910';
  end if;

  -- leere Fußzeile = keine Fußzeile
  if v_footer is not null then
    if private.rich_doc_ok(v_footer) then
      if private.rich_doc_empty(v_footer) then
        v_footer := null;
      end if;
    end if;
  end if;
  if v_note is null or not private.rich_text_valid(v_note, 500, array[]::text[])
      or coalesce(jsonb_typeof(p_data -> 'footer'), 'null') not in ('object', 'null')
      or (v_footer is not null and not private.rich_text_valid(v_footer, 2000, array[]::text[])) then
    raise exception 'Ungültiger Text.' using errcode = 'P0914';
  end if;

  if v_note is distinct from v_old.small_business_note then
    v_changed := v_changed || 'small_business_note'::text;
  end if;
  if v_footer is distinct from v_old.footer then
    v_changed := v_changed || 'footer'::text;
  end if;
  if cardinality(v_changed) = 0 then
    return;
  end if;

  update public.invoice_settings set small_business_note = v_note, footer = v_footer, texts_updated_at = now()
  where id = v_old.id;

  perform private.log_invoice_settings(p_tenant_id, 'invoice_settings', v_changed);
end;
$$;

-- ---------------------------------------------------------------------------
-- Schalter „Rechnungen nacherfassen“ speichern
-- ---------------------------------------------------------------------------
create function private.save_invoice_backfill(p_tenant_id uuid, p_expected_updated_at timestamptz, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.invoice_settings;
begin
  perform private.require_invoice_settings_editor(p_tenant_id);
  if p_enabled is null then
    raise exception 'Ungültiger Schalter.' using errcode = 'P0914';
  end if;
  select * into v_old from public.invoice_settings where tenant_id = p_tenant_id for update;
  if v_old.id is null then
    raise exception 'Diesen Kunden gibt es nicht mehr.' using errcode = 'P0011';
  end if;
  if v_old.backfill_updated_at is distinct from p_expected_updated_at then
    raise exception 'Die Einstellungen wurden inzwischen geändert.' using errcode = 'P0910';
  end if;
  if v_old.backfill_enabled = p_enabled then
    return;
  end if;

  update public.invoice_settings set backfill_enabled = p_enabled, backfill_updated_at = now() where id = v_old.id;
  perform private.log_invoice_settings(p_tenant_id, 'invoice_settings', array['backfill']);
end;
$$;

-- ---------------------------------------------------------------------------
-- Baustein anlegen (id null) bzw. ändern (id + updated_at). Der Standard wird getrennt gesetzt.
-- p_input: tenant_id, id, updated_at, block, name, body, deposit_percent, deposit_days, due_days, due_basis
-- Ergebnis: id des Bausteins
-- ---------------------------------------------------------------------------
create function private.save_invoice_text_block(p_input jsonb)
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
    if v_old.updated_at is distinct from (p_input ->> 'updated_at')::timestamptz then
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
        due_basis = v_due_basis
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
-- Standard setzen (p_block_id) bzw. aufheben (null). p_expected_default_id: Standard des Blocks beim Laden;
-- hat er sich inzwischen geändert, gilt der Stand als veraltet (P0910).
-- ---------------------------------------------------------------------------
create function private.set_invoice_text_block_default(
  p_tenant_id uuid, p_block text, p_block_id uuid, p_expected_default_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.invoice_text_blocks;
  v_target public.invoice_text_blocks;
begin
  perform private.require_invoice_settings_editor(p_tenant_id);
  if coalesce(p_block, '') not in ('intro', 'payment', 'closing') then
    raise exception 'Ungültiger Block.' using errcode = 'P0914';
  end if;

  select * into v_current from public.invoice_text_blocks
  where tenant_id = p_tenant_id and block = p_block and is_default for update;
  if v_current.id is distinct from p_expected_default_id then
    raise exception 'Die Einstellungen wurden inzwischen geändert.' using errcode = 'P0910';
  end if;
  if p_block_id is not null then
    select * into v_target from public.invoice_text_blocks
    where id = p_block_id and tenant_id = p_tenant_id and block = p_block for update;
    if v_target.id is null then
      raise exception 'Der Baustein existiert nicht mehr.' using errcode = 'P0911';
    end if;
  end if;
  if v_current.id is not distinct from p_block_id then
    return;
  end if;

  if v_current.id is not null then
    update public.invoice_text_blocks set is_default = false where id = v_current.id;
  end if;
  if v_target.id is not null then
    update public.invoice_text_blocks set is_default = true where id = v_target.id;
    perform private.log_invoice_settings(p_tenant_id, 'text_block_updated', array['is_default'], v_target.block, v_target.name);
  else
    perform private.log_invoice_settings(p_tenant_id, 'text_block_updated', array['is_default'], v_current.block, v_current.name);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Baustein löschen; war er der Standard, hat der Block danach keinen
-- ---------------------------------------------------------------------------
create function private.delete_invoice_text_block(p_tenant_id uuid, p_block_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_block public.invoice_text_blocks;
begin
  perform private.require_invoice_settings_editor(p_tenant_id);
  delete from public.invoice_text_blocks where id = p_block_id and tenant_id = p_tenant_id returning * into v_block;
  if v_block.id is null then
    raise exception 'Der Baustein existiert nicht mehr.' using errcode = 'P0911';
  end if;
  perform private.log_invoice_settings(p_tenant_id, 'text_block_deleted', '{}', v_block.block, v_block.name);
end;
$$;

-- ---------------------------------------------------------------------------
-- Öffentliche Hüllen (ohne Systemrechte) für die Server-Aktionen
-- ---------------------------------------------------------------------------
create function public.save_invoice_numbering(p_tenant_id uuid, p_expected_updated_at timestamptz, p_data jsonb)
returns void
language sql security invoker set search_path = ''
as $$ select private.save_invoice_numbering(p_tenant_id, p_expected_updated_at, p_data); $$;

create function public.save_invoice_fixed_texts(p_tenant_id uuid, p_expected_updated_at timestamptz, p_data jsonb)
returns void
language sql security invoker set search_path = ''
as $$ select private.save_invoice_fixed_texts(p_tenant_id, p_expected_updated_at, p_data); $$;

create function public.save_invoice_backfill(p_tenant_id uuid, p_expected_updated_at timestamptz, p_enabled boolean)
returns void
language sql security invoker set search_path = ''
as $$ select private.save_invoice_backfill(p_tenant_id, p_expected_updated_at, p_enabled); $$;

create function public.save_invoice_text_block(p_input jsonb)
returns uuid
language sql security invoker set search_path = ''
as $$ select private.save_invoice_text_block(p_input); $$;

create function public.set_invoice_text_block_default(p_tenant_id uuid, p_block text, p_block_id uuid, p_expected_default_id uuid)
returns void
language sql security invoker set search_path = ''
as $$ select private.set_invoice_text_block_default(p_tenant_id, p_block, p_block_id, p_expected_default_id); $$;

create function public.delete_invoice_text_block(p_tenant_id uuid, p_block_id uuid)
returns void
language sql security invoker set search_path = ''
as $$ select private.delete_invoice_text_block(p_tenant_id, p_block_id); $$;

-- Hilfsfunktionen: auch die Prüfregeln der Tabellen nutzen sie
revoke execute on function private.rich_array(jsonb) from public, anon;
revoke execute on function private.rich_list_ok(jsonb) from public, anon;
revoke execute on function private.rich_keys_ok(jsonb, text[]) from public, anon;
revoke execute on function private.rich_inline_ok(jsonb) from public, anon;
revoke execute on function private.rich_paragraph_ok(jsonb) from public, anon;
revoke execute on function private.rich_doc_ok(jsonb) from public, anon;
revoke execute on function private.rich_paragraphs(jsonb) from public, anon;
revoke execute on function private.invoice_placeholders(text, boolean) from public, anon;
revoke execute on function private.rich_doc_empty(jsonb) from public, anon;
revoke execute on function private.rich_text_valid(jsonb, integer, text[]) from public, anon;
revoke execute on function private.rich_doc_from_text(text) from public, anon;
revoke execute on function private.json_int(jsonb, integer, integer) from public, anon;
grant execute on function private.rich_array(jsonb) to authenticated, service_role;
grant execute on function private.rich_list_ok(jsonb) to authenticated, service_role;
grant execute on function private.rich_keys_ok(jsonb, text[]) to authenticated, service_role;
grant execute on function private.rich_inline_ok(jsonb) to authenticated, service_role;
grant execute on function private.rich_paragraph_ok(jsonb) to authenticated, service_role;
grant execute on function private.rich_doc_ok(jsonb) to authenticated, service_role;
grant execute on function private.rich_paragraphs(jsonb) to authenticated, service_role;
grant execute on function private.invoice_placeholders(text, boolean) to authenticated, service_role;
grant execute on function private.rich_doc_empty(jsonb) to authenticated, service_role;
grant execute on function private.rich_text_valid(jsonb, integer, text[]) to authenticated, service_role;
grant execute on function private.rich_doc_from_text(text) to authenticated, service_role;
grant execute on function private.json_int(jsonb, integer, integer) to authenticated, service_role;

-- Nur intern bzw. über die Hüllen
revoke execute on function private.log_invoice_settings(uuid, text, text[], text, text) from public, anon, authenticated;
revoke execute on function private.seed_invoice_settings(uuid, boolean) from public, anon, authenticated;
revoke execute on function private.seed_invoice_settings_trigger() from public, anon, authenticated;
revoke execute on function private.require_invoice_settings_editor(uuid) from public, anon, authenticated;
revoke execute on function private.save_invoice_numbering(uuid, timestamptz, jsonb) from public, anon;
revoke execute on function private.save_invoice_fixed_texts(uuid, timestamptz, jsonb) from public, anon;
revoke execute on function private.save_invoice_backfill(uuid, timestamptz, boolean) from public, anon;
revoke execute on function private.save_invoice_text_block(jsonb) from public, anon;
revoke execute on function private.set_invoice_text_block_default(uuid, text, uuid, uuid) from public, anon;
revoke execute on function private.delete_invoice_text_block(uuid, uuid) from public, anon;
grant execute on function private.save_invoice_numbering(uuid, timestamptz, jsonb) to authenticated;
grant execute on function private.save_invoice_fixed_texts(uuid, timestamptz, jsonb) to authenticated;
grant execute on function private.save_invoice_backfill(uuid, timestamptz, boolean) to authenticated;
grant execute on function private.save_invoice_text_block(jsonb) to authenticated;
grant execute on function private.set_invoice_text_block_default(uuid, text, uuid, uuid) to authenticated;
grant execute on function private.delete_invoice_text_block(uuid, uuid) to authenticated;

revoke execute on function public.save_invoice_numbering(uuid, timestamptz, jsonb) from public, anon;
revoke execute on function public.save_invoice_fixed_texts(uuid, timestamptz, jsonb) from public, anon;
revoke execute on function public.save_invoice_backfill(uuid, timestamptz, boolean) from public, anon;
revoke execute on function public.save_invoice_text_block(jsonb) from public, anon;
revoke execute on function public.set_invoice_text_block_default(uuid, text, uuid, uuid) from public, anon;
revoke execute on function public.delete_invoice_text_block(uuid, uuid) from public, anon;
grant execute on function public.save_invoice_numbering(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.save_invoice_fixed_texts(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.save_invoice_backfill(uuid, timestamptz, boolean) to authenticated;
grant execute on function public.save_invoice_text_block(jsonb) to authenticated;
grant execute on function public.set_invoice_text_block_default(uuid, text, uuid, uuid) to authenticated;
grant execute on function public.delete_invoice_text_block(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Rechnung speichern (PROJ-37): Schalter „Rechnungen nacherfassen“ aus invoice_settings.
-- Sonst unverändert gegenüber 20261030071155_invoices.sql.
-- ---------------------------------------------------------------------------
create or replace function private.save_invoice(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
    if v_old.id is null then
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
  if length(v_number) not between 1 and 30 or length(v_recipient) not between 1 and 200 or v_date is null then
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
      address_country, marketing_source, marketing_custom, company_name, company_vat_id, company_address_line1, company_address_line2,
      company_postal_code, company_city, company_country, note,
      title_prefix, title_suffix, gender, document_type, document_number, document_issued_on, document_authority,
      document_country, document_front_path, document_back_path
    ) values (
      v_tenant, v_new_guest ->> 'last_name', v_new_guest ->> 'first_name', v_new_guest ->> 'country',
      v_new_guest ->> 'email', v_new_guest ->> 'phone', v_new_guest ->> 'language',
      (v_new_guest ->> 'birth_date')::date, v_new_guest ->> 'street', v_new_guest ->> 'postal_code',
      v_new_guest ->> 'city', v_new_guest ->> 'address_country', v_new_guest ->> 'marketing_source',
      v_new_guest ->> 'marketing_custom', v_new_guest ->> 'company_name', v_new_guest ->> 'company_vat_id',
      v_new_guest ->> 'company_address_line1', v_new_guest ->> 'company_address_line2',
      v_new_guest ->> 'company_postal_code', v_new_guest ->> 'company_city', v_new_guest ->> 'company_country',
      v_new_guest ->> 'note',
      v_new_guest ->> 'title_prefix', v_new_guest ->> 'title_suffix',
      coalesce(v_new_guest ->> 'gender', 'unspecified'), v_new_guest ->> 'document_type',
      v_new_guest ->> 'document_number', (v_new_guest ->> 'document_issued_on')::date,
      v_new_guest ->> 'document_authority', v_new_guest ->> 'document_country',
      v_new_guest ->> 'document_front_path', v_new_guest ->> 'document_back_path'
    ) returning id into v_guest_id;
  end if;

  -- Kleinunternehmer am Rechnungsdatum (PROJ-36), an der Rechnung festgehalten
  select coalesce((
    select v.small_business from public.vat_status_changes v
    where v.tenant_id = v_tenant and v.valid_from <= v_date
    order by v.valid_from desc limit 1
  ), false) into v_small;

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

  return jsonb_build_object(
    'id', v_id,
    'unused_pdf', case when v_old.pdf_path is distinct from v_pdf then v_old.pdf_path end,
    'previous_booking_id', case when v_old.booking_id is distinct from v_booking_id then v_old.booking_id end
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- Stammdaten speichern (PROJ-38) ohne Schalter „Rechnungen nacherfassen“ (seit PROJ-39 in invoice_settings);
-- ein mitgeschickter Schlüssel invoice_backfill_enabled wird ignoriert. Sonst unverändert.
-- ---------------------------------------------------------------------------
create or replace function private.update_tenant_master_data(p_tenant_id uuid, p_expected_updated_at timestamptz, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.tenants;
  v_new public.tenants;
  v_changed text[] := '{}';
  v_column text;
  v_vat jsonb := p_data -> 'vat_status';
  v_vat_old jsonb;
  v_vat_new jsonb;
  -- PROJ-38: Logo; fehlt der Schlüssel, bleibt es unverändert, null entfernt es
  v_logo_given boolean := p_data ? 'logo_path';
  v_logo text := nullif(btrim(coalesce(p_data ->> 'logo_path', '')), '');
begin
  -- Inhaber dieses (aktiven) Kunden oder Admin mit 2FA; Mitarbeiter und fremde Inhaber nicht
  if not (private.is_admin() or private.has_role(p_tenant_id, 'owner')) then
    raise exception 'Keine Berechtigung für diese Kundendaten.' using errcode = '42501';
  end if;
  v_old := private.lock_tenant(p_tenant_id, true);
  if v_old.updated_at is distinct from p_expected_updated_at then
    raise exception 'Die Kundendaten wurden inzwischen geändert.' using errcode = 'P0017';
  end if;

  -- Bereinigen wie im Formular: Leerzeichen am Rand weg, leer = nicht angegeben, UID ohne Leerzeichen in Großbuchstaben
  v_new := v_old;
  v_new.name := btrim(coalesce(p_data ->> 'name', ''));
  v_new.name_line2 := nullif(btrim(p_data ->> 'name_line2'), '');
  v_new.address_line1 := nullif(btrim(p_data ->> 'address_line1'), '');
  v_new.address_line2 := nullif(btrim(p_data ->> 'address_line2'), '');
  v_new.postal_code := nullif(btrim(p_data ->> 'postal_code'), '');
  v_new.city := nullif(btrim(p_data ->> 'city'), '');
  v_new.country := nullif(upper(btrim(p_data ->> 'country')), '');
  v_new.vat_id := nullif(upper(regexp_replace(coalesce(p_data ->> 'vat_id', ''), '\s', '', 'g')), '');
  v_new.tax_number := nullif(btrim(p_data ->> 'tax_number'), '');
  v_new.register_number := nullif(btrim(p_data ->> 'register_number'), '');
  -- Logo (PROJ-38): ein neuer Speicherort muss im Ordner dieses Kunden liegen und als PNG hochgeladen sein
  if v_logo_given then
    if v_logo is not null and v_logo is distinct from v_old.logo_path and (
      private.logo_tenant(v_logo) is distinct from p_tenant_id
      or not exists (select 1 from storage.objects o where o.bucket_id = 'tenant-logos' and o.name = v_logo)
    ) then
      raise exception 'Das Logo wurde nicht gefunden.' using errcode = 'P0018';
    end if;
    v_new.logo_path := v_logo;
  end if;

  foreach v_column in array array[
    'name', 'name_line2', 'address_line1', 'address_line2', 'postal_code', 'city', 'country', 'vat_id', 'tax_number',
    'register_number', 'logo_path'
  ] loop
    if (to_jsonb(v_old) -> v_column) is distinct from (to_jsonb(v_new) -> v_column) then
      v_changed := v_changed || v_column;
    end if;
  end loop;

  -- Kleinunternehmer-Status (PROJ-36). Fehlt der Schlüssel, bleibt der Verlauf unverändert.
  if v_vat is not null then
    if jsonb_typeof(v_vat) <> 'array' or jsonb_array_length(v_vat) > 50 or exists (
      select 1 from jsonb_array_elements(v_vat) e
      where jsonb_typeof(e) <> 'object'
         or jsonb_typeof(e -> 'small_business') is distinct from 'boolean'
         or coalesce(e ->> 'valid_from', '') !~ '^\d{4}-\d{2}-\d{2}$'
    ) then
      raise exception 'Ungültiger Umsatzsteuer-Status.' using errcode = '22023';
    end if;
    -- Vergleich in fester Reihenfolge; ungültige Kalendertage (z. B. 2026-02-30) scheitern hier beim Umwandeln
    select coalesce(jsonb_agg(jsonb_build_array(v.valid_from, v.small_business) order by v.valid_from), '[]'::jsonb)
      into v_vat_old
      from public.vat_status_changes v where v.tenant_id = p_tenant_id;
    select coalesce(jsonb_agg(jsonb_build_array(d, b) order by d, b), '[]'::jsonb)
      into v_vat_new
      from (
        select (e ->> 'valid_from')::date d, (e ->> 'small_business')::boolean b
        from jsonb_array_elements(v_vat) e
      ) x;
    if v_vat_old is distinct from v_vat_new then
      v_changed := v_changed || 'vat_status'::text;
    end if;
  end if;

  -- Speichern ohne Änderung: kein Fehler, kein Protokolleintrag
  if cardinality(v_changed) = 0 then
    return jsonb_build_object('unused_logo', null);
  end if;

  -- Prüfregeln der Tabelle greifen hier (z. B. leerer Name, UID-Format).
  -- Auch bei reiner Verlaufsänderung: setzt „zuletzt geändert am“ (Trigger), damit der Konfliktschutz greift.
  update public.tenants set
    name = v_new.name,
    name_line2 = v_new.name_line2,
    address_line1 = v_new.address_line1,
    address_line2 = v_new.address_line2,
    postal_code = v_new.postal_code,
    city = v_new.city,
    country = v_new.country,
    vat_id = v_new.vat_id,
    tax_number = v_new.tax_number,
    register_number = v_new.register_number,
    logo_path = v_new.logo_path
  where id = p_tenant_id;

  if 'vat_status' = any(v_changed) then
    -- Verlauf vollständig ersetzen; ein doppeltes Datum scheitert an der Eindeutigkeit (23505)
    delete from public.vat_status_changes where tenant_id = p_tenant_id;
    insert into public.vat_status_changes (tenant_id, valid_from, small_business)
    select p_tenant_id, (e ->> 'valid_from')::date, (e ->> 'small_business')::boolean
    from jsonb_array_elements(v_vat) e;
  end if;

  insert into public.operator_log (tenant_id, tenant_name, action, actor_id, actor_name, changed_fields)
  select p_tenant_id, v_new.name, 'master_data', (select auth.uid()), coalesce(p.display_name, p.email), v_changed
  from (select 1) one
  left join public.profiles p on p.id = (select auth.uid());

  -- Ersetztes bzw. entferntes Logo: der Server löscht die Datei
  return jsonb_build_object(
    'unused_logo', case when v_old.logo_path is distinct from v_new.logo_path then v_old.logo_path end
  );
end;
$$;


-- Schalter liegt jetzt in invoice_settings
alter table public.tenants drop column invoice_backfill_enabled;
