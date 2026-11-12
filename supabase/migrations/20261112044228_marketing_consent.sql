-- PROJ-19 Marketing-Einwilligung verwalten: Verlauf je Gast (Erteilungen aus Gästeblättern und von Hand, Widerrufe),
-- Stand am Gast (erteilt/widerrufen/keine), Belege im Speicherbereich „marketing-consent-receipts“, Filter in der Gästeliste.
-- Lesen: Mitglieder des Kunden. Schreiben nur über record_marketing_consent (Inhaber und Mitarbeiter) und
-- void_marketing_consent (nur Inhaber); Gästeblätter über private.note_marketing_consent (PROJ-26, unverändert aufgerufen).
-- Einträge sind unveränderlich: erlaubt sind nur die Irrtümlich-Markierung, das Umhängen beim Zusammenführen und das Leeren
-- von Notiz und Beleg beim Anonymisieren. Der Stand am Gast folgt automatisch jedem geänderten Eintrag.
-- Der Vermerk aus PROJ-26 (guests.marketing_consent_at, marketing_consent_sheet_id) geht im Verlauf auf und entfällt.
-- Fehlercodes: 42501 kein Mitglied bzw. nur Inhaber, P0016 Kunde deaktiviert, P0988 Beleg fehlt oder gehört nicht zum Kunden,
-- P0989 Eintrag lässt sich nicht ändern/löschen, P0992 nicht gefunden, P0993 Gast anonymisiert, P0994 Datum in der Zukunft,
-- P0995 Datum vor dem Geburtsdatum, P0996 Weg ungültig, P0997 Widerruf ohne Erteilung, P0998 nicht als irrtümlich markierbar,
-- P0999 bereits irrtümlich.

-- ---------------------------------------------------------------------------
-- Verlauf
-- ---------------------------------------------------------------------------
create table public.marketing_consent_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  guest_id uuid not null,
  kind text not null check (kind in ('grant', 'revoke')),
  origin text not null check (origin in ('sheet', 'sheet_upload', 'manual')),
  occurred_on date not null,
  channel text check (channel in ('email', 'paper', 'webform', 'oral', 'other')),
  guest_sheet_id uuid references public.guest_sheets (id) on delete cascade,
  note text check (note is null or (note = btrim(note) and length(note) between 1 and 500)),
  receipt_path text unique check (receipt_path is null or coalesce(private.receipt_tenant(receipt_path) = tenant_id, false)),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  void_reason text check (void_reason is null or (void_reason = btrim(void_reason) and length(void_reason) between 1 and 200)),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint marketing_consent_events_guest_fkey foreign key (guest_id, tenant_id)
    references public.guests (id, tenant_id) on delete cascade,
  -- Von Hand: Weg Pflicht, kein Gästeblatt; Gästeblatt: Verweis Pflicht, kein Weg, keine Notiz, kein Beleg, nur Erteilung
  constraint marketing_consent_events_origin_fields_check check (
    (origin = 'manual' and channel is not null and guest_sheet_id is null)
    or (origin <> 'manual' and channel is null and guest_sheet_id is not null and kind = 'grant' and note is null and receipt_path is null)
  ),
  -- Mündlich nur beim Widerruf
  constraint marketing_consent_events_oral_check check (channel is distinct from 'oral' or kind = 'revoke'),
  -- Irrtümlich nur bei Einträgen von Hand, immer mit Grund
  constraint marketing_consent_events_void_check check (
    (voided_at is null and void_reason is null and voided_by is null)
    or (voided_at is not null and void_reason is not null and origin = 'manual')
  )
);
comment on table public.marketing_consent_events is 'Verlauf der Marketing-Einwilligung je Gast (PROJ-19). Schreiben nur über record_marketing_consent, void_marketing_consent und private.note_marketing_consent; Einträge sind unveränderlich.';

create index marketing_consent_events_guest_idx on public.marketing_consent_events (guest_id, occurred_on desc, created_at desc);
create index marketing_consent_events_tenant_idx on public.marketing_consent_events (tenant_id);
create index marketing_consent_events_sheet_idx on public.marketing_consent_events (guest_sheet_id);
create index marketing_consent_events_created_by_idx on public.marketing_consent_events (created_by);
create index marketing_consent_events_voided_by_idx on public.marketing_consent_events (voided_by);

