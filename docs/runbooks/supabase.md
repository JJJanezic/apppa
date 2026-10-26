# Runbook: Supabase (PROJ-1, PROJ-3)

## Umgebungen

| | Entwicklung | Staging | Produktion |
|---|---|---|---|
| Supabase-Projekt | „apppa-dev“ `nizgfmvjplhegoosanmu` (Gratis-Tarif) | `iikzjqjjxoznrkkixfqa` (Gratis-Tarif) | `ahclrqbhfpidxjzbpfgb` (Pro-Tarif, eigene Organisation) |
| Git-Branch | `main` | `staging` | `production` |
| App-Adresse | `http://localhost:3000`, Vercel-Vorschauen | `https://staging.apppa.at` | `https://app.apppa.at` |
| Vercel-Projekt | `apppa`, Umgebung Preview | `apppa-staging`, Umgebung Production | `apppa`, Umgebung Production |
| Auth-Werte in `config.toml` | Grundwerte | `[remotes.staging]` | `[remotes.production]` |

Alle in eu-west-1. Die CLI wendet den `[remotes.…]`-Block an, dessen `project_id` zum verlinkten Projekt passt (Ausgabe „Loading config override“). Alle anderen Einstellungen gelten für alle drei Projekte.

**Ausliefern:** erst die Datenbank, dann der Code. Nur weiterschieben, nie direkt auf `staging`/`production` committen.

```bash
npx supabase link --project-ref iikzjqjjxoznrkkixfqa   # Staging
npx supabase db push                                  # bei Änderungen an config.toml auch config push (Abschnitt 8)
git push origin main:staging                          # Vercel-Projekt apppa-staging baut staging.apppa.at; dort prüfen

npx supabase link --project-ref ahclrqbhfpidxjzbpfgb   # Produktion
npx supabase db push
git fetch && git push origin origin/staging:production   # Vercel-Projekt apppa baut app.apppa.at

npx supabase link --project-ref nizgfmvjplhegoosanmu   # immer zurück auf Entwicklung
```

Für Produktion immer `origin/staging` weiterschieben, nicht den lokalen Branch `staging`: Der lokale Branch wird beim Ausliefern nicht mitgeführt und kann veraltet sein. Dann lehnt GitHub den Push als „non-fast-forward“ ab (so geschehen beim Release von PROJ-8). Nie mit `--force` beheben.

Alle Befehle im Hauptordner des Repositorys ausführen. Die Supabase-CLI ist als Dev-Abhängigkeit installiert (`npx supabase …`).

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

Danach `npx supabase db advisors --linked` ausführen: Das Ergebnis muss leer sein. Bekannt und akzeptiert (Stand 2026-10-25), beides Auth-Einstellungen und nicht die Datenbank:
- `auth_otp_long_expiry` in allen Projekten. Mail-Links gelten bewusst 24 Stunden (`otp_expiry = 86400`).
- `auth_leaked_password_protection` in Dev und Staging. Die Prüfung ist bisher nur in Produktion eingeschaltet (Abschnitt 5, Punkt 7). Seit alle Projekte im Pro-Tarif sind, ließe sie sich auch in Dev und Staging einschalten (Dashboard, nicht über `config.toml`).

Jeder andere Hinweis stoppt das Ausliefern.

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

## 5. Staging- und Produktionsprojekt einrichten

Stand 2026-10-24: Beide Projekte sind angelegt, alle Migrationen eingespielt, Advisors ohne Befund. Offen sind die Schritte 4–7.

1. Neues Projekt anlegen: Region **eu-west-1**, Option **„Enable automatic RLS“ ankreuzen**. Die Migration `restrict_rls_auto_enable` setzt die Funktion `public.rls_auto_enable()` voraus und bricht ohne sie ab. Vergessen: Funktion und Event-Trigger `ensure_rls` im SQL-Editor nachbauen. Die Vorlage ist die Definition in „apppa-dev“ (`select pg_get_functiondef('public.rls_auto_enable()'::regprocedure)`). Beim Kopieren aus dem Terminal gehen `$$` verloren, deshalb über eine Datei und `pbcopy` kopieren.
2. Neues Projekt mit Ref und Adressen als `[remotes.<name>]` in `supabase/config.toml` eintragen, die Ref zusätzlich in `src/lib/supabase/projects.ts` (Testsperre, Authenticator-Name) und in der Tabelle oben
3. `npx supabase link --project-ref <ref>` → `db push` → `db advisors --linked`
4. `config push` mit den SMTP-Variablen (Abschnitt 8). Ohne ihn bleiben die Mails englisch und die Links zeigen auf localhost
5. Ersten Admin wie in Abschnitt 4 einrichten
6. In Vercel die Variablen aus `.env.local.example` mit den Werten des Projekts setzen: Produktion im Vercel-Projekt `apppa` unter *Production*, Staging im eigenen Vercel-Projekt `apppa-staging` unter *Production* (Produktions-Branch `staging`). Dev-Werte in `apppa` unter *Preview*. Grund: Der Gratis-Tarif erlaubt keine Variablen je Branch. In `apppa-staging` unter *Settings → Build and Deployment → Ignored Build Step* „Only build production“ wählen. Sonst baut das Projekt bei jedem Push auch Previews ohne Variablen, und die scheitern
7. **Nur Produktion:** *Authentication → Sign In / Providers → Email*: „Prevent use of leaked passwords“ einschalten. `config.toml` kennt diese Einstellung nicht, deshalb nach jedem `config push` in Produktion prüfen, ob sie noch an ist. *Database → Settings*: „Enforce SSL“ einschalten. *Authentication → Sessions*: „Time-box user sessions“ 30 Tage und „Inactivity timeout“ 8 Stunden (Pro-Tarif; zusätzlich zur Prüfung in der App). Backups siehe Abschnitt 6
8. Danach wieder mit der Entwicklung verbinden: `npx supabase link --project-ref nizgfmvjplhegoosanmu`

