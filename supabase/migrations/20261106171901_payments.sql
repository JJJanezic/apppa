-- PROJ-45 Zahlungserfassung: Zahlungsarten, Zahlungen und Rückzahlungen, Belege, Zahlungsstand je Rechnung, Zahlungsliste,
-- „Bereits bezahlt“ beim Nacherfassen, Buchungsquelle „Airbnb“.
-- Lesen: Mitglieder des Kunden (ohne Betreiber-Ausnahme). Schreiben der Zahlungen nur über die Funktionen record_payment,
-- update_payment und delete_payment (Erfassen: Inhaber und Mitarbeiter; Ändern, Umhängen, Löschen: nur Inhaber). Zahlungsarten
-- schreibt der Inhaber direkt (Zugriffsregeln), Reihenfolge und Standard über eigene Funktionen.
-- Fehlercodes: P0950 nur Inhaber, P0951 nicht gefunden, P0952 nicht zahlbar, P0953 storniert, P0954 keine Gutschrift,
-- P0955 Datum in der Zukunft, P0956 Betrag, P0957 Provision nicht erlaubt, P0958 Zahlungsart inaktiv, P0959 Beleg fehlt,
-- P0960 Stand geändert, P0961 Rechnung hat Zahlungen, P0962 letzte aktive Zahlungsart, P0963 Standard nicht deaktivierbar,
-- P0964 Reihenfolge veraltet, P0016 Kunde deaktiviert.

-- ---------------------------------------------------------------------------
-- Buchungsquelle „Airbnb“ (von Hand erfasste Airbnb-Buchungen, Provisionsabzug)
-- ---------------------------------------------------------------------------
alter table public.bookings drop constraint bookings_source_check;
alter table public.bookings add constraint bookings_source_check
  check (source in ('website', 'instagram', 'google_ads', 'newsletter', 'referral', 'platform_search', 'booking_com', 'airbnb', 'custom', 'none'));

-- Plattform-Buchung: Buchungsquelle booking.com oder Airbnb, nach dem Import (PROJ-11) auch der Kanal
create function private.is_platform_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select b.source in ('booking_com', 'airbnb') or b.channel in ('booking_com', 'airbnb')
    from public.bookings b where b.id = p_booking_id
  ), false);
$$;

-- ---------------------------------------------------------------------------
-- Zahlungsarten je Kunde
-- ---------------------------------------------------------------------------
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (name = btrim(name) and length(name) between 1 and 50),
  position integer not null default 0,
  active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint payment_methods_default_active_check check (not is_default or active),
  constraint payment_methods_id_tenant_key unique (id, tenant_id)
);
comment on table public.payment_methods is 'Zahlungsarten je Kunde (PROJ-45): Auswahl beim Erfassen einer Zahlung, Reihenfolge, Standard, aktiv.';

create unique index payment_methods_name_key on public.payment_methods (tenant_id, lower(name));
create unique index payment_methods_default_key on public.payment_methods (tenant_id) where is_default;
create index payment_methods_order_idx on public.payment_methods (tenant_id, position);

-- ---------------------------------------------------------------------------
-- Zahlungen (an Rechnungen) und Rückzahlungen (an Gutschriften)
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  invoice_id uuid not null,
  kind text not null check (kind in ('payment', 'refund')),
  paid_on date not null,
  amount_cents bigint not null check (amount_cents between 1 and 999999999),
  commission_cents bigint not null default 0 check (commission_cents between 0 and 999999999),
  fee_cents bigint not null default 0 check (fee_cents between 0 and 999999999),
  method_id uuid not null,
  note text check (note is null or (note = btrim(note) and length(note) between 1 and 300)),
  receipt_path text unique check (
    receipt_path is null
    or receipt_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg)$'
  ),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  -- Rückzahlungen ohne Provision und Gebühr
  constraint payments_refund_check check (kind = 'payment' or (commission_cents = 0 and fee_cents = 0)),
  -- Beleg im Ordner des eigenen Kunden
  constraint payments_receipt_tenant_check check (receipt_path is null or split_part(receipt_path, '/', 1)::uuid = tenant_id),
  constraint payments_invoice_fkey foreign key (invoice_id, tenant_id) references public.invoices (id, tenant_id) on delete cascade,
  -- Benutzte Zahlungsarten lassen sich nicht löschen (Prüfung am Ende der Anweisung: Kunde löschen räumt beides weg)
  constraint payments_method_fkey foreign key (method_id, tenant_id) references public.payment_methods (id, tenant_id),
  constraint payments_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null
);
comment on table public.payments is 'Zahlungen je Rechnung und Rückzahlungen je Gutschrift (PROJ-45). Schreiben nur über record_payment, update_payment, delete_payment.';
comment on column public.payments.amount_cents is 'Tatsächlich eingegangener (bzw. zurückgezahlter) Betrag; bei Plattform-Buchungen „Ausbezahlt“.';
comment on column public.payments.commission_cents is 'Von booking.com/Airbnb einbehaltene Provision; verringert den Offen-Betrag, nie den Rechnungsbetrag.';