-- ---------------------------------------------------------------------------
-- Übernahme bestehender Einwilligungen (vor den Triggern, damit Person und Zeitpunkt vom Gästeblatt bleiben):
-- jedes Gästeblatt mit Häkchen, auch ersetzte; Datum = Unterschrift 2 bzw. „Unterschrieben am“, sonst Hochladedatum
-- ---------------------------------------------------------------------------
insert into public.marketing_consent_events (tenant_id, guest_id, kind, origin, occurred_on, guest_sheet_id, created_at, created_by, updated_at, updated_by)
select
  s.tenant_id,
  s.guest_id,
  'grant',
  case s.kind when 'uploaded' then 'sheet_upload' else 'sheet' end,
  case s.kind
    when 'signed' then (s.signed_at_2 at time zone 'Europe/Vienna')::date
    else coalesce(s.signed_on, (s.created_at at time zone 'Europe/Vienna')::date)
  end,
  s.id,
  s.created_at,
  s.created_by,
  s.created_at,
  s.created_by
from public.guest_sheets s
join public.guests g on g.id = s.guest_id and g.tenant_id = s.tenant_id
where s.marketing_consent;

-- ---------------------------------------------------------------------------
-- Stand am Gast (für Filter und Export schnell abfragbar); löst den Vermerk aus PROJ-26 ab
-- ---------------------------------------------------------------------------
alter table public.guests
  add column marketing_consent_state text not null default 'none' check (marketing_consent_state in ('granted', 'revoked', 'none')),
  add column marketing_consent_on date,
  add constraint guests_marketing_consent_on_check check ((marketing_consent_state = 'none') = (marketing_consent_on is null));
create index guests_marketing_consent_state_idx on public.guests (tenant_id, marketing_consent_state);

update public.guests g set
  marketing_consent_state = case when l.kind = 'grant' then 'granted' else 'revoked' end,
  marketing_consent_on = l.occurred_on
from (
  select distinct on (e.guest_id) e.guest_id, e.kind, e.occurred_on
  from public.marketing_consent_events e
  where e.voided_at is null
  order by e.guest_id, e.occurred_on desc, e.created_at desc, e.id desc
) l
where l.guest_id = g.id and g.anonymized_at is null;

alter table public.guests
  drop column marketing_consent_at,
  drop column marketing_consent_sheet_id;

-- Stand eines Gastes aus dem jüngsten gültigen Eintrag (nach Datum, dann Erfassungszeit); anonymisiert immer „keine“
create function private.refresh_marketing_consent(p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_on date;
  v_state text := 'none';
begin
  select e.kind, e.occurred_on into v_kind, v_on
  from public.marketing_consent_events e
  where e.guest_id = p_guest_id and e.voided_at is null
  order by e.occurred_on desc, e.created_at desc, e.id desc
  limit 1;
  if v_kind is not null then
    v_state := case when v_kind = 'grant' then 'granted' else 'revoked' end;
  end if;
  update public.guests g set
    marketing_consent_state = case when g.anonymized_at is null then v_state else 'none' end,
    marketing_consent_on = case when g.anonymized_at is null and v_state <> 'none' then v_on end
  where g.id = p_guest_id
    and (g.marketing_consent_state, g.marketing_consent_on) is distinct from (
      case when g.anonymized_at is null then v_state else 'none' end,
      case when g.anonymized_at is null and v_state <> 'none' then v_on end
    );
end;
$$;

create function private.marketing_consent_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.refresh_marketing_consent(old.guest_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.guest_id is distinct from old.guest_id
      or new.voided_at is distinct from old.voided_at) then
    perform private.refresh_marketing_consent(new.guest_id);
  end if;
  return null;
end;
$$;
create trigger z_refresh_marketing_consent after insert or update or delete on public.marketing_consent_events
  for each row execute function private.marketing_consent_changed();

-- Unveränderlich: nur Irrtümlich-Markierung (einmal), Umhängen beim Zusammenführen, Leeren von Notiz und Beleg bei
-- anonymisiertem Gast; Löschen nur mit dem ganzen Gast bzw. Kunden
create function private.protect_marketing_consent_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_free constant text[] := array['voided_at', 'voided_by', 'void_reason', 'guest_id', 'note', 'receipt_path', 'updated_at', 'updated_by'];
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.tenants t where t.id = old.tenant_id)
        and exists (select 1 from public.guests g where g.id = old.guest_id) then
      raise exception 'Einträge der Marketing-Einwilligung lassen sich nicht löschen.' using errcode = 'P0989';
    end if;
    return old;
  end if;
  if (to_jsonb(new) - v_free) is distinct from (to_jsonb(old) - v_free) then
    raise exception 'Einträge der Marketing-Einwilligung lassen sich nicht ändern.' using errcode = 'P0989';
  end if;
  if old.voided_at is not null
      and (new.voided_at, new.voided_by, new.void_reason) is distinct from (old.voided_at, old.voided_by, old.void_reason) then
    raise exception 'Der Eintrag ist bereits als irrtümlich markiert.' using errcode = 'P0999';
  end if;
  if (new.note is distinct from old.note or new.receipt_path is distinct from old.receipt_path) and (
      (new.note is not null and new.note is distinct from old.note)
      or (new.receipt_path is not null and new.receipt_path is distinct from old.receipt_path)
      or not exists (select 1 from public.guests g where g.id = new.guest_id and g.anonymized_at is not null)
    ) then
    raise exception 'Einträge der Marketing-Einwilligung lassen sich nicht ändern.' using errcode = 'P0989';
  end if;
  return new;
