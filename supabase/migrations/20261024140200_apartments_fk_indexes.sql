-- PROJ-6: Indizes für Fremdschlüssel (Performance-Advisor 0001)
create index apartments_property_tenant_idx on public.apartments (property_id, tenant_id);
create index municipalities_successor_idx on public.municipalities (successor_code);
