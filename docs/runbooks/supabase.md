# Runbook: Supabase (PROJ-1, PROJ-3)

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
- Seit PROJ-3 versendet Supabase über Brevo (Abschnitt 8). `config push` braucht deshalb die drei SMTP-Variablen, sonst bricht er ab bzw. überträgt leere Zugangsdaten. Immer so aufrufen wie in Abschnitt 8 beschrieben.
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
4. Eigenen Mailversand einrichten (Abschnitt 8, Brevo). `site_url` muss die Produktionsadresse sein, sonst zeigen die Mail-Links auf localhost
5. *Authentication → Sessions*: „Time-box user sessions“ 30 Tage und „Inactivity timeout“ 8 Stunden setzen (Pro-Tarif; zusätzlich zur Prüfung in der App)
6. In Vercel (Umgebung *Production*) die drei Variablen aus `.env.local.example` mit den Werten des Produktionsprojekts setzen
7. Ersten Admin wie in Abschnitt 4 einrichten
8. Danach wieder mit der Entwicklung verbinden: `npx supabase link --project-ref nizgfmvjplhegoosanmu`

## 6. Backups und Test-Wiederherstellung (Produktion)

- Pro-Tarif: tägliche Backups, 7 Tage Aufbewahrung (*Database → Backups*)
- **Vor dem Pilotstart:** einen Tag nach dem Anlegen prüfen, dass ein Backup existiert. Dann ein Backup in ein neues, temporäres Projekt wiederherstellen (*Restore to new project*). Anzahl der Zeilen in `tenants`, `profiles`, `memberships` und `audit_log` vergleichen und das temporäre Projekt danach löschen.

## 7. Automatische Tests

`npm test` führt die Integrationstests (`supabase/tests/*.integration.test.ts`: RLS, Auth-Konfiguration, Anmelde-Sperre, Mail-Links) gegen „apppa“ aus, wenn `.env.local` alle drei Variablen enthält. Sonst werden sie übersprungen.
Die Tests legen `test-*@example.com`-Nutzer und zwei Test-Mandanten an und löschen sie wieder. Ihre Protokolleinträge bleiben stehen, weil das Protokoll nicht löschbar ist.

## 8. Mailversand über Brevo (PROJ-3)

Supabase verschickt Einladungen, Passwort-Reset-Mails und den Hinweis „Passwort geändert“ über Brevo. Nur mit eigenem Mailversand übernimmt Supabase die deutschen Vorlagen aus `supabase/templates/`. Deren Links führen auf `/bestaetigen`; eingelöst wird erst per Knopf (Schutz vor Linkscannern).

**Was wo steht:**

| Einstellung | Ort |
|---|---|
| Server `smtp-relay.brevo.com`, Port 587, Absendername „apppa“ | `supabase/config.toml` (im Repository) |
| Absender-Adresse, SMTP-Login, SMTP-Schlüssel | nur Umgebungsvariablen beim `config push` (nie im Repository, nie in `.env.local`) |
| Domain-Bestätigung (SPF, DKIM, DMARC) | Brevo + DNS der Absender-Domain |

**Einrichten bzw. Einstellungen übertragen:**

1. Brevo → *Senders, Domains & Dedicated IPs → Domains*: Absender-Domain hinzufügen, die angezeigten DNS-Einträge (Brevo-Code, DKIM, DMARC) beim Domain-Anbieter eintragen, „Authenticate“ wählen.
2. Brevo → *Senders*: Absender anlegen, derzeit `no-reply@apppa.at` (Domain `apppa.at`), Name „apppa“.
3. Brevo → *SMTP & API → SMTP*: SMTP-Login ablesen (Form `…@smtp-brevo.com`) und einen SMTP-Schlüssel erzeugen.
4. Im Terminal (Ordner `apppa/apppa`). Mit einem führenden Leerzeichen landet der Befehl nicht im Shell-Verlauf:
   ```bash
    SUPABASE_AUTH_SMTP_SENDER='no-reply@apppa.at' \
    SUPABASE_AUTH_SMTP_USER='<login>@smtp-brevo.com' \
    SUPABASE_AUTH_SMTP_PASS='<SMTP-Schlüssel>' \
    npx supabase config push
   ```
   Die CLI zeigt die Änderungen und fragt nach Bestätigung.
5. Prüfen: Dashboard → *Authentication → Users → Invite user* an eine eigene Test-Adresse. Die Mail muss deutsch sein, vom eigenen Absender kommen und auf `<site_url>/bestaetigen?…` zeigen.

Wer die Zugangsdaten nicht im Terminal eingeben will: Dashboard → *Authentication → Emails → SMTP Settings*. Ein späterer `config push` überschreibt diese Werte aber wieder mit den Variablen.

**Absender-Domain wechseln** (reine Konfiguration, kein Code):

1. Neue Domain in Brevo bestätigen (Schritte 1–2 oben)
2. `config push` wie in Schritt 4 mit der neuen Absender-Adresse
3. Ändert sich auch die **App-Adresse**: `site_url` und `additional_redirect_urls` in `config.toml` anpassen (Produktion: im Produktionsprojekt), die Domain in Vercel eintragen, dann `config push`
4. Testmail wie in Schritt 5. Die alte Domain erst nach ein paar Tagen in Brevo entfernen. Schon verschickte Links bleiben 24 h gültig und zeigen auf die alte App-Adresse.

## 9. 2FA-Notfall-Reset für den Betreiber-Admin

Fall: Der Admin hat sein einziges Authenticator-Gerät verloren und kommt nicht mehr an `/2fa` vorbei.

1. **Identität außerhalb der App prüfen** (persönlich oder telefonisch). Nur der Betreiber selbst führt den Reset durch.
2. Im SQL-Editor des betroffenen Projekts:
   ```sql
   -- alle 2FA-Geräte des Kontos entfernen und alle Sitzungen beenden
   delete from auth.mfa_factors
   where user_id = (select id from auth.users where email = 'joachim@janezic.at');
   delete from auth.sessions
   where user_id = (select id from auth.users where email = 'joachim@janezic.at');
   ```
3. Der Admin meldet sich mit Passwort an und wird zur Pflicht-Einrichtung `/2fa/einrichten` geleitet. Danach sofort ein **zweites Gerät** unter „Mein Konto“ hinzufügen.
4. Den Vorgang mit Datum und Grund festhalten (z. B. im Betriebs-Logbuch).

Bis zur neuen Einrichtung hat das Konto keine Admin-Rechte (die Datenbank verlangt eine mit Code bestätigte Sitzung).

## 10. Anmelde-Sperre (PROJ-3)

Fehlversuche (Passwort, 2FA-Code) speichert `public.login_failures`. Das Konto steht dort nur als Hash der E-Mail-Adresse. Die Tabelle ist nur mit dem Secret Key erreichbar; Einträge älter als 24 h löscht der Zeitplaner (`purge-login-failures`). Regel: 5 Fehlversuche in 15 Minuten → 15 Minuten gesperrt.

Sperre vorzeitig aufheben (z. B. nach einem Anruf): Weil nur der Hash gespeichert ist, alle Einträge der letzten 30 Minuten löschen, das trifft alle Konten:
```sql
delete from public.login_failures where created_at > now() - interval '30 minutes';
```
