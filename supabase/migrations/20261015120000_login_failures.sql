-- PROJ-3: Fehlversuche beim Anmelden (Passwort, 2FA-Code) je Konto zählen.
-- Supabase begrenzt Anmeldungen nur pro IP-Adresse; die Sperre nach 5 Fehlversuchen in 15 Minuten
-- setzt die App selbst durch (src/lib/auth/lockout.ts).
--
-- Datensparsamkeit: Das Konto wird nur als HMAC-Hashwert der normalisierten E-Mail-Adresse gespeichert
-- (keine Klartext-Adressen von Nicht-Kunden). Einträge älter als 24 Stunden löscht der Zeitplaner.

create table public.login_failures (
  id bigint generated always as identity primary key,
  account_hash text not null check (length(account_hash) = 64),
  kind text not null check (kind in ('password', 'mfa')),
  created_at timestamptz not null default now()
);
comment on table public.login_failures is 'Fehlversuche je Konto (E-Mail als Hash). Nur serverseitig (Secret Key); Löschung nach 24 h.';

create index login_failures_account_created_idx on public.login_failures (account_hash, created_at desc);
create index login_failures_created_idx on public.login_failures (created_at);

-- Kein Zugriff für App-Rollen; nur der Server mit Secret Key (service_role) liest und schreibt
revoke all on public.login_failures from anon, authenticated;
grant select, insert, delete on public.login_failures to service_role;
alter table public.login_failures enable row level security;
-- Keine Policies: anon/authenticated sehen nichts, service_role umgeht RLS

select cron.schedule(
  'purge-login-failures',
  '20 3 * * *',
  $$delete from public.login_failures where created_at < now() - interval '24 hours'$$
);
