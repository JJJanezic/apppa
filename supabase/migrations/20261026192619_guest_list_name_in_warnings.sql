-- PROJ-29, BUG-1 aus QA: Die Überschneidungs-Warnung nennt den Gast in der Listen-Schreibweise mit Titeln
-- („Huber, Dr. Anna, LL.M.“) statt „Huber, Anna“. Nur der Name ändert sich; Rechte bleiben unverändert.

create or replace function private.booking_warnings_for(
  p_tenant_id uuid,
  p_apartment_id uuid,
  p_arrival date,
  p_departure date,
  p_persons integer,
  p_adults integer,
  p_exclude uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'conflicts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'kind', b.kind,
        'number', b.number,
        -- Listen-Schreibweise wie guestSortName in src/lib/guests.ts: „Huber, Dr. Anna, LL.M.“
        'guest_name', case when g.id is null then null else concat_ws(', ', g.last_name,
          nullif(concat_ws(' ', g.title_prefix, g.first_name), ''), g.title_suffix) end,
        'block_reason', b.block_reason,
        'arrival', b.arrival,
        'departure', b.departure
      ) order by b.arrival)
      from public.bookings b
      left join public.guests g on g.id = b.guest_id
      where b.tenant_id = p_tenant_id
        and b.apartment_id = p_apartment_id
        and b.id is distinct from p_exclude
        and b.cancelled_at is null
        and (b.kind <> 'option' or b.option_until >= private.today_vienna())
        and b.arrival < p_departure
        and b.departure > p_arrival
    ), '[]'::jsonb),
    'over_capacity', (
      select case when coalesce(p_persons, 0) > a.max_guests or coalesce(p_adults, 0) > a.max_adults
        then jsonb_build_object('persons', p_persons, 'max_guests', a.max_guests, 'adults', p_adults, 'max_adults', a.max_adults) end
      from public.apartments a
      where a.id = p_apartment_id and a.tenant_id = p_tenant_id
    )
  );
$$;