**`npm test` nie gegen Staging oder Produktion laufen lassen.** Die Integrationstests legen Nutzer und Mandanten an und löschen sie wieder (Abschnitt 7).

## 6. Backups und Test-Wiederherstellung (Produktion)

- Pro-Tarif: tägliche Backups, 7 Tage Aufbewahrung (*Database → Backups*)
- **Vor dem Pilotstart:** einen Tag nach dem Anlegen prüfen, dass ein Backup existiert. Dann ein Backup in ein neues, temporäres Projekt wiederherstellen (*Restore to new project*). Anzahl der Zeilen in `tenants`, `profiles`, `memberships` und `audit_log` vergleichen und das temporäre Projekt danach löschen.

## 7. Automatische Tests

`npm test` führt die Integrationstests (`supabase/tests/*.integration.test.ts`: RLS, Auth-Konfiguration, Anmelde-Sperre, Mail-Links) gegen „apppa-dev“ aus, wenn `.env.local` alle drei Variablen enthält. Sonst werden sie übersprungen.
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
4. Im Terminal (Hauptordner des Repositorys). Mit einem führenden Leerzeichen landet der Befehl nicht im Shell-Verlauf:
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

## 11. Einladungen ins Team (PROJ-4)

- **Neue Personen** bekommen die Supabase-Einladungsmail (Vorlage `supabase/templates/invite.html`, nennt Kunde und einladende Person). Nach einer Änderung an der Vorlage `config push` wie in Abschnitt 8.
- **Bestehende Konten** bekommen eine Hinweis-Mail direkt über die Brevo-Schnittstelle und nehmen die Einladung auf dem Dashboard an. Dafür in `.env.local` (und später in Vercel) eintragen:
  ```
  BREVO_API_KEY=<API-Schlüssel aus Brevo → SMTP & API → API Keys>
  # optional, Standard no-reply@apppa.at:
  BREVO_SENDER_EMAIL=no-reply@apppa.at
  ```
  Ohne Schlüssel wird keine Hinweis-Mail verschickt; die Einladung erscheint trotzdem beim nächsten Anmelden.
- Höchstens 20 Einladungen pro Kunde und Stunde. Abgeschlossene Einladungen löscht der Zeitplaner nach 90 Tagen (`purge-closed-invitations`).
- Mitgliedschaften entstehen nur durch Annehmen einer Einladung (bzw. serverseitig, PROJ-5). Einen Kunden für Tests direkt anlegen: im SQL-Editor `insert into public.tenants (name) …` und `insert into public.memberships (tenant_id, user_id, role) …` (nur Entwicklung).

## 12. Betreiber-Bereich (PROJ-5)

- **Zugang:** Menüpunkt „Betreiber“ bzw. `/betreiber`, nur für Konten mit `is_operator_admin` (Abschnitt 4) und nach der 2FA. Alle Aktionen laufen über Admin-Funktionen der Datenbank (`admin_*`); jede schreibt einen Eintrag ins Betreiber-Protokoll (`operator_log`, nur für den Admin lesbar, Bereinigung nach 2 Jahren über `purge-operator-log`).
- **Kunde löschen:** nur deaktivierte Kunden, mit exakt eingetipptem Namen. Gelöscht werden der Kunde mit allen Daten und sein Änderungsprotokoll; im Betreiber-Protokoll bleiben die Einträge ohne E-Mail-Adressen, dazu der Löschnachweis.
- **Meldung „Login-Konten konnten nicht gelöscht werden“:** Die Konten haben keinen Kunden mehr und sehen nichts. Nachlöschen im Dashboard unter Authentication → Users (Konto suchen → „Delete user“) oder im SQL-Editor die Kandidaten finden:
  ```sql
  select p.id, p.email from public.profiles p
  where not p.is_operator_admin
    and not exists (select 1 from public.memberships m where m.user_id = p.id)
    and not exists (select 1 from public.invitations i where i.email = lower(p.email) and i.status = 'open');
  ```
  Vorsicht: Die Liste enthält auch Konten, die nie zu einem Kunden gehörten (z. B. Testkonten). Vor dem Löschen prüfen.
