-- PROJ-41 Briefpapier
-- * invoice_settings: Abschnitt „Briefpapier“ (Grundschrift, Grundgröße, Zeilen- und Absatzabstand, Logo-Position und
--   -Höhe, Aussteller-Block) mit eigenem Änderungsstempel. Alle Kunden erhalten die Standardwerte über die Vorgaben der
--   Spalten; Entwürfe bleiben unverändert. Gleiche Regeln wie src/lib/letterhead.ts.
-- * save_invoice_letterhead: Schreiben nur über diese Funktion (Inhaber, Betreiber); Protokoll ohne Werte.
-- * invoice_preview_data liefert zusätzlich das Briefpapier: Mitarbeiter sehen Entwürfe in dieser Gestaltung, lesen die
--   Rechnungseinstellungen selbst aber weiterhin nicht.
-- Fehlercodes: P0910 Stand veraltet, P0914 Inhalt ungültig; P0011/P0016 aus private.lock_tenant; 42501 keine Berechtigung.

alter table public.invoice_settings
  add column letterhead_font text not null default 'carlito'
    check (letterhead_font in ('arimo', 'tinos', 'carlito', 'source-sans', 'source-serif', 'open-sans')),
  add column letterhead_font_size numeric(3, 1) not null default 11
    check (letterhead_font_size between 8 and 14 and letterhead_font_size * 2 = trunc(letterhead_font_size * 2)),
  add column letterhead_line_spacing text not null default 'normal' check (letterhead_line_spacing in ('tight', 'normal', 'wide')),
  add column letterhead_paragraph_spacing text not null default 'normal' check (letterhead_paragraph_spacing in ('tight', 'normal', 'wide')),
  add column letterhead_logo_position text not null default 'left' check (letterhead_logo_position in ('left', 'center', 'right')),
  add column letterhead_logo_height_mm smallint not null default 25 check (letterhead_logo_height_mm between 10 and 35),
  add column letterhead_show_issuer boolean not null default true,
  add column letterhead_updated_at timestamptz not null default now();

comment on column public.invoice_settings.letterhead_show_issuer is
  'Aussteller-Block im Kopf der Rechnung (PROJ-41). Abgeschaltet müssen die Pflichtangaben im Fußzeilentext stehen; die App prüft das nicht.';

-- ---------------------------------------------------------------------------
-- Briefpapier speichern
-- ---------------------------------------------------------------------------
create function private.save_invoice_letterhead(p_tenant_id uuid, p_expected_updated_at timestamptz, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.invoice_settings;
  v_font text := p_data ->> 'font';
  v_size numeric;
  v_line text := p_data ->> 'line_spacing';
  v_paragraph text := p_data ->> 'paragraph_spacing';
  v_position text := p_data ->> 'logo_position';
  v_height numeric;
  v_issuer boolean;
begin
  perform private.require_invoice_settings_editor(p_tenant_id);
  select * into v_old from public.invoice_settings where tenant_id = p_tenant_id for update;
  if v_old.id is null then
    raise exception 'Diesen Kunden gibt es nicht mehr.' using errcode = 'P0011';
  end if;
  if v_old.letterhead_updated_at is distinct from p_expected_updated_at then
    raise exception 'Die Einstellungen wurden inzwischen geändert.' using errcode = 'P0910';
  end if;

  if jsonb_typeof(p_data -> 'font_size') <> 'number' or jsonb_typeof(p_data -> 'logo_height_mm') <> 'number'
      or jsonb_typeof(p_data -> 'show_issuer') <> 'boolean' then
    raise exception 'Ungültige Werte.' using errcode = 'P0914';
  end if;
  v_size := (p_data ->> 'font_size')::numeric;
  v_height := (p_data ->> 'logo_height_mm')::numeric;
  v_issuer := (p_data ->> 'show_issuer')::boolean;
  if v_font is null or v_font not in ('arimo', 'tinos', 'carlito', 'source-sans', 'source-serif', 'open-sans')
      or v_size not between 8 and 14 or v_size * 2 <> trunc(v_size * 2)
      or v_line is null or v_line not in ('tight', 'normal', 'wide')
      or v_paragraph is null or v_paragraph not in ('tight', 'normal', 'wide')
      or v_position is null or v_position not in ('left', 'center', 'right')
      or v_height not between 10 and 35 or v_height <> trunc(v_height) then
    raise exception 'Ungültige Werte.' using errcode = 'P0914';
  end if;

  if (v_font, v_size, v_line, v_paragraph, v_position, v_height, v_issuer)
      is not distinct from (v_old.letterhead_font, v_old.letterhead_font_size, v_old.letterhead_line_spacing,
        v_old.letterhead_paragraph_spacing, v_old.letterhead_logo_position, v_old.letterhead_logo_height_mm::numeric,
        v_old.letterhead_show_issuer) then
    return;
  end if;

  update public.invoice_settings set
    letterhead_font = v_font,
    letterhead_font_size = v_size,
    letterhead_line_spacing = v_line,
    letterhead_paragraph_spacing = v_paragraph,
    letterhead_logo_position = v_position,
    letterhead_logo_height_mm = v_height::smallint,
    letterhead_show_issuer = v_issuer,
    letterhead_updated_at = now()
  where id = v_old.id;

  perform private.log_invoice_settings(p_tenant_id, 'invoice_settings', array['letterhead']);
end;
$$;

create function public.save_invoice_letterhead(p_tenant_id uuid, p_expected_updated_at timestamptz, p_data jsonb)
returns void
language sql security invoker set search_path = ''
as $$ select private.save_invoice_letterhead(p_tenant_id, p_expected_updated_at, p_data); $$;

revoke execute on function private.save_invoice_letterhead(uuid, timestamptz, jsonb) from public, anon;
revoke execute on function public.save_invoice_letterhead(uuid, timestamptz, jsonb) from public, anon;
grant execute on function private.save_invoice_letterhead(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.save_invoice_letterhead(uuid, timestamptz, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Vorschau-Daten für Inhaber und Mitarbeiter, jetzt mit Briefpapier
-- ---------------------------------------------------------------------------
create or replace function private.invoice_preview_data(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_tenant_id is null or not private.is_member(p_tenant_id) then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'issuer', jsonb_build_object(
        'name', t.name, 'name_line2', t.name_line2, 'address_line1', t.address_line1, 'address_line2', t.address_line2,
        'postal_code', t.postal_code, 'city', t.city, 'country', t.country, 'vat_id', t.vat_id
      ),
      'footer', s.footer,
      'small_business_note', s.small_business_note,
      'vat_status', coalesce((
        select jsonb_agg(jsonb_build_object('valid_from', v.valid_from, 'small_business', v.small_business) order by v.valid_from)
        from public.vat_status_changes v where v.tenant_id = t.id
      ), '[]'::jsonb),
      'letterhead', jsonb_build_object(
        'font', s.letterhead_font, 'font_size', s.letterhead_font_size, 'line_spacing', s.letterhead_line_spacing,
        'paragraph_spacing', s.letterhead_paragraph_spacing, 'logo_position', s.letterhead_logo_position,
        'logo_height_mm', s.letterhead_logo_height_mm, 'show_issuer', s.letterhead_show_issuer
      )
    )
    from public.tenants t
    left join public.invoice_settings s on s.tenant_id = t.id
    where t.id = p_tenant_id
  );
end;
$$;
