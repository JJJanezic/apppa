# Runbook: Supabase (PROJ-1)

Entwicklung: Projekt **„apppa“** (Ref `nizgfmvjplhegoosanmu`, eu-west-1, Gratis-Tarif).
Produktion: eigenes Projekt, vor dem Pilotstart anzulegen (siehe unten).

Alle Befehle im Ordner `apppa/apppa` ausführen. Die Supabase-CLI ist als Dev-Abhängigkeit installiert (`npx supabase …`).

## 1. Einmalig: CLI verbinden

```bash
npx supabase login                                   # öffnet den Browser
npx supabase link --project-ref nizgfmvjplhegoosanmu # fragt nach dem Datenbank-Passwort
```

Neuere CLI-Versionen fragen beim `link` nicht mehr nach dem Datenbank-Passwort. Sie melden sich über den CLI-Login mit einer temporären Rolle an.

## 2. Datenbank und Auth-Einstellungen einspielen

```bash
npx supabase db push        # Migrationen aus supabase/migrations/
npx supabase config push    # Auth-Einstellungen + Mail-Vorlagen aus supabase/config.toml
npm run db:types            # src/types/database.ts neu erzeugen
npx supabase migration list # lokal und remote müssen übereinstimmen
```

Danach `npx supabase db advisors --linked` ausführen: Das Ergebnis muss leer sein.

Hinweise zu `config push`:
- `[auth.email] enable_signup` muss `true` bleiben, sonst ist der E-Mail-Login komplett abgeschaltet. Die Registrierung sperrt `[auth] enable_signup = false`.
- Die deutschen Mail-Vorlagen (`supabase/templates/`) lehnt Supabase im Gratis-Tarif mit dem eingebauten Mailversand ab. Sobald ein eigener SMTP-Dienst eingerichtet ist (`[auth.email.smtp]`, Passwort per `env(...)`), die Abschnitte `[auth.email.template.*]` in `config.toml` wieder einkommentieren.
- Vor jedem Push mit `npx supabase config diff` prüfen, was sich ändert.

**Regel:** Datenbankänderungen nur als neue Datei in `supabase/migrations/` (`npx supabase migration new <name>`), nie direkt im SQL-Editor.

## 3. Neue Fachtabelle anschließen (PROJ-6 ff.)

Jede Fachtabelle hat `id uuid`, `tenant_id uuid` und die vier Standardfelder. In derselben Migration:

```sql
alter table public.<tabelle> enable row level security;
revoke all on public.<tabelle> from anon;

create policy "Mitglieder und Admin lesen" on public.<tabelle> for select to authenticated
  using (private.is_member(tenant_id) or (select private.is_admin()));
create policy "Mitglieder legen an" on public.<tabelle> for insert to authenticated
  with check (private.is_member(tenant_id));
-- update/delete analog; Inhaber-Aktionen mit private.has_role(tenant_id, 'owner')

select private.enable_tenant_table('public.<tabelle>');  -- Standardfelder + Änderungsprotokoll
```

## 4. Ersten Betreiber-Admin einrichten

1. Dashboard → *Authentication → Users → Invite user* → `joachim@janezic.at`
2. Einladung annehmen und Passwort setzen
3. Im SQL-Editor einmalig:
   ```sql
   update public.profiles set is_operator_admin = true
   where email = 'joachim@janezic.at';
   ```
4. In der App 2FA (Authenticator-App) einrichten. **Ohne bestätigte 2FA hat das Konto keine Admin-Rechte.**

Admin-Rechte entziehen: dieselbe Anweisung mit `false`.
Angemeldete Nutzer können das Kennzeichen nicht ändern (Spaltenrechte + Trigger). Mit dem Secret Key ist es serverseitig möglich. Die automatischen Tests nutzen das, App-Code darf es nicht.

## 5. Produktionsprojekt (vor dem Pilotstart)

1. Neues Projekt anlegen: Region **eu-west-1**, Pro-Tarif
2. `npx supabase link --project-ref <prod-ref>` → `db push` → `config push`
3. In `supabase/config.toml` bzw. im Dashboard: `site_url` und Weiterleitungsadressen auf die Vercel-Adresse setzen; *Authentication → Policies*: Prüfung gegen geleakte Passwörter aktivieren
4. Eigenen Mailversand einrichten (Open Question: Brevo)
5. In Vercel (Umgebung *Production*) die drei Variablen aus `.env.local.example` mit den Werten des Produktionsprojekts setzen
6. Ersten Admin wie in Abschnitt 4 einrichten
7. Danach wieder mit der Entwicklung verbinden: `npx supabase link --project-ref nizgfmvjplhegoosanmu`

## 6. Backups und Test-Wiederherstellung (Produktion)

- Pro-Tarif: tägliche Backups, 7 Tage Aufbewahrung (*Database → Backups*)
- **Vor dem Pilotstart:** einen Tag nach dem Anlegen prüfen, dass ein Backup existiert. Dann ein Backup in ein neues, temporäres Projekt wiederherstellen (*Restore to new project*). Anzahl der Zeilen in `tenants`, `profiles`, `memberships` und `audit_log` vergleichen und das temporäre Projekt danach löschen.

## 7. Automatische Tests

`npm test` führt die RLS-Tests (`supabase/tests/rls.integration.test.ts`) gegen „apppa“ aus, wenn `.env.local` alle drei Variablen enthält. Sonst werden sie übersprungen.
Die Tests legen `test-*@example.com`-Nutzer und zwei Test-Mandanten an und löschen sie wieder. Ihre Protokolleinträge bleiben stehen, weil das Protokoll nicht löschbar ist.