- **E-Mail-Adresse eines Kontos ändern** (offene Frage in PROJ-5, vorerst hier): Dashboard → Authentication → Users → Konto → „Change email“ bzw. per `auth.admin.updateUserById`. Das Profil (`profiles.email`) zieht automatisch nach. Die Person meldet sich danach mit der neuen Adresse an; offene Einladungen an die alte Adresse vorher zurückziehen und neu senden.
- **Konto eines letzten Inhabers löschen** (PROJ-1 BUG-6): erst im Betreiber-Bereich einen anderen Inhaber einsetzen, oder den Kunden deaktivieren und löschen.

## 13. Gemeindeliste aktualisieren (PROJ-6)

Die Gemeinden (Auswahl bei Objekten, später Grundlage der Tourismusabgabe) stammen aus der Gemeindeliste von Statistik Austria (CC BY 4.0, Quellenangabe steht in der App). Einmal jährlich bzw. nach Gemeindereformen:

1. Aktuelle Datei laden und ablegen:
   ```
   curl -o supabase/data/statistik-austria/gemliste_knz_<JAHR>.csv https://www.statistik.at/verzeichnis/reglisten/gemliste_knz.csv
   ```
   Kopfzeile prüfen: „Gemeindeliste sortiert nach Gemeindekennziffer, Gebietsstand <JAHR>“. README im selben Ordner anpassen.
2. Migration erzeugen (bricht bei unerwarteten Zeilen ab):
   ```
   npx tsx scripts/build-municipalities.mts supabase/data/statistik-austria/gemliste_knz_<JAHR>.csv supabase/migrations/<ZEITSTEMPEL>_municipalities_<JAHR>.sql
   ```
3. `npx supabase db push`. Neue und umbenannte Gemeinden werden übernommen, die PLZ-Zuordnung wird ersetzt. Nicht mehr enthaltene Gemeinden erhalten „gültig bis“ und sind für neue Objekte nicht mehr wählbar.
4. **Gemeindezusammenlegung:** Objekte, die noch auf eine aufgelöste Gemeinde zeigen, finden:
   ```sql
   select p.id, p.name, p.tenant_id, m.name from public.properties p
   join public.municipalities m on m.code = p.municipality_code where m.valid_until is not null;
   ```
   Nachfolger in einer eigenen Migration setzen (`update public.municipalities set successor_code = '…' where code = '…'`) und die betroffenen Objekte auf die Nachfolgegemeinde umhängen (`update public.properties set municipality_code = '…' where municipality_code = '…'`). Das Änderungsprotokoll hält die Umstellung fest; ab PROJ-16 vorher prüfen, ob für den laufenden Monat schon Abgaben gemeldet sind.

## 14. Ausweisbilder (PROJ-29)
- **Speicherbereich** `guest-documents` (privat, nur JPEG, höchstens 2 MB) legt die Migration `20261026181450_guest_titles_gender_documents.sql` an. Ablage: `<Kunden-ID>/<Zufalls-ID>.jpg`; die Zuordnung zum Gast steht nur in der Tabelle `guests` (`document_front_path`, `document_back_path`).
- **Zugriff:** Hochladen nur Mitglieder in den eigenen Ordner; Lesen nur, wenn das Bild an einem Gast des Kunden hängt (oder der eigene frische Upload ist), Betreiber-Admin mit 2FA lesend. Löschen und Überschreiben nur mit dem geheimen Schlüssel.
- **Löschen:** Die Server-Aktionen löschen ersetzte, entfernte und nicht gewählte Bilder sofort, beim Löschen eines Kunden den ganzen Ordner.
- **Tägliche Bereinigung:** Vercel Cron ruft täglich um 03:00 UTC `/api/cron/ausweisbilder` auf (`vercel.json`) und löscht Dateien, die älter als 24 Stunden sind und an keinem Gast hängen (`public.unused_guest_documents`, nur `service_role`).
- **Umgebungsvariable `CRON_SECRET`:** zufälliger Wert (z. B. `openssl rand -hex 32`), in jedem Vercel-Projekt und jeder Umgebung eintragen (`apppa` Production + Preview, `apppa-staging` Production). Vercel schickt ihn als `Authorization: Bearer …`. Ohne Wert lehnt die Route jeden Aufruf ab (401); lokal ist er nur zum Testen der Route nötig.
- **Manuell bereinigen:** `curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/ausweisbilder` → `{ "removed": n, "failed": false }`.