create index payments_list_idx on public.payments (tenant_id, paid_on desc, created_at desc);
create index payments_invoice_idx on public.payments (invoice_id);
create index payments_method_idx on public.payments (method_id);

-- ---------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------
revoke all on public.payment_methods from anon, authenticated;
revoke all on public.payments from anon, authenticated;
grant select on public.payment_methods to authenticated;
grant insert (tenant_id, name) on public.payment_methods to authenticated;
grant update (name, active) on public.payment_methods to authenticated;
grant delete on public.payment_methods to authenticated;
grant select on public.payments to authenticated;

alter table public.payment_methods enable row level security;
alter table public.payments enable row level security;

create policy "Mitglieder lesen Zahlungsarten" on public.payment_methods for select to authenticated
  using (private.is_member(tenant_id));
create policy "Inhaber legen Zahlungsarten an" on public.payment_methods for insert to authenticated
  with check (private.has_role(tenant_id, 'owner'));
create policy "Inhaber ändern Zahlungsarten" on public.payment_methods for update to authenticated
  using (private.has_role(tenant_id, 'owner')) with check (private.has_role(tenant_id, 'owner'));
create policy "Inhaber löschen Zahlungsarten" on public.payment_methods for delete to authenticated
  using (private.has_role(tenant_id, 'owner'));
create policy "Mitglieder lesen Zahlungen" on public.payments for select to authenticated
  using (private.is_member(tenant_id));

select private.enable_tenant_table('public.payment_methods');
select private.enable_tenant_table('public.payments');

-- ---------------------------------------------------------------------------
-- Regeln der Zahlungsarten: neue Art ans Ende; deaktivierter Kunde; letzte aktive Art und Standard bleiben
-- (Ausnahme: der ganze Kunde wird gelöscht)
-- ---------------------------------------------------------------------------
create function private.payment_methods_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := coalesce(new.tenant_id, old.tenant_id);
begin
  -- Kunde wird gelöscht (Kaskade): keine Regeln
  if not exists (select 1 from public.tenants t where t.id = v_tenant) then
    return coalesce(new, old);
  end if;
  if auth.uid() is not null and exists (select 1 from public.tenants t where t.id = v_tenant and t.status = 'deactivated') then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  if tg_op = 'INSERT' then
    -- Ohne eigene Stelle (Anlegen in den Einstellungen) ans Ende; die Standardarten bringen ihre Stelle mit
    if new.position <= 0 then
      select coalesce(max(m.position), 0) + 1 into new.position from public.payment_methods m where m.tenant_id = new.tenant_id;
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.active then
    return new;
  end if;
  if old.is_default and (tg_op = 'DELETE' or not new.active) then
    raise exception 'Bitte zuerst eine andere Zahlungsart als Standard wählen.' using errcode = 'P0963';
  end if;
  if old.active and not exists (
    select 1 from public.payment_methods m where m.tenant_id = old.tenant_id and m.active and m.id <> old.id
  ) then
    raise exception 'Mindestens eine Zahlungsart muss aktiv bleiben.' using errcode = 'P0962';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger payment_methods_rules before insert or update or delete on public.payment_methods
  for each row execute function private.payment_methods_rules();