end;
$$;
create trigger a_protect_marketing_consent_event before update or delete on public.marketing_consent_events
  for each row execute function private.protect_marketing_consent_event();

-- ---------------------------------------------------------------------------
-- Rechte und Protokoll
-- ---------------------------------------------------------------------------
revoke all on public.marketing_consent_events from anon, authenticated;
grant select on public.marketing_consent_events to authenticated;
alter table public.marketing_consent_events enable row level security;
create policy "Mitglieder lesen den Einwilligungsverlauf" on public.marketing_consent_events for select to authenticated
  using (private.is_member(tenant_id));
-- Kein direktes Anlegen, Ändern oder Löschen (nur über die Funktionen)
select private.enable_tenant_table('public.marketing_consent_events');

-- ---------------------------------------------------------------------------
-- Lesesicht für die Gastdetailseite (mit den Rechten des Lesenden)
-- ---------------------------------------------------------------------------
create view public.marketing_consent_history
with (security_invoker = true)
as
select
  e.id,
  e.tenant_id,
  e.guest_id,
  e.kind,
  e.origin,
  e.occurred_on,
  e.channel,
  e.note,
  e.receipt_path,
  e.guest_sheet_id,
  s.sheet_number,
  s.booking_id,
  b.number as booking_number,
  e.created_at,
  e.created_by,
  cp.display_name as created_by_name,
  e.voided_at,
  e.voided_by,
  vp.display_name as voided_by_name,
  e.void_reason
from public.marketing_consent_events e
left join public.guest_sheets s on s.id = e.guest_sheet_id
left join public.bookings b on b.id = s.booking_id
left join public.profiles cp on cp.id = e.created_by
left join public.profiles vp on vp.id = e.voided_by;

revoke all on public.marketing_consent_history from anon, authenticated;
grant select on public.marketing_consent_history to authenticated;

-- ---------------------------------------------------------------------------
-- Belege: privat, PDF und JPEG bis 10 MB, ein Ordner je Kunde (Format wie Zahlungsbelege, private.receipt_tenant)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketing-consent-receipts', 'marketing-consent-receipts', false, 10485760, array['application/pdf', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf', 'image/jpeg'];

-- Lesen nur für Mitglieder und nur Belege, die an einem Eintrag dieses Kunden hängen
create function private.can_read_consent_receipt(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.receipt_tenant(p_name) is not null
    and private.is_member(private.receipt_tenant(p_name))
    and exists (
      select 1 from public.marketing_consent_events e
      where e.tenant_id = private.receipt_tenant(p_name) and e.receipt_path = p_name
    );
$$;

create policy "Mitglieder laden Einwilligungsbelege in den eigenen Ordner"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'marketing-consent-receipts'
    and private.receipt_tenant(name) is not null
    and private.is_member(private.receipt_tenant(name))
  );
create policy "Mitglieder lesen verwendete Einwilligungsbelege"
  on storage.objects for select to authenticated
  using (bucket_id = 'marketing-consent-receipts' and private.can_read_consent_receipt(name));
-- Kein Ändern oder Löschen durch Nutzer (nur der Server mit geheimem Schlüssel)

-- Tägliche Bereinigung: Belege älter als 24 Stunden ohne Eintrag (auch nach Anonymisieren und Löschen). Nur für den Server.
create function public.unused_marketing_consent_receipts(p_limit integer default 1000)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'marketing-consent-receipts'
    and o.created_at < now() - interval '24 hours'
    and not exists (select 1 from public.marketing_consent_events e where e.receipt_path = o.name)
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

