# Runbook: AWS Bedrock für „Ausweis automatisch auslesen“ (PROJ-51)

Die App schickt Ausweisbilder an Claude über **Amazon Bedrock in der Region Stockholm (eu-north-1)**. In dieser Region bleiben die Anfragen („In-region only“). AWS hat das Konto beim Anlegen dieser Region zugewiesen; Irland wäre nur mit „Erweiterten Features“ verfügbar (2026-11-10). Daten gehen nicht an Anthropic. Den Zugang hat nur der Server (Vercel), Kunden sehen ihn nie.

Du brauchst etwa 30–45 Minuten, eine Kreditkarte und dein Handy (Zwei-Faktor-Anmeldung).

> Hinweis: AWS ändert seine Oberfläche öfter. Heißen Knöpfe anders, suche nach dem fett gedruckten Begriff. Schritte mit **(prüfen)** konnte ich vorab nicht mit Sicherheit bestätigen. Sag mir dort Bescheid, was du siehst.

---

## 1. AWS-Konto anlegen

1. Rufe <https://aws.amazon.com> auf und wähle **„AWS-Konto erstellen“**.
2. E-Mail: am besten eine eigene Adresse für dieses Konto, z. B. `aws@rechtundco.at`. Kontoname: `apppa`.
3. Kontaktinformationen: **„Geschäftlich“**, mit Firmenname und Anschrift (wichtig für Rechnung und Auftragsverarbeitung).
4. Gib die Kreditkarte ein, bestätige per SMS und wähle beim Support-Plan **„Basic Support – kostenlos“**.
5. Melde dich danach als **Root-Benutzer** an (<https://console.aws.amazon.com>).

### 1a. Root-Benutzer absichern (Pflicht)
1. Rechts oben auf den Kontonamen → **„Sicherheitsanmeldeinformationen“** (Security credentials).
2. **„MFA zuweisen“** → **„Authenticator-App“** → QR-Code mit der Authenticator-App scannen (dieselbe App wie für die 2FA unserer App).
3. Den Root-Benutzer verwendest du ab jetzt nur noch für Rechnungen und Notfälle.

### 1b. Region einstellen
Rechts oben neben dem Kontonamen die Region auf **„Europa (Stockholm) eu-north-1“** stellen. Alle folgenden Schritte (außer IAM, das gilt weltweit) in dieser Region.

---

## 2. Rechtliches: Auftragsverarbeitung (DSGVO)

1. Suche oben in der Konsole nach **„Artifact“** und öffne **AWS Artifact**.
2. Unter **„Vereinbarungen“** (Agreements) gibt es den **AWS-Datenverarbeitungszusatz (DPA)**. Er ist Teil der AWS-Servicebedingungen und gilt automatisch. Lade ihn als PDF für dein Verarbeitungsverzeichnis herunter.
3. Im Verarbeitungsverzeichnis trägst du ein: Auftragsverarbeiter **Amazon Web Services EMEA SARL (Luxemburg)**, Zweck „Auslesen von Ausweisdaten beim Check-in“, Ort „EU (Schweden, Stockholm)“.

---

## 3. Kostenwarnung einrichten

Ein normales AWS-Konto hat **kein hartes Ausgabenlimit**, nur Warnungen. Im vereinfachten **Projekt-Modus** (Konto „Idea Incubator“, Stand 2026-11-10) wirkt das Budget dagegen als **hartes monatliches Ausgabelimit** (Menü rechts oben: „Monatliches Ausgabelimit 0 $ / 20 $“). Die zweite Grenze ist das Tageslimit je Kunde in der App. Budget einrichten:

1. Suche nach **„Billing and Cost Management“** → **„Budgets“** → **„Budget erstellen“**.
2. Wähle **„Vorlage verwenden“** → **„Monatliches Kostenbudget“**.
3. Name `apppa-bedrock`, Betrag **20 USD** (später anpassen), E-Mail für Warnungen eintragen.
4. Erstellen. Du bekommst eine Mail bei 85 % und bei 100 % sowie bei absehbarer Überschreitung.

---

## 4. Claude-Modelle freischalten

1. Suche nach **„Bedrock“** und öffne **Amazon Bedrock** (Region Stockholm!).
2. Links **„Modellzugriff“** (Model access) bzw. **„Model catalog“**.
3. Suche **Anthropic → Claude Opus 5.5**. Wähle **„Zugriff anfordern“** bzw. **„Modellzugriff ändern“**.
4. Beim ersten Anthropic-Modell kommt ein kurzes Formular zum Anwendungsfall. Vorschlag:
   - Firma und Webseite: deine Angaben
   - Branche: „Software / Hospitality“
   - Anwendungsfall: *„Extraction of identity document fields (name, date of birth, document number, issuing authority) from photos taken at hotel check-in, for the guest registration required by Austrian law (Meldegesetz). Results are always reviewed by staff before saving.“*
   - Interne Mitarbeiter / externe Nutzer: „External users (business customers)“
5. Absenden. Die Freigabe dauert meist Minuten, manchmal länger. Der Status muss **„Zugriff gewährt“** (Access granted) zeigen.
6. **(prüfen)** Steht Claude Opus 5.5 in Stockholm nicht zur Verfügung, schick mir einen Screenshot der Modellliste. Dann weichen wir auf Claude Sonnet 5.5 aus.

> **Stand 2026-11-10 (Konto „Idea Incubator“, vereinfachter Projekt-Modus):** Die Seite „Modellzugriff“ gibt es nicht mehr. Modelle werden beim ersten Aufruf freigeschaltet, das Anthropic-Formular „Submit use case details“ ist einmal je Konto nötig. **Claude Haiku 4.5 funktioniert, Claude Opus 4.8, Opus 5.5 und Sonnet 5 melden „AccessDeniedException … not available for this account“** – auch nach „Erweiterte Features aktivieren“ (Organisation „apppa“ mit Verwaltungskonto, Konto „Idea Incubator“ 672027759451 als Mitglied; das harte 20-$-Limit ist damit weg). Lösung: Support-Fall (Account and billing) mit der Bitte um Freischaltung von Opus 4.8/5.5 in eu-north-1. Haiku 4.5 rät bei fehlenden Angaben (Musterausweis: CAN als Dokumentnummer, Geburtsort als Behörde, Ausstellungsdatum erfunden) und taugt nur für technische Tests.

### 4a. Testen im Playground
1. In Bedrock links **„Playground“** → **„Chat“** → Modell **Claude Opus 5.5** wählen.
2. Lade ein **Musterbild** eines Ausweises hoch (z. B. das offizielle Musterbild „Erika Mustermann“ des deutschen Personalausweises, **keinen echten Ausweis**) und frage: „Lies Name, Geburtsdatum und Dokumentnummer aus.“
3. **Wichtig:** Ohne Systemanweisung lehnt Claude das Auslesen ab (Schutz vor Identitätsdiebstahl). Vorher in den Einstellungen (Schieberegler-Symbol neben dem Modellnamen) unter **„Systemaufforderung“** den Zweck erklären: Hotel-Software in Österreich, Meldepflicht, Gast legt den Ausweis selbst vor, Personal prüft das Ergebnis. Der Besen leert nur den Verlauf, die Systemaufforderung bleibt. Mit Systemanweisung hat Haiku 4.5 den Musterausweis gelesen (2026-11-10).
4. Kommt eine Antwort, funktionieren Zugriff und Region.

---

## 5. Datenaufbewahrung auf „keine“ stellen (prüfen)

Bei neueren Modellen legt AWS je Region fest, ob Anfragen zur Missbrauchserkennung gespeichert werden. Bei „keine“ (`none`) schreibt AWS nichts dauerhaft weg. Laut AWS gibt es dafür beim Start noch **keine Einstellung in der Konsole**, nur einen Befehl.

Diesen Schritt machen wir **gemeinsam**, wenn der Zugang aus Schritt 6 steht: Ich gebe dir einen Befehl für die Terminal-App, der die Einstellung für Stockholm setzt und den Stand zurückmeldet. Lässt Claude Opus 5.5 „keine“ nicht zu, bleibt AWS bei „Standard“: AWS darf dann zur Missbrauchserkennung kurz speichern, Anthropic erhält nichts. Das nehmen wir in den Datenschutz-Satz auf.

---

## 6. Technischen Zugang für die App anlegen

Für die App legst du einen eigenen Benutzer an, der **nur** Claude in Stockholm aufrufen darf.

### 6a. Berechtigung (Richtlinie) anlegen
1. Suche nach **„IAM“** → links **„Richtlinien“** (Policies) → **„Richtlinie erstellen“**.
2. Oben auf **„JSON“** umschalten und den Inhalt vollständig durch Folgendes ersetzen:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ClaudeNurStockholm",
      "Effect": "Allow",
      "Action": [
        "bedrock-mantle:CreateInference",
        "bedrock-mantle:ListModels",
        "bedrock-mantle:GetModel",
        "bedrock-mantle:GetAccountDataRetention",
        "bedrock-mantle:PutAccountDataRetention"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": { "aws:RequestedRegion": "eu-north-1" }
      }
    }
  ]
}
```

3. Weiter, Name **`apppa-ausweis-claude`**, Beschreibung „PROJ-51: nur Claude in eu-north-1“ → **„Richtlinie erstellen“**.
4. **(prüfen)** Meldet der Editor „bedrock-mantle“ als unbekannten Dienst, notiere die Meldung und schick sie mir.

Die beiden Rechte zur Datenaufbewahrung (`…DataRetention`) brauchen wir nur für Schritt 5. Danach entfernen wir sie wieder.

### 6b. Benutzer anlegen
1. IAM → **„Benutzer“** → **„Benutzer erstellen“**.
2. Name **`apppa-ausweis-dev`**. Den **Konsolenzugriff nicht** aktivieren.
3. **„Richtlinien direkt anfügen“** → `apppa-ausweis-claude` anhaken → erstellen.
4. Wiederhole das für **`apppa-ausweis-staging`** und **`apppa-ausweis-prod`**. Getrennte Benutzer je Umgebung lassen sich einzeln sperren, und du siehst getrennt, was Tests kosten.

### 6c. Zugriffsschlüssel erzeugen
Für jeden der drei Benutzer:
1. Benutzer öffnen → Reiter **„Sicherheitsanmeldeinformationen“** → **„Zugriffsschlüssel erstellen“**.
2. Anwendungsfall **„Anwendung, die außerhalb von AWS ausgeführt wird“** → weiter → Beschreibung „Vercel Dev/Staging/Prod“.
3. Kopiere **Zugriffsschlüssel-ID** und **Geheimen Zugriffsschlüssel**. Der geheime Schlüssel wird **nur einmal** angezeigt. Speichere ihn in deinem Passwort-Manager, **nicht** in einer Datei im Projektordner und nicht per Mail.

---

## 7. Schlüssel in Vercel eintragen

Vercel reserviert die üblichen Namen `AWS_ACCESS_KEY_ID` usw. für sich. Darum verwendet die App eigene Namen.

1. Öffne <https://vercel.com> → Projekt → **Settings** → **Environment Variables**.
2. Lege je Umgebung an (Dev-Schlüssel für Development/Preview, Staging-Schlüssel für die Staging-Umgebung, Prod-Schlüssel nur für Production, so wie bei den Supabase-Schlüsseln):

| Name | Wert | Sensitive |
|---|---|---|
| `BEDROCK_ACCESS_KEY_ID` | Zugriffsschlüssel-ID des Benutzers der Umgebung | ja |
| `BEDROCK_SECRET_ACCESS_KEY` | geheimer Zugriffsschlüssel | ja |
| `BEDROCK_REGION` | `eu-north-1` | nein |
| `BEDROCK_MODEL` | `anthropic.claude-opus-5-5` | nein |

3. Für die lokale Entwicklung tragen wir die Dev-Werte gemeinsam in `.env.local` ein. Diese Datei wird nie committet. In `.env.local.example` stehen nur die Namen ohne Werte.

---

## 8. Laufender Betrieb

- **Kosten ansehen:** Billing and Cost Management → **„Cost Explorer“**, Filter „Service = Bedrock“.
- **Schlüssel austauschen** (empfohlen jährlich oder bei Verdacht): beim Benutzer einen zweiten Schlüssel erzeugen, in Vercel ersetzen, neu deployen, dann den alten Schlüssel **deaktivieren** und später löschen.
- **Notbremse:** Bei Missbrauch den Zugriffsschlüssel des betroffenen Benutzers in IAM auf **„Inaktiv“** stellen. Das Auslesen meldet dann „Der Ausweis konnte gerade nicht gelesen werden …“. Alles andere in der App läuft weiter. Einzelne Kunden schaltest du im Betreiber-Admin ab.
- **AWS-Konto wechseln** (z. B. vom persönlichen Konto auf das Konto einer neuen Firma): Code ändert sich nicht. Im neuen Konto die Schritte 1–6 durchführen, dann die vier `BEDROCK_…`-Werte in `.env.local` (lokal) und in Vercel (Dev/Staging/Prod) ersetzen und neu deployen. Danach im alten Konto die Zugriffsschlüssel deaktivieren. Alternative ohne neues Konto: im bestehenden Konto unter **„Konto“** die Kontaktdaten und unter **„Zahlungseinstellungen“** die Zahlungsart auf die Firma ändern. Die Schlüssel bleiben dann gültig.
- **Modell wechseln** (z. B. auf das günstigere Sonnet 5.5): Modell in Bedrock freischalten (Schritt 4), `BEDROCK_MODEL` in Vercel ändern, neu deployen.