-- Standardarten eines Kunden (bestehende Kunden jetzt, neue beim Anlegen)
create function private.seed_payment_methods(p_tenant_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.payment_methods (tenant_id, name, position, is_default)
  select p_tenant_id, d.name, d.position, d.position = 1
  from (values (1, 'Überweisung'), (2, 'Bar'), (3, 'Karte'), (4, 'PayPal'), (5, 'über booking.com'), (6, 'über Airbnb')) as d (position, name)
  where not exists (select 1 from public.payment_methods m where m.tenant_id = p_tenant_id);
$$;

create function private.tenants_seed_payment_methods()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_payment_methods(new.id);
  return null;
end;
$$;

create trigger tenants_seed_payment_methods after insert on public.tenants
  for each row execute function private.tenants_seed_payment_methods();

select private.seed_payment_methods(t.id) from public.tenants t;

-- Standard setzen (nur Inhaber): nur aktive Arten
create function private.set_default_payment_method(p_tenant_id uuid, p_method_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0950';
  end if;
  if exists (select 1 from public.tenants t where t.id = p_tenant_id and t.status = 'deactivated') then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  perform 1 from public.payment_methods m where m.tenant_id = p_tenant_id for update;
  if not exists (select 1 from public.payment_methods m where m.id = p_method_id and m.tenant_id = p_tenant_id and m.active) then
    raise exception 'Zahlungsart nicht verfügbar.' using errcode = 'P0964';
  end if;
  update public.payment_methods set is_default = false where tenant_id = p_tenant_id and is_default and id <> p_method_id;
  update public.payment_methods set is_default = true where id = p_method_id and not is_default;
end;
$$;

-- Reihenfolge setzen (nur Inhaber): alle Arten des Kunden in der gewünschten Folge
create function private.reorder_payment_methods(p_tenant_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0950';
  end if;
  if exists (select 1 from public.tenants t where t.id = p_tenant_id and t.status = 'deactivated') then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  perform 1 from public.payment_methods m where m.tenant_id = p_tenant_id for update;
  if coalesce(array_length(p_ids, 1), 0) <> (select count(*) from public.payment_methods m where m.tenant_id = p_tenant_id)
      or (select count(distinct x) from unnest(p_ids) x) <> coalesce(array_length(p_ids, 1), 0)
      or exists (select 1 from unnest(p_ids) x where not exists (select 1 from public.payment_methods m where m.id = x and m.tenant_id = p_tenant_id)) then
    raise exception 'Die Zahlungsarten wurden inzwischen geändert.' using errcode = 'P0964';
  end if;
  update public.payment_methods m set position = o.ord
  from unnest(p_ids) with ordinality as o (id, ord)
  where m.id = o.id and m.position is distinct from o.ord;
end;
$$;

create function public.set_default_payment_method(p_tenant_id uuid, p_method_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.set_default_payment_method(p_tenant_id, p_method_id); $$;
create function public.reorder_payment_methods(p_tenant_id uuid, p_ids uuid[])
returns void language sql security invoker set search_path = ''
as $$ select private.reorder_payment_methods(p_tenant_id, p_ids); $$;

-- ---------------------------------------------------------------------------
-- Speicherbereich für Belege: privat, PDF und JPEG bis 10 MB, ein Ordner je Kunde
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 10485760, array['application/pdf', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf', 'image/jpeg'];

-- Kunde eines Speicherorts <Kunde>/<zufällig>.pdf|.jpg (null bei jedem anderen Format)
create function private.receipt_tenant(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg)$'
    then split_part(p_name, '/', 1)::uuid end;
$$;

-- Lesen nur für Mitglieder und nur Belege, die an einer Zahlung dieses Kunden hängen
create function private.can_read_receipt(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.receipt_tenant(p_name) is not null
    and private.is_member(private.receipt_tenant(p_name))
    and exists (select 1 from public.payments p where p.tenant_id = private.receipt_tenant(p_name) and p.receipt_path = p_name);
$$;

create policy "Mitglieder laden Belege in den eigenen Ordner"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and private.receipt_tenant(name) is not null
    and private.is_member(private.receipt_tenant(name))
  );
create policy "Mitglieder lesen verwendete Belege"
  on storage.objects for select to authenticated
  using (bucket_id = 'payment-receipts' and private.can_read_receipt(name));
-- Kein Ändern oder Löschen durch Nutzer (nur der Server mit geheimem Schlüssel)

-- Tägliche Bereinigung: Belege älter als 24 Stunden ohne Zahlung. Nur für den Server.
create function public.unused_payment_receipts(p_limit integer default 1000)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'payment-receipts'
    and o.created_at < now() - interval '24 hours'
    and not exists (select 1 from public.payments p where p.receipt_path = o.name)
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

-- ---------------------------------------------------------------------------
-- Zahlungsstand je Rechnung (Lesesicht mit den Rechten des Lesenden, nur Mitglieder)
-- mode: payable (zahlbar), cancelled (storniert), credit (Gutschrift), none (Entwurf ausgenommen; Altrechnung ≤ 0)
-- ---------------------------------------------------------------------------
create view public.invoice_payment_status
with (security_invoker = true)
as
with sums as (
  select
    i.id,
    i.tenant_id,
    i.origin,
    i.kind,
    i.total_cents,
    i.issued_snapshot -> 'schedule' as schedule,
    c.id as credit_id,
    coalesce((select sum(p.amount_cents) from public.payments p where p.invoice_id = i.id and p.kind = 'payment'), 0)::bigint as received,
    coalesce((select sum(p.commission_cents) from public.payments p where p.invoice_id = i.id and p.kind = 'payment'), 0)::bigint as commission,
    coalesce((select sum(p.fee_cents) from public.payments p where p.invoice_id = i.id and p.kind = 'payment'), 0)::bigint as fee,
    -- Rückzahlungen an dieser Gutschrift bzw. an der Gutschrift dieser stornierten Rechnung
    coalesce((select sum(p.amount_cents) from public.payments p where p.invoice_id = coalesce(c.id, i.id) and p.kind = 'refund'), 0)::bigint as refunded,
    -- Gutschrift: eingegangen an der stornierten Rechnung
    coalesce((select sum(p.amount_cents) from public.payments p where p.invoice_id = i.credited_invoice_id and p.kind = 'payment'), 0)::bigint as linked_received
  from public.invoices i
  left join public.invoices c on c.credited_invoice_id = i.id
  where i.origin <> 'draft' and private.is_member(i.tenant_id)
),
modes as (
  select s.*,
    case
      when s.kind = 'credit_note' then 'credit'
      when s.credit_id is not null then 'cancelled'
      when s.origin = 'backfilled' and s.total_cents <= 0 then 'none'
      else 'payable'
    end as mode,
    s.received + s.commission + s.fee as settled,
    (now() at time zone 'Europe/Vienna')::date as today
  from sums s
)
select
  m.id as invoice_id,
  m.tenant_id,
  m.mode,
  case when m.mode = 'payable' then
    case when m.received + m.commission + m.fee <= 0 then 'open'
         when m.settled < m.total_cents then 'partial'
         when m.settled = m.total_cents then 'paid'
         else 'overpaid' end
  end as status,
  m.total_cents,
  m.received as received_cents,
  m.commission as commission_cents,
  m.fee as fee_cents,
  m.settled as settled_cents,
  case when m.mode = 'payable' then m.total_cents - m.settled else 0 end::bigint as open_cents,
  -- Überfällig: nach einem Fälligkeitstag weniger beglichen als bis dahin fällig (nur in der App ausgestellte Rechnungen)
  coalesce(m.mode = 'payable' and m.origin = 'issued' and m.schedule is not null and m.settled < (
    case
      when m.today > (m.schedule ->> 'due')::date then m.total_cents
      when m.schedule ->> 'depositDue' is not null and m.schedule ->> 'depositCents' is not null
        and m.today > (m.schedule ->> 'depositDue')::date then (m.schedule ->> 'depositCents')::bigint
      else 0
    end
  ), false) as overdue,
  case m.mode
    when 'credit' then m.linked_received - m.refunded
    when 'cancelled' then m.received - m.refunded
    else 0
  end::bigint as balance_cents,
  case when m.mode in ('credit', 'cancelled') then m.refunded else 0 end::bigint as refunded_cents
from modes m;

comment on view public.invoice_payment_status is 'Zahlungsstand je Rechnung (PROJ-45): Status, Summen, Offen, Guthaben, überfällig. Gleiche Regel wie computePaymentState in src/lib/payments.ts.';

-- ---------------------------------------------------------------------------
-- Zahlungsliste (Lesesicht) und Summen über denselben Filter
-- ---------------------------------------------------------------------------
create view public.payment_list
with (security_invoker = true)
as
select
  p.id,
  p.tenant_id,
  p.kind,
  p.paid_on,
  p.amount_cents,
  p.commission_cents,
  p.fee_cents,
  p.method_id,
  m.name as method_name,
  p.note,
  p.receipt_path,
  p.created_at,
  p.invoice_id,
  i.number as invoice_number,
  i.recipient,
  b.id as booking_id,
  b.number as booking_number
from public.payments p
join public.invoices i on i.id = p.invoice_id
join public.payment_methods m on m.id = p.method_id
left join public.bookings b on b.id = i.booking_id;

create function public.payment_list_totals(p_tenant_id uuid, p_from date, p_to date, p_method_id uuid, p_query text)
returns table (received_cents bigint, commission_cents bigint, fee_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(case when l.kind = 'refund' then -l.amount_cents else l.amount_cents end), 0)::bigint,
    coalesce(sum(l.commission_cents), 0)::bigint,
    coalesce(sum(l.fee_cents), 0)::bigint
  from public.payment_list l
  where l.tenant_id = p_tenant_id
    and (p_from is null or l.paid_on >= p_from)
    and (p_to is null or l.paid_on < p_to)
    and (p_method_id is null or l.method_id = p_method_id)
    and (
      p_query is null or p_query = ''
      or l.invoice_number ilike '%' || p_query || '%'
      or l.recipient ilike '%' || p_query || '%'
      or l.note ilike '%' || p_query || '%'
    );
$$;

-- ---------------------------------------------------------------------------
-- Zahlung erfassen bzw. ändern (gemeinsamer Kern)
-- p_input: tenant_id, kind (payment|refund), invoice_id, paid_on, amount_cents, commission_cents, fee_cents, method_id, note,
--   receipt_path, confirmed; beim Ändern zusätzlich id, updated_at.
-- Ergebnis: {saved, id, warnings, invoice_id, previous_invoice_id, booking_ids, unused_receipt}. Hinweise (Überzahlung,
-- gleiche Zahlung, Rückzahlung über dem Guthaben) ohne confirmed → saved = false, nichts gespeichert.
-- ---------------------------------------------------------------------------
create function private.save_payment(p_input jsonb, p_update boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_kind text := p_input ->> 'kind';
  v_invoice_id uuid;
  v_paid_on date;
  v_amount bigint;
  v_commission bigint;
  v_fee bigint;
  v_method uuid;
  v_note text := nullif(btrim(coalesce(p_input ->> 'note', '')), '');
  v_receipt text := nullif(p_input ->> 'receipt_path', '');
  v_confirmed boolean := coalesce((p_input ->> 'confirmed')::boolean, false);
  v_old public.payments;
  v_invoice public.invoices;
  v_other public.invoices;
  v_today date := (now() at time zone 'Europe/Vienna')::date;
  v_settled bigint;
  v_balance bigint;
  v_warnings jsonb := '[]'::jsonb;
  v_id uuid;
begin
  begin
    v_tenant := (p_input ->> 'tenant_id')::uuid;
    v_invoice_id := (p_input ->> 'invoice_id')::uuid;
    v_paid_on := (p_input ->> 'paid_on')::date;
    v_amount := (p_input ->> 'amount_cents')::bigint;
    v_commission := coalesce((p_input ->> 'commission_cents')::bigint, 0);
    v_fee := coalesce((p_input ->> 'fee_cents')::bigint, 0);
    v_method := (p_input ->> 'method_id')::uuid;
  exception when others then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end;
  if v_actor is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if v_tenant is null or v_invoice_id is null or v_paid_on is null or v_method is null or v_kind not in ('payment', 'refund')
      or length(coalesce(v_note, '')) > 300 then
    raise exception 'Ungültige Eingabe.' using errcode = '22023';
  end if;
  if not private.is_member(v_tenant) then
    raise exception 'Nicht gefunden.' using errcode = 'P0951';
  end if;
  if p_update and not private.has_role(v_tenant, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0950';
  end if;
  if exists (select 1 from public.tenants t where t.id = v_tenant and t.status = 'deactivated') then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  if v_amount is null or v_amount not between 1 and 999999999 or v_commission not between 0 and 999999999 or v_fee not between 0 and 999999999
      or (v_kind = 'refund' and (v_commission > 0 or v_fee > 0)) then
    raise exception 'Betrag ungültig.' using errcode = 'P0956';
  end if;
  if v_paid_on > v_today then
    raise exception 'Das Zahlungsdatum liegt in der Zukunft.' using errcode = 'P0955';
  end if;

  if p_update then
    select * into v_old from public.payments where id = (p_input ->> 'id')::uuid and tenant_id = v_tenant;
    if v_old.id is null then
      raise exception 'Zahlung nicht gefunden.' using errcode = 'P0951';
    end if;
    if v_old.kind <> v_kind then
      raise exception 'Ungültige Eingabe.' using errcode = '22023';
    end if;
    -- Rechnungen in fester Reihenfolge sperren (keine Verklemmung mit gleichzeitigem Umhängen oder Storno)
    perform 1 from public.invoices i where i.id in (v_old.invoice_id, v_invoice_id) and i.tenant_id = v_tenant order by i.id for update;
    select * into v_old from public.payments where id = v_old.id for update;
    if v_old.updated_at is distinct from (p_input ->> 'updated_at')::timestamptz then
      raise exception 'Die Zahlung wurde inzwischen geändert.' using errcode = 'P0960';
    end if;
  end if;

  -- Sperre auf der Rechnung, wie beim Ausstellen der Gutschrift (PROJ-44)
  select * into v_invoice from public.invoices where id = v_invoice_id and tenant_id = v_tenant for update;
  if v_invoice.id is null then
    raise exception 'Rechnung nicht gefunden.' using errcode = 'P0951';
  end if;

  if v_kind = 'payment' then
    if v_invoice.origin = 'draft' or v_invoice.kind = 'credit_note' or (v_invoice.origin = 'backfilled' and v_invoice.total_cents <= 0) then
      raise exception 'An dieser Rechnung lässt sich keine Zahlung erfassen.' using errcode = 'P0952';
    end if;
    -- Stornierte Rechnung: keine neuen Zahlungen; vorhandene bleiben änderbar, solange sie dort bleiben
    if private.is_credited(v_invoice.id) and not (p_update and v_old.invoice_id = v_invoice.id) then
      raise exception 'Die Rechnung wurde inzwischen storniert.' using errcode = 'P0953';
    end if;
    -- Provision und Gebühr nur bei Plattform-Buchungen; eine bestehende Zahlung an derselben Rechnung behält ihre Werte
    if (v_commission > 0 or v_fee > 0) and not private.is_platform_booking(v_invoice.booking_id)
        and not (p_update and v_old.invoice_id = v_invoice.id and v_commission <= v_old.commission_cents and v_fee <= v_old.fee_cents) then
      raise exception 'Provision und Zahlungsgebühr sind nur bei Buchungen über booking.com oder Airbnb möglich.' using errcode = 'P0957';
    end if;
  elsif v_invoice.kind is distinct from 'credit_note' then
    raise exception 'Rückzahlungen gehören an eine Gutschrift.' using errcode = 'P0954';
  end if;

  -- Zahlungsart: aktiv, oder beim Ändern die bisherige
  if not exists (
    select 1 from public.payment_methods m
    where m.id = v_method and m.tenant_id = v_tenant and (m.active or (p_update and m.id = v_old.method_id))
  ) then
    raise exception 'Diese Zahlungsart ist nicht mehr verfügbar.' using errcode = 'P0958';
  end if;

  -- Beleg: im Ordner des Kunden, im Speicher vorhanden, an keiner anderen Zahlung
  if v_receipt is not null and v_receipt is distinct from v_old.receipt_path then
    if private.receipt_tenant(v_receipt) is distinct from v_tenant
        or not exists (select 1 from storage.objects o where o.bucket_id = 'payment-receipts' and o.name = v_receipt)
        or exists (select 1 from public.payments p where p.receipt_path = v_receipt) then
      raise exception 'Der Beleg fehlt im Speicher.' using errcode = 'P0959';
    end if;
  end if;

  -- Hinweise vor dem Speichern
  if not v_confirmed then
    if v_kind = 'payment' then
      select coalesce(sum(p.amount_cents + p.commission_cents + p.fee_cents), 0) into v_settled
      from public.payments p where p.invoice_id = v_invoice.id and p.kind = 'payment' and p.id is distinct from v_old.id;
      if v_settled + v_amount + v_commission + v_fee > v_invoice.total_cents
          and v_settled + v_amount + v_commission + v_fee > greatest(v_settled, v_invoice.total_cents) then
        v_warnings := v_warnings || jsonb_build_object('code', 'overpaid', 'cents', v_settled + v_amount + v_commission + v_fee - greatest(v_settled, v_invoice.total_cents));
      end if;
    else
      select coalesce(sum(p.amount_cents), 0) into v_balance
      from public.payments p where p.invoice_id = v_invoice.credited_invoice_id and p.kind = 'payment';
      select v_balance - coalesce(sum(p.amount_cents), 0) into v_balance
      from public.payments p where p.invoice_id = v_invoice.id and p.kind = 'refund' and p.id is distinct from v_old.id;
      if v_amount > greatest(v_balance, 0) then
        v_warnings := v_warnings || jsonb_build_object('code', 'refundOver', 'cents', v_amount - greatest(v_balance, 0));
      end if;
    end if;
    if exists (
      select 1 from public.payments p
      where p.invoice_id = v_invoice.id and p.kind = v_kind and p.paid_on = v_paid_on and p.amount_cents = v_amount and p.id is distinct from v_old.id
    ) then
      v_warnings := v_warnings || jsonb_build_object('code', 'duplicate', 'cents', v_amount, 'date', v_paid_on);
    end if;
    if jsonb_array_length(v_warnings) > 0 then
      return jsonb_build_object('saved', false, 'warnings', v_warnings);
    end if;
  end if;

  if p_update then
    update public.payments set
      invoice_id = v_invoice.id,
      paid_on = v_paid_on,
      amount_cents = v_amount,
      commission_cents = v_commission,
      fee_cents = v_fee,
      method_id = v_method,
      note = v_note,
      receipt_path = v_receipt
    where id = v_old.id
    returning id into v_id;
    if v_old.invoice_id <> v_invoice.id then
      select * into v_other from public.invoices where id = v_old.invoice_id;
    end if;
  else
    insert into public.payments (tenant_id, invoice_id, kind, paid_on, amount_cents, commission_cents, fee_cents, method_id, note, receipt_path)
    values (v_tenant, v_invoice.id, v_kind, v_paid_on, v_amount, v_commission, v_fee, v_method, v_note, v_receipt)
    returning id into v_id;
  end if;

  return jsonb_build_object(
    'saved', true,
    'id', v_id,
    'invoice_id', v_invoice.id,
    'previous_invoice_id', case when p_update and v_old.invoice_id <> v_invoice.id then v_old.invoice_id end,
    'booking_ids', jsonb_build_array(v_invoice.booking_id, v_other.booking_id),
    'unused_receipt', case when p_update and v_old.receipt_path is distinct from v_receipt then v_old.receipt_path end
  );
end;
$$;

create function public.record_payment(p_input jsonb)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.save_payment(p_input, false); $$;
create function public.update_payment(p_input jsonb)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.save_payment(p_input, true); $$;

-- Zahlung löschen (nur Inhaber). Ergebnis: {invoice_id, booking_id, receipt_path}
create function private.delete_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_booking uuid;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if v_payment.id is null or not private.is_member(v_payment.tenant_id) then
    raise exception 'Zahlung nicht gefunden.' using errcode = 'P0951';
  end if;
  if not private.has_role(v_payment.tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0950';
  end if;
  if exists (select 1 from public.tenants t where t.id = v_payment.tenant_id and t.status = 'deactivated') then
    raise exception 'Der Kunde ist deaktiviert.' using errcode = 'P0016';
  end if;
  select i.booking_id into v_booking from public.invoices i where i.id = v_payment.invoice_id;
  delete from public.payments where id = p_payment_id;
  return jsonb_build_object('invoice_id', v_payment.invoice_id, 'booking_id', v_booking, 'receipt_path', v_payment.receipt_path);
end;
$$;

create function public.delete_payment(p_payment_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.delete_payment(p_payment_id); $$;

-- Umhängen (nur Inhaber): zahlbare Rechnungen des Kunden, die der gleichen Buchung zuerst; Suche nach Nummer oder Empfänger
create function private.search_payable_invoices(p_tenant_id uuid, p_query text, p_booking_id uuid, p_limit integer default 20)
returns table (id uuid, number text, kind text, recipient text, open_cents bigint, booking_id uuid, platform boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0950';
  end if;
  return query
  select i.id, i.number, i.kind, i.recipient,
    i.total_cents - coalesce((select sum(p.amount_cents + p.commission_cents + p.fee_cents) from public.payments p where p.invoice_id = i.id and p.kind = 'payment'), 0)::bigint,
    i.booking_id,
    private.is_platform_booking(i.booking_id)
  from public.invoices i
  where i.tenant_id = p_tenant_id
    and i.origin <> 'draft'
    and i.kind is distinct from 'credit_note'
    and not (i.origin = 'backfilled' and i.total_cents <= 0)
    and not private.is_credited(i.id)
    and (
      coalesce(p_query, '') = ''
      or i.number ilike '%' || p_query || '%'
      or i.recipient ilike '%' || p_query || '%'
    )
  order by (i.booking_id is not distinct from p_booking_id and p_booking_id is not null) desc, i.invoice_date desc, i.number desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

create function public.search_payable_invoices(p_tenant_id uuid, p_query text, p_booking_id uuid, p_limit integer default 20)
returns table (id uuid, number text, kind text, recipient text, open_cents bigint, booking_id uuid, platform boolean)
language sql security invoker set search_path = ''
as $$ select * from private.search_payable_invoices(p_tenant_id, p_query, p_booking_id, p_limit); $$;

-- ---------------------------------------------------------------------------
-- Rechnung löschen: nicht, solange Zahlungen daran hängen (Fassung aus 20261105093618 plus Sperre)
-- ---------------------------------------------------------------------------
create or replace function private.delete_invoice(p_invoice_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
  v_final text;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if v_invoice.id is null or v_invoice.origin <> 'backfilled' or not (private.is_member(v_invoice.tenant_id) or private.is_admin()) then
    raise exception 'Rechnung nicht gefunden.' using errcode = 'P0902';
  end if;
  if not private.has_role(v_invoice.tenant_id, 'owner') then
    raise exception 'Nur für Inhaber.' using errcode = 'P0901';
  end if;
  v_final := private.issued_final_deducting(p_invoice_id);
  if v_final is not null then
    raise exception 'Eine ausgestellte Schlussrechnung zieht diese Rechnung ab.' using errcode = 'P0933', detail = v_final;
  end if;
  if exists (select 1 from public.payments p where p.invoice_id = p_invoice_id) then
    raise exception 'Diese Rechnung hat Zahlungen.' using errcode = 'P0961';
  end if;
  perform private.detach_deductions(p_invoice_id);
  delete from public.invoices where id = p_invoice_id;
  return v_invoice.pdf_path;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechnung nacherfassen mit „Bereits bezahlt“: Rechnung und Zahlung über den vollen Betrag in einem Schritt.
-- p_input wie bisher, optional already_paid {paid_on, method_id, commission_cents, fee_cents} (nur beim Anlegen).
-- ---------------------------------------------------------------------------
create or replace function public.save_invoice(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb := private.save_invoice(p_input - 'already_paid');
  v_paid jsonb := p_input -> 'already_paid';
  v_total bigint;
  v_commission bigint;
  v_fee bigint;
  v_payment jsonb;
begin
  if jsonb_typeof(v_paid) = 'object' and nullif(p_input ->> 'id', '') is null then
    select i.total_cents into v_total from public.invoices i where i.id = (v_result ->> 'id')::uuid;
    v_commission := coalesce((v_paid ->> 'commission_cents')::bigint, 0);
    v_fee := coalesce((v_paid ->> 'fee_cents')::bigint, 0);
    v_payment := private.save_payment(jsonb_build_object(
      'tenant_id', p_input ->> 'tenant_id',
      'kind', 'payment',
      'invoice_id', v_result ->> 'id',
      'paid_on', v_paid ->> 'paid_on',
      'amount_cents', v_total - v_commission - v_fee,
      'commission_cents', v_commission,
      'fee_cents', v_fee,
      'method_id', v_paid ->> 'method_id',
      'confirmed', true
    ), false);
  end if;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ausführungsrechte
-- ---------------------------------------------------------------------------
revoke execute on function private.is_platform_booking(uuid) from public, anon;
revoke execute on function private.payment_methods_rules() from public, anon, authenticated;
revoke execute on function private.seed_payment_methods(uuid) from public, anon, authenticated;
revoke execute on function private.tenants_seed_payment_methods() from public, anon, authenticated;
revoke execute on function private.set_default_payment_method(uuid, uuid) from public, anon;
revoke execute on function private.reorder_payment_methods(uuid, uuid[]) from public, anon;
revoke execute on function public.set_default_payment_method(uuid, uuid) from public, anon;
revoke execute on function public.reorder_payment_methods(uuid, uuid[]) from public, anon;
revoke execute on function private.receipt_tenant(text) from public, anon;
revoke execute on function private.can_read_receipt(text) from public, anon;
revoke execute on function public.unused_payment_receipts(integer) from public, anon, authenticated;
revoke execute on function public.payment_list_totals(uuid, date, date, uuid, text) from public, anon;
revoke execute on function private.save_payment(jsonb, boolean) from public, anon;
revoke execute on function public.record_payment(jsonb) from public, anon;
revoke execute on function public.update_payment(jsonb) from public, anon;
revoke execute on function private.delete_payment(uuid) from public, anon;
revoke execute on function public.delete_payment(uuid) from public, anon;
revoke execute on function private.search_payable_invoices(uuid, text, uuid, integer) from public, anon;
revoke execute on function public.search_payable_invoices(uuid, text, uuid, integer) from public, anon;
revoke execute on function public.save_invoice(jsonb) from public, anon;

grant execute on function private.is_platform_booking(uuid) to authenticated;
grant execute on function private.set_default_payment_method(uuid, uuid) to authenticated;
grant execute on function private.reorder_payment_methods(uuid, uuid[]) to authenticated;
grant execute on function public.set_default_payment_method(uuid, uuid) to authenticated;
grant execute on function public.reorder_payment_methods(uuid, uuid[]) to authenticated;
grant execute on function private.receipt_tenant(text) to authenticated, service_role;
grant execute on function private.can_read_receipt(text) to authenticated, service_role;
grant execute on function public.unused_payment_receipts(integer) to service_role;
grant execute on function public.payment_list_totals(uuid, date, date, uuid, text) to authenticated;
grant execute on function private.save_payment(jsonb, boolean) to authenticated;
grant execute on function public.record_payment(jsonb) to authenticated;
grant execute on function public.update_payment(jsonb) to authenticated;
grant execute on function private.delete_payment(uuid) to authenticated;
grant execute on function public.delete_payment(uuid) to authenticated;
grant execute on function private.search_payable_invoices(uuid, text, uuid, integer) to authenticated;
grant execute on function public.search_payable_invoices(uuid, text, uuid, integer) to authenticated;
grant execute on function public.save_invoice(jsonb) to authenticated;

revoke all on public.invoice_payment_status from anon, authenticated;
revoke all on public.payment_list from anon, authenticated;
grant select on public.invoice_payment_status to authenticated;
grant select on public.payment_list to authenticated;