-- ---------------------------------------------------------------------------
-- Gästeblatt (PROJ-26): Erteilung als Eintrag im Verlauf statt Vermerk am Gast; Aufrufe unverändert
-- ---------------------------------------------------------------------------
create or replace function private.note_marketing_consent(p_guest_id uuid, p_at timestamptz, p_sheet_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.marketing_consent_events (tenant_id, guest_id, kind, origin, occurred_on, guest_sheet_id)
  select g.tenant_id, g.id, 'grant', case s.kind when 'uploaded' then 'sheet_upload' else 'sheet' end,
    (p_at at time zone 'Europe/Vienna')::date, s.id
  from public.guests g
  join public.guest_sheets s on s.id = p_sheet_id and s.tenant_id = g.tenant_id
  where g.id = p_guest_id and g.anonymized_at is null;
$$;

-- ---------------------------------------------------------------------------
-- Erteilung oder Widerruf von Hand (Inhaber und Mitarbeiter)
-- p_input: tenant_id, guest_id, kind, occurred_on, channel, note, receipt_path, confirmed
-- Ergebnis: {saved, id, warnings}. Liegt der Eintrag vor dem maßgeblichen Eintrag, ändert er den Stand nicht: ohne
-- confirmed wird nichts gespeichert und der Hinweis notEffective gemeldet.
-- ---------------------------------------------------------------------------
create function private.record_marketing_consent(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (p_input ->> 'tenant_id')::uuid;
  v_kind text := p_input ->> 'kind';
  v_on date := nullif(p_input ->> 'occurred_on', '')::date;
  v_channel text := nullif(p_input ->> 'channel', '');
  v_note text := nullif(btrim(coalesce(p_input ->> 'note', '')), '');
  v_receipt text := nullif(p_input ->> 'receipt_path', '');
  v_confirmed boolean := coalesce((p_input ->> 'confirmed')::boolean, false);
  v_guest public.guests;
  v_latest public.marketing_consent_events;
  v_id uuid;
begin
  if v_tenant is null or v_kind is null or v_kind not in ('grant', 'revoke') or v_on is null then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;
  if exists (select 1 from public.tenants t where t.id = v_tenant and t.status = 'deactivated') then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  if not private.is_member(v_tenant) then
    raise exception 'Kein Mitglied.' using errcode = '42501';
  end if;
  -- Gast sperren: gleichzeitige Einträge werden nacheinander bewertet
  select * into v_guest from public.guests
  where id = (p_input ->> 'guest_id')::uuid and tenant_id = v_tenant
  for update;
  if v_guest.id is null then
    raise exception 'Gast nicht gefunden.' using errcode = 'P0992';
  end if;
  if v_guest.anonymized_at is not null then
    raise exception 'Der Gast ist anonymisiert.' using errcode = 'P0993';
  end if;
  if v_on > private.today_vienna() then
    raise exception 'Das Datum liegt in der Zukunft.' using errcode = 'P0994';
  end if;
  if v_guest.birth_date is not null and v_on < v_guest.birth_date then
    raise exception 'Das Datum liegt vor dem Geburtsdatum.' using errcode = 'P0995';
  end if;
  if v_channel is null or v_channel not in ('email', 'paper', 'webform', 'oral', 'other')
      or (v_channel = 'oral' and v_kind <> 'revoke') then
    raise exception 'Ungültiger Weg.' using errcode = 'P0996';
  end if;
  if v_kind = 'revoke' and v_guest.marketing_consent_state <> 'granted' then
    raise exception 'Es besteht keine Einwilligung.' using errcode = 'P0997';
  end if;
  if v_note is not null and length(v_note) > 500 then
    raise exception 'Notiz zu lang.' using errcode = '22023';
  end if;
  if v_receipt is not null and (
      private.receipt_tenant(v_receipt) is distinct from v_tenant
      or not exists (select 1 from storage.objects o where o.bucket_id = 'marketing-consent-receipts' and o.name = v_receipt)
      or exists (select 1 from public.marketing_consent_events e where e.receipt_path = v_receipt)
    ) then
    raise exception 'Der Beleg fehlt.' using errcode = 'P0988';
  end if;

  -- Maßgeblicher Eintrag; bei gleichem Datum zählt der neue (später erfasst)
  select * into v_latest from public.marketing_consent_events e
  where e.guest_id = v_guest.id and e.voided_at is null
  order by e.occurred_on desc, e.created_at desc, e.id desc
  limit 1;
  if v_latest.id is not null and v_on < v_latest.occurred_on and not v_confirmed then
    return jsonb_build_object(
      'saved', false,
      'warnings', jsonb_build_array(jsonb_build_object('code', 'notEffective', 'latestOn', v_latest.occurred_on, 'latestKind', v_latest.kind))
    );
  end if;

  insert into public.marketing_consent_events (tenant_id, guest_id, kind, origin, occurred_on, channel, note, receipt_path)
  values (v_tenant, v_guest.id, v_kind, 'manual', v_on, v_channel, v_note, v_receipt)
  returning id into v_id;
  return jsonb_build_object('saved', true, 'id', v_id, 'warnings', '[]'::jsonb);
end;
$$;

create function public.record_marketing_consent(p_input jsonb)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.record_marketing_consent(p_input); $$;

-- ---------------------------------------------------------------------------
-- Von Hand erfassten Eintrag als irrtümlich markieren (nur Inhaber, nur einmal, Grund Pflicht)
-- ---------------------------------------------------------------------------
create function private.void_marketing_consent(p_entry_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.marketing_consent_events;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into v_entry from public.marketing_consent_events where id = p_entry_id;
  if v_entry.id is null or not private.is_member(v_entry.tenant_id) then
    raise exception 'Eintrag nicht gefunden.' using errcode = 'P0992';
  end if;
  if exists (select 1 from public.tenants t where t.id = v_entry.tenant_id and t.status = 'deactivated') then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  if not private.has_role(v_entry.tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = '42501';
  end if;
  if v_reason is null or length(v_reason) > 200 then
    raise exception 'Grund fehlt oder ist zu lang.' using errcode = '22023';
  end if;
  -- Gast vor dem Eintrag sperren (gleiche Reihenfolge wie beim Erfassen)
  perform 1 from public.guests g where g.id = v_entry.guest_id for update;
  select * into v_entry from public.marketing_consent_events where id = p_entry_id for update;
  if exists (select 1 from public.guests g where g.id = v_entry.guest_id and g.anonymized_at is not null) then
    raise exception 'Der Gast ist anonymisiert.' using errcode = 'P0993';
  end if;
  if v_entry.origin <> 'manual' then
    raise exception 'Nur von Hand erfasste Einträge lassen sich als irrtümlich markieren.' using errcode = 'P0998';
  end if;
  if v_entry.voided_at is not null then
    raise exception 'Der Eintrag ist bereits als irrtümlich markiert.' using errcode = 'P0999';
  end if;
  update public.marketing_consent_events
  set voided_at = now(), voided_by = auth.uid(), void_reason = v_reason
  where id = v_entry.id;
end;
$$;

create function public.void_marketing_consent(p_entry_id uuid, p_reason text)
returns void language sql security invoker set search_path = ''
as $$ select private.void_marketing_consent(p_entry_id, p_reason); $$;

-- ===========================================================================
-- Bestehende Funktionen (jeweils letzte Fassung, nur um PROJ-19 ergänzt)
-- ===========================================================================

-- Gästeliste: Filter Marketing-Einwilligung (neuer Parameter → neu anlegen)
drop function public.guest_list(uuid, text, text, text, text, integer, integer);
create function public.guest_list(
  p_tenant_id uuid,
  p_query text default '',
  p_country text default null,
  p_marketing text default null,
  p_sort text default 'name',
  p_limit integer default 50,
  p_offset integer default 0,
  p_consent text default null
)
returns table (
  id uuid,
  last_name text,
  first_name text,
  title_prefix text,
  title_suffix text,
  company_id uuid,
  company_name text,
  country text,
  anonymized_at timestamptz,
  stay_count integer,
  last_stay date,
  total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with needle as (
    select
      -- Wörter des Suchbegriffs; LIKE-Platzhalter wörtlich nehmen
      array_remove(string_to_array(
        replace(replace(replace(private.guest_norm(left(p_query, 200)), '\', '\\'), '%', '\%'), '_', '\_'),
        ' '
      ), '') as words,
      private.guest_phone_digits(left(p_query, 200)) as digits
  ),
  matches as (
    select g.*, c.name as c_name, s.stay_count, s.last_stay
    from public.guests g
    cross join needle n
    left join public.companies c on c.id = g.company_id and c.tenant_id = g.tenant_id
    left join lateral (
      select
        count(*)::integer as stay_count,
        max(b.arrival) filter (where b.arrival <= private.today_vienna()) as last_stay
      from public.bookings b
      where b.guest_id = g.id and b.tenant_id = g.tenant_id and b.kind = 'booking' and b.cancelled_at is null
    ) s on true
    where g.tenant_id = p_tenant_id
      and (
        cardinality(n.words) = 0
        or not exists (
          select 1 from unnest(n.words) w
          where (g.search_text || ' ' || coalesce(c.search_text, '')) not like '%' || w || '%'
        )
        or (length(n.digits) >= 3 and g.phone_key like '%' || n.digits || '%')
      )
      and (p_country is null or g.country = p_country)
      and (
        p_marketing is null
        or (p_marketing = 'none' and g.marketing_source is null and g.marketing_custom is null)
        or (p_marketing = 'custom' and g.marketing_custom is not null)
        or g.marketing_source = p_marketing
      )
      -- PROJ-19: Stand der Marketing-Einwilligung (anonymisierte Gäste haben immer „keine“)
      and (p_consent is null or g.marketing_consent_state = p_consent)
  )
  select m.id, m.last_name, m.first_name, m.title_prefix, m.title_suffix, m.company_id, m.c_name, m.country, m.anonymized_at,
    m.stay_count, m.last_stay, count(*) over () as total
  from matches m
  order by
    case when p_sort = 'lastStay' then m.last_stay end desc nulls last,
    lower(m.last_name), lower(coalesce(m.first_name, '')), m.id
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

-- Gast löschen (ohne Buchungen, Rechnungen, Gästeblätter): der Verlauf geht mit dem Gast; im Protokoll bleibt nur der Vermerk
create or replace function private.delete_guest(p_guest_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest public.guests;
  v_events uuid[];
begin
  select * into v_guest from public.guests where id = p_guest_id for update;
  if v_guest.id is null then
    raise exception 'Gast nicht gefunden.' using errcode = 'P0702';
  end if;
  if not private.has_role(v_guest.tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0701';
  end if;
  if v_guest.anonymized_at is not null then
    raise exception 'Der Gast ist bereits anonymisiert.' using errcode = 'P0703';
  end if;

  -- Mit Buchungen (auch stornierten) oder Rechnungen (PROJ-37, 7 Jahre Aufbewahrung) anonymisieren
  if exists (select 1 from public.bookings where guest_id = p_guest_id)
      or exists (select 1 from public.invoices where guest_id = p_guest_id)
      -- PROJ-26: Gästeblätter (7 Jahre Aufbewahrung)
      or exists (select 1 from public.guest_sheets where guest_id = p_guest_id) then
    perform private.anonymize_guest(p_guest_id);
    return 'anonymized';
  end if;

  -- PROJ-19: Einträge des Verlaufs (die Belege räumt der Server bzw. die tägliche Bereinigung weg)
  select array_agg(e.id) into v_events from public.marketing_consent_events e where e.guest_id = p_guest_id;
  delete from public.guests where id = p_guest_id;
  -- Es bleibt nur der Vermerk „gelöscht“ mit Person und Zeitpunkt
  perform private.purge_audit_personal_data('guests', p_guest_id);
  if v_events is not null then
    update public.audit_log set old_data = null, new_data = null
    where table_name = 'marketing_consent_events' and record_id = any (v_events);
  end if;
  return 'deleted';
end;
$$;

-- Anonymisieren: Verlauf bleibt (Datum, Art, Weg, Gästeblatt, erfasst von), Notizen und Belege werden geleert, Stand „keine“
create or replace function private.anonymize_guest(p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_companions uuid[];
  v_events uuid[];
begin
  update public.guests set
    last_name = 'Gelöschter Gast',
    first_name = null,
    email = null,
    email_source = 'direct',
    phone = null,
    phone_source = 'direct',
    language = null,
    birth_date = null,
    street = null,
    postal_code = null,
    city = null,
    address_country = null,
    marketing_source = null,
    marketing_custom = null,
    -- PROJ-19: Stand der Marketing-Einwilligung
    marketing_consent_state = 'none',
    marketing_consent_on = null,
    -- PROJ-50: Verknüpfung; die alten Firmenspalten (Sicherung) ebenfalls leeren
    company_id = null,
    company_name = null,
    company_vat_id = null,
    company_address_line1 = null,
    company_address_line2 = null,
    company_postal_code = null,
    company_city = null,
    company_country = null,
    note = null,
    -- PROJ-29 (die Ausweisbilder löscht danach der Server aus dem Speicher)
    title_prefix = null,
    title_suffix = null,
    gender = 'unspecified',
    document_type = null,
    document_number = null,
    document_issued_on = null,
    document_authority = null,
    document_country = null,
    document_front_path = null,
    document_back_path = null,
    anonymized_at = now()
  where id = p_guest_id;
  delete from public.guest_duplicate_dismissals where guest_a = p_guest_id or guest_b = p_guest_id;
  perform private.purge_audit_personal_data('guests', p_guest_id);

  -- PROJ-19: Notizen und Beleg-Verweise leeren (die Dateien löscht danach der Server), samt Altwerten im Protokoll
  update public.marketing_consent_events set note = null, receipt_path = null
  where guest_id = p_guest_id and (note is not null or receipt_path is not null);
  select array_agg(e.id) into v_events from public.marketing_consent_events e where e.guest_id = p_guest_id;
  if v_events is not null then
    update public.audit_log set old_data = null, new_data = null
    where table_name = 'marketing_consent_events' and record_id = any (v_events);
  end if;

  -- PROJ-8: Mitreisende aller Buchungen dieses Gastes entfernen (samt Altwerten im Protokoll);
  -- Anzahl und Alter der Personen bleiben an der Buchung
  select array_agg(c.id) into v_companions
  from public.booking_companions c join public.bookings b on b.id = c.booking_id
  where b.guest_id = p_guest_id;
  if v_companions is not null then
    delete from public.booking_companions where id = any (v_companions);
    update public.audit_log set old_data = null, new_data = null
    where table_name = 'booking_companions' and record_id = any (v_companions);
  end if;
end;
$$;

-- Gäste zusammenführen: Verläufe vereinen, Stand aus dem jüngsten gültigen Eintrag (ersetzt „jüngste Erteilung gilt“)
create or replace function private.merge_guests(p_keep uuid, p_remove uuid, p_choice jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keep public.guests;
  v_remove public.guests;
  -- true = Wert des zweiten Gastes übernehmen
  b_name boolean := p_choice ->> 'name' = 'b';
  b_country boolean := p_choice ->> 'country' = 'b';
  b_email boolean := p_choice ->> 'email' = 'b';
  b_phone boolean := p_choice ->> 'phone' = 'b';
  b_language boolean := p_choice ->> 'language' = 'b';
  b_birth boolean := p_choice ->> 'birthDate' = 'b';
  b_address boolean := p_choice ->> 'address' = 'b';
  b_marketing boolean := p_choice ->> 'marketing' = 'b';
  b_company boolean := p_choice ->> 'company' = 'b';
  b_note boolean := p_choice ->> 'note' = 'b';
  -- PROJ-29
  b_titles boolean := p_choice ->> 'titles' = 'b';
  b_gender boolean := p_choice ->> 'gender' = 'b';
  b_document boolean := p_choice ->> 'document' = 'b';
begin
  if p_keep is null or p_remove is null or p_keep = p_remove then
    raise exception 'Ein Gast lässt sich nicht mit sich selbst zusammenführen.' using errcode = 'P0704';
  end if;
  -- feste Sperr-Reihenfolge gegen Verklemmungen bei gleichzeitigen Aufrufen
  perform 1 from public.guests where id in (p_keep, p_remove) order by id for update;
  select * into v_keep from public.guests where id = p_keep;
  select * into v_remove from public.guests where id = p_remove;
  if v_keep.id is null or v_remove.id is null then
    raise exception 'Gast nicht gefunden.' using errcode = 'P0702';
  end if;
  if v_keep.tenant_id <> v_remove.tenant_id then
    raise exception 'Gäste verschiedener Kunden lassen sich nicht zusammenführen.' using errcode = 'P0704';
  end if;
  if not private.has_role(v_keep.tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0701';
  end if;
  if v_keep.anonymized_at is not null or v_remove.anonymized_at is not null then
    raise exception 'Anonymisierte Gäste lassen sich nicht zusammenführen.' using errcode = 'P0703';
  end if;

  -- PROJ-29: Buchungen umhängen und den anderen Gast zuerst entfernen, damit seine Ausweisbilder
  -- (wenn gewählt) an den verbleibenden Gast wandern können (ein Bild hängt immer nur an einem Gast)
  update public.bookings set guest_id = p_keep where guest_id = p_remove;
  -- PROJ-37: Rechnungen hängen danach am verbleibenden Gast
  update public.invoices set guest_id = p_keep where guest_id = p_remove;
  -- PROJ-26: Gästeblätter hängen am verbleibenden Gast
  update public.guest_sheets set guest_id = p_keep where guest_id = p_remove;
  -- PROJ-19: Verlauf der Marketing-Einwilligung vereinen; der Stand folgt automatisch
  update public.marketing_consent_events set guest_id = p_keep where guest_id = p_remove;
  delete from public.guests where id = p_remove;

  update public.guests set
    last_name = case when b_name then v_remove.last_name else v_keep.last_name end,
    first_name = case when b_name then v_remove.first_name else v_keep.first_name end,
    country = case when b_country then v_remove.country else v_keep.country end,
    email = case when b_email then v_remove.email else v_keep.email end,
    email_source = case when b_email then v_remove.email_source else v_keep.email_source end,
    phone = case when b_phone then v_remove.phone else v_keep.phone end,
    phone_source = case when b_phone then v_remove.phone_source else v_keep.phone_source end,
    language = case when b_language then v_remove.language else v_keep.language end,
    birth_date = case when b_birth then v_remove.birth_date else v_keep.birth_date end,
    street = case when b_address then v_remove.street else v_keep.street end,
    postal_code = case when b_address then v_remove.postal_code else v_keep.postal_code end,
    city = case when b_address then v_remove.city else v_keep.city end,
    address_country = case when b_address then v_remove.address_country else v_keep.address_country end,
    marketing_source = case when b_marketing then v_remove.marketing_source else v_keep.marketing_source end,
    marketing_custom = case when b_marketing then v_remove.marketing_custom else v_keep.marketing_custom end,
    -- PROJ-50: Verknüpfung mit der Firma statt Firmenfelder
    company_id = case when b_company then v_remove.company_id else v_keep.company_id end,
    note = case when b_note then v_remove.note else v_keep.note end,
    title_prefix = case when b_titles then v_remove.title_prefix else v_keep.title_prefix end,
    title_suffix = case when b_titles then v_remove.title_suffix else v_keep.title_suffix end,
    gender = case when b_gender then v_remove.gender else v_keep.gender end,
    -- Reisedokument als Ganzes (Angaben und beide Bilder)
    document_type = case when b_document then v_remove.document_type else v_keep.document_type end,
    document_number = case when b_document then v_remove.document_number else v_keep.document_number end,
    document_issued_on = case when b_document then v_remove.document_issued_on else v_keep.document_issued_on end,
    document_authority = case when b_document then v_remove.document_authority else v_keep.document_authority end,
    document_country = case when b_document then v_remove.document_country else v_keep.document_country end,
    document_front_path = case when b_document then v_remove.document_front_path else v_keep.document_front_path end,
    document_back_path = case when b_document then v_remove.document_back_path else v_keep.document_back_path end
  where id = p_keep;

  -- Verknüpfung im Protokoll: „zusammengeführt mit …“ beim verbleibenden Gast
  insert into public.audit_log (tenant_id, table_name, record_id, action, old_data, new_data, actor_id, actor_label)
  values (
    v_keep.tenant_id, 'guests', p_keep, 'update', null,
    jsonb_build_object('merged_from', p_remove),
    auth.uid(), 'user'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte der Funktionen
-- ---------------------------------------------------------------------------
revoke execute on function private.refresh_marketing_consent(uuid) from public, anon, authenticated;
revoke execute on function private.marketing_consent_changed() from public, anon, authenticated;
revoke execute on function private.protect_marketing_consent_event() from public, anon, authenticated;
revoke execute on function private.can_read_consent_receipt(text) from public, anon;
revoke execute on function public.unused_marketing_consent_receipts(integer) from public, anon, authenticated;
revoke execute on function private.record_marketing_consent(jsonb) from public, anon;
revoke execute on function public.record_marketing_consent(jsonb) from public, anon;
revoke execute on function private.void_marketing_consent(uuid, text) from public, anon;
revoke execute on function public.void_marketing_consent(uuid, text) from public, anon;
revoke execute on function public.guest_list(uuid, text, text, text, text, integer, integer, text) from public, anon;

grant execute on function private.can_read_consent_receipt(text) to authenticated, service_role;
grant execute on function public.unused_marketing_consent_receipts(integer) to service_role;
grant execute on function private.record_marketing_consent(jsonb) to authenticated;
grant execute on function public.record_marketing_consent(jsonb) to authenticated;
grant execute on function private.void_marketing_consent(uuid, text) to authenticated;
grant execute on function public.void_marketing_consent(uuid, text) to authenticated;
grant execute on function public.guest_list(uuid, text, text, text, text, integer, integer, text) to authenticated;
