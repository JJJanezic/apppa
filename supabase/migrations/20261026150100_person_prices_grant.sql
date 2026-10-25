-- PROJ-27: Die Prüfregel apartments_child_prices_check ruft private.valid_child_prices auf. Sie wird mit den Rechten
-- der schreibenden Rolle ausgeführt, also auch für die Systemrolle (Tests, Betreiber-Vorgänge mit Secret Key).
grant execute on function private.valid_child_prices(jsonb) to service_role;
