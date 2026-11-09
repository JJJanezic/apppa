-- PROJ-26: Korrektur zu 20261109131519_guest_sheet_ranges_geder.sql. Für „FW WM Geder - Mag. Tanja Geder“ waren die beiden
-- Bereiche schon in der App erfasst, die Migration hat deshalb nichts geändert. Hier werden die vorhandenen Bereiche gesetzt
-- (Angabe des Nutzers 2026-11-09):
-- * 0449001–0449050: aufgebraucht
-- * 0449051–0449100: in Verwendung, nächste freie Nummer 0449054
-- Nur dieser Kunde (genauer Name; andere Geder-Kunden bleiben unberührt). Gibt es den Kunden nicht (Dev, Staging), passiert
-- nichts. Ist der Stand schon so, passiert nichts. Stehen die Bereiche anders als erwartet, bricht die Migration ab.

do $$
declare
  v_tenant uuid;
  v_first public.guest_sheet_number_ranges;
  v_second public.guest_sheet_number_ranges;
begin
  select t.id into v_tenant
  from public.tenants t
  where lower(regexp_replace(regexp_replace(btrim(t.name), '[–—-]', '-', 'g'), '\s+', ' ', 'g'))
      = lower('FW WM Geder - Mag. Tanja Geder');
  if v_tenant is null then
    raise notice 'Kunde „FW WM Geder - Mag. Tanja Geder“ nicht vorhanden, nichts zu tun.';
    return;
  end if;

  if (select count(*) from public.guest_sheet_number_ranges r where r.tenant_id = v_tenant) <> 2 then
    raise exception 'Kunde „FW WM Geder - Mag. Tanja Geder“: erwartet genau zwei Nummernbereiche, Stand bitte prüfen.';
  end if;
  select * into v_first from public.guest_sheet_number_ranges r
  where r.tenant_id = v_tenant and r.range_from = '0449001' and r.range_to = '0449050' for update;
  select * into v_second from public.guest_sheet_number_ranges r
  where r.tenant_id = v_tenant and r.range_from = '0449051' and r.range_to = '0449100' for update;
  if v_first.id is null or v_second.id is null or v_first.municipality_code <> v_second.municipality_code
      or v_first.position > v_second.position or v_second.exhausted_at is not null then
    raise exception 'Kunde „FW WM Geder - Mag. Tanja Geder“: Bereiche 0449001–0449050 und 0449051–0449100 nicht wie erwartet.';
  end if;

  if v_first.exhausted_at is not null and v_second.next_number = '0449054' then
    raise notice 'Stand ist bereits gesetzt, nichts zu tun.';
    return;
  end if;

  update public.guest_sheet_number_ranges set exhausted_at = now(), next_number = null where id = v_first.id;
  update public.guest_sheet_number_ranges set next_number = '0449054' where id = v_second.id;
end;
$$;
