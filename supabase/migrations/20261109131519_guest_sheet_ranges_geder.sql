-- PROJ-26: Nummernbereiche der Gästeblätter für den Kunden „FW WM Geder - Mag. Tanja Geder“ (Übernahme aus dem Papierbuch,
-- Angabe des Nutzers 2026-11-09):
-- * 0449001–0449050: aufgebraucht
-- * 0449051–0449100: in Verwendung, nächste freie Nummer 0449054
-- Gemeinde = die Gemeinde der Objekte des Kunden. Gibt es den Kunden nicht (Dev, Staging), passiert nichts. Hat er Objekte in
-- mehreren Gemeinden oder keine Objekte, bricht die Migration ab (keine Zuordnung raten). Sind für diese Gemeinde schon
-- Bereiche erfasst, die sich mit diesen überschneiden, passiert ebenfalls nichts (erneutes Ausführen ändert nichts).

do $$
declare
  v_tenant uuid;
  v_codes text[];
begin
  -- Name ohne Rücksicht auf Groß-/Kleinschreibung, Leerzeichen und Art des Bindestrichs
  select t.id into v_tenant
  from public.tenants t
  where lower(regexp_replace(regexp_replace(btrim(t.name), '[–—-]', '-', 'g'), '\s+', ' ', 'g'))
      = lower('FW WM Geder - Mag. Tanja Geder');
  if v_tenant is null then
    raise notice 'Kunde „FW WM Geder - Mag. Tanja Geder“ nicht vorhanden, nichts zu tun.';
    return;
  end if;

  select array_agg(distinct p.municipality_code) into v_codes from public.properties p where p.tenant_id = v_tenant;
  if coalesce(cardinality(v_codes), 0) <> 1 then
    raise exception 'Kunde „FW WM Geder - Mag. Tanja Geder“: Gemeinde nicht eindeutig (%), bitte Gemeinde angeben.', coalesce(v_codes::text, 'keine Objekte');
  end if;

  if exists (
    select 1 from public.guest_sheet_number_ranges r
    where r.tenant_id = v_tenant and r.municipality_code = v_codes[1]
      and private.sheet_number_prefix(r.range_from) = ''
      and private.sheet_number_digits(r.range_from)::numeric <= 449100
      and private.sheet_number_digits(r.range_to)::numeric >= 449001
  ) then
    raise notice 'Für diesen Kunden und diese Gemeinde gibt es schon überschneidende Bereiche, nichts geändert.';
    return;
  end if;

  -- Reihenfolge der Eingabe: zuerst der aufgebrauchte, dann der laufende Bereich
  insert into public.guest_sheet_number_ranges (tenant_id, municipality_code, range_from, range_to, next_number, exhausted_at)
  values (v_tenant, v_codes[1], '0449001', '0449050', null, now());
  insert into public.guest_sheet_number_ranges (tenant_id, municipality_code, range_from, range_to, next_number)
  values (v_tenant, v_codes[1], '0449051', '0449100', '0449054');
end;
$$;
