# Login-/Speicher-Pilot: Integration und Hostinger-Testversion

> **Historische Integrationsnotizen.** Der aktuelle, übergreifende Regelvertrag für Datenhaltung, Login, Schüler-/Lehrerverwaltung, Superadmin, Sonderfälle, Rechte und Testzuordnung steht in [ACCOUNT-SYSTEM.md](../ACCOUNT-SYSTEM.md). Die folgenden datierten Rolloutabschnitte enthalten frühere Einschränkungen und sind nicht die aktuelle Funktionsbeschreibung. Für den tatsächlich veröffentlichten Stand gilt der jüngste [LOGIN-HANDOFF.md](../LOGIN-HANDOFF.md)-Eintrag.

## Erweiterung 21.09.2026 – Passwort-Wiederherstellung

Maßgeblicher Live-/Teststand: [LOGIN-HANDOFF.md](../LOGIN-HANDOFF.md). Die älteren Rolloutangaben unten sind historisch.

- Additives Schema4: `auth_epochs`, `password_resets`, `recovery_mail_jobs`. Migration erhält vorhandene Profile, Passwort-Hashes und Lernstände. Alte Sitzungen verwenden Epoch0; nach Reset ist auch deren weiterer Zugriff gesperrt. Kein Datenbank-Downgrade bei Web-Rollback.
- Privates Konfigurationsfeld `password_reset_enabled` (Standard false; ebenfalls `AGENTPY_PASSWORD_RESET_ENABLED`). Registrierung und Recovery unabhängig abschaltbar. `session.recovery.enabled` steuert die Oberfläche strikt boolesch.
- `POST request-password-reset {email}` mit Origin/CSRF: gleiche 202-Antwort für bekannte, unbekannte, inaktive und pro Adresse begrenzte Konten. Drei Anforderungen je Adresse/15-Minuten-Fenster, großzügige Schul-IP-Bremse. Wiederholung versendet nicht erneut und entwertet keinen bestehenden Link.
- `POST reset-password {token,password,confirmation}`: mindestens acht Unicode-Zeichen/maximal72 UTF-8-Bytes; Bestätigung muss übereinstimmen. Kryptografisch zufälliger 256-Bit-Token als URL-Fragment, serverseitig SHA256, einmalige transaktionale Verwendung. Link eine Stunde ab erstem Versandversuch gültig, Queue maximal24 Stunden. Passwortänderung plus Epocherhöhung atomar, kein Auto-Login; Klasse und Lernstand unverändert. Anschließend getrennte Benachrichtigungsmail ohne Passwort/Token.
- Alle Kontomails teilen Sperre, rollierendes Minuten-/Tagesbudget und Wiederholung mit Lease/Backoff. Transportannahme ist kein Zustellnachweis. `MAIL-TRANSPORT-LIMIT`: bei neuem Transport Policy, Queue und UI gemeinsam prüfen; keine Missbrauchsbremsen pauschal entfernen.
- Tests: `tests/recovery-cases.mjs` im SQLite-/MariaDB-Backendlauf, `tests/login-e2e/recovery.spec.mjs` für echte Shell in Chromium/WebKit. Nur isolierte Wegwerfkonten; niemals persönliche Passwörter für Tests zurücksetzen.
- **Rollback-Sicherheit:** Sobald echte Passwortresets erfolgt sind, nicht blind auf r6/älteren Auth-Code zurückrollen: dieser prüft keine Session-Epochen. Stattdessen Registrierung/Recovery per privaten Flags deaktivieren und den Epochen prüfenden Auth-Code beibehalten, oder alle projektbezogenen Sitzungen gezielt invalidieren. Datenbank nicht zurücksetzen.
- SMTP-Adapter: fest gepinnter PHPMailer7.1.1-Subset (Upstream/Lizenz unter `server/vendor/phpmailer/README.agentpy.md`), TLS465/ssl oder587/tls mit Zertifikatsprüfung, Authentifizierung und gleichem Envelope-/From-/Login-Absender. `smtp_password_file` nur neben privater Konfiguration, kein Passwort in Git/HTTP/Debugausgabe. Hostinger: `smtp.hostinger.com`,465,ssl. Konservative gemeinsame Quote10/Minute und100/24h vorerst behalten; tatsächlichen Postfachplan prüfen, bevor Grenzen erhöht werden.

## Phase 1 – Stand 19.09.2026

Registrierung und persistente Mailqueue sind implementiert und getestet, **noch nicht live aktiviert**. Live bleibt r2 bis tatsächlicher Mail-Empfang und hPanel-Cron bestätigt sind; ältere Angaben unten beschreiben r2. Aktuelle Betriebsschritte: [HOSTINGER-DEPLOY.md](../HOSTINGER-DEPLOY.md).

- Additives Schema 3: Klassenkapazität/Einladungen, reservierte Anmeldungen, Mailjobs und Budget. `manage.php migrate` erhält Konten/Lernstände, keine Migration per HTTP.
- Gast-POST mit Origin+CSRF: `check-invitation {code}` → Klassenname/10-Minuten-Grant; `register {name,email,password}` → 202/Vormerkung; `verify-email {token}` → einmalige Aktivierung ohne Auto-Login; `cancel-registration {}` löscht Grant, nicht Sperrzähler. `session` liefert öffentliche Registrierungspolicy; Fehler ggf. `attemptsLeft`/`retryAfter`.
- Fünf falsche Codes → 300 Sekunden Sperre pro serverseitiger Sitzung, zusätzliche großzügige IP-/Gesamtbremse für Schul-NAT. Code ist kein Nachweis der Schulzugehörigkeit. 32 Plätze inklusive 48-Stunden-Reservierungen, letzte Stelle transaktional; E-Mail eindeutig, vorhandene Konten unverändert.
- Private CLI: `create-invitation {classId,code,expiresAt}` (fünf Großbuchstaben, Unix-Sekunden), `revoke-invitation {code}`, `mail-work`. Eingaben auf stdin. `CTEST` ist ein echter Einladungseintrag, kein Bypass.
- Konfiguration: `registration_enabled=false`, `mail_transport=disabled|sendmail`, `mail_from`, `mail_per_minute=10`, `mail_per_day=100`. Privater `registration-config.php` neben `config.php` kann nur diese Felder überschreiben. `test`-Transport nur in lokaler Entwicklung.
- `server/bin/mail-worker.php` als stabiler privater Cron-Dispatcher folgt aktivem Release; beim Rückfall auf r2 kein Versand. Dauerhafte Jobs, gesperrtes Budget, Lease und Backoff schützen gegen Neustarts/Parallelität. At-least-once-Mailversand, einmalige Tokenaktivierung; Transportannahme beweist keine Zustellung. Link als URL-Fragment, Bestätigung nur per explizitem POST.
- Tests `registration-cases.mjs` auf SQLite/MariaDB, `login-e2e/registration.spec.mjs` auf Chromium/WebKit; `test:hosting` prüft auch Cron-Dispatcher. Bestehende GitHub-Pipeline führt sie aus.

Phase 2/später: Passwort-Reset/erneutes Anfordern, `Mein Konto`, Namens-/E-Mail-Änderung, Löschung, Lehreransicht und Fortschrittsprozente. SMTP separat implementieren; Marker `MAIL-TRANSPORT-LIMIT` verbindet Transport, Queue, Limits, UI und Tests.

Branch `dev-login-save`, noch uncommittet. Öffentliche Hostinger-Testversion `pilot-20260917-r2` mit Schema 2 und Pflichtklasse seit 17.09.2026 aktiv und geprüft, **noch nicht für Schülerbetrieb freigegeben**. Die Lernseiten unterstützen Remote-Adapter, Login/Logout und Speicherstatus. `assets/data/account-config.js` lässt das Kontosystem im normalen statischen Release deaktiviert; nur das Hostinger-Paket aktiviert es. Synthetische Live-Testkonten anschließend gelöscht; persönliches Testkonto des Nutzers separat angelegt und geprüft. Betrieb und Rückfall: [HOSTINGER-DEPLOY.md](../HOSTINGER-DEPLOY.md).

## Bereits umgesetzt

- PHP-API mit E-Mail/Passwort-Anmeldung und Abmeldung; Pilotkonten werden über ein CLI angelegt, keine öffentliche Registrierung. Jedes Konto hat einen Namen und genau eine bestehende Klasse (NOT NULL/Fremdschlüssel); die Klassenzuordnung gewährt keinerlei Zugriff auf andere Konten.
- bcrypt-Hashes, neue Sitzungs-ID bei Anmeldung/Abmeldung, CSRF- und Origin-Prüfung; Zugriff auf Lerndaten ausschließlich über die serverseitige Identität.
- Produktionscookie: `__Host-agentpy_session`, Secure, HttpOnly, SameSite=Lax, ohne Domain-Attribut. HTTP ist ausschließlich für ausdrücklich konfigurierte lokale Entwicklung erlaubt. Sitzungen laufen nach zwei Stunden Inaktivität beziehungsweise spätestens zwölf Stunden ab.
- Begrenzung auf zehn Anmeldeversuche je E-Mail-Adresse und 150 je IP pro 15-Minuten-Zeitfenster. Der gemeinsame Internetzugang einer Schulklasse ist berücksichtigt.
- Pro Profil eine versionierte Momentaufnahme mit letztem Versuch, erfolgreichem Code und Freischaltungen; letzte Versuche überschreiben erfolgreiche Fassungen nicht.
- Abschlusscode und Freischaltungen werden in derselben Transaktion gespeichert. Freischaltungen werden aus der serverseitigen Kursliste abgeleitet, nicht aus frei eingesandten IDs.
- Versionskonflikte liefern HTTP 409. Eine identische `operationId` und Anfrage kann sicher wiederholt werden, etwa wenn nach dem Datenbank-Commit die Antwort verloren ging. Eine Wiederholung liefert den aktuellen Stand, ohne eine alte Fassung zurückzuschreiben.
- Schema und Tests für MariaDB/MySQL mit InnoDB; SQLite ausschließlich zur lokalen Entwicklung. Reale Parallelitätsprüfung über zwei PHP-Serverprozesse auf derselben Datenbank.
- Hilfestände im Pixelmuseum-Briefing und ausdrückliche Überspring-Freischaltungen; beide bleiben von erfolgreich abgeschlossenem Code getrennt.
- Profilgebundener Remote-Adapter mit serialisierten Writes, idempotenter Wiederholung, sichtbarem Konfliktstatus und Abbruch verspäteter Antworten nach Sitzungsende. Ein Fehler führt nie zum Gastadapter.
- Asynchroner Bootstrap aller 30 Runner-Seiten; Login auch auf der Startseite. Kontowechsel sperrt andere offene Tabs per BroadcastChannel; zusätzlich werden Fokus, Sichtbarkeit und Rückkehr aus dem Seiten-Cache geprüft.
- Modus `saveMode: "completion-only"`: Versuche bleiben ausschließlich im Arbeitsspeicher dieses Tabs; Code und Freischaltungen werden erst bei Erfolg zentral gespeichert. Standard `"attempts"` speichert beim Ausführen, nicht beim Tippen.
- Warnung vor Verlassen bei unbestätigten Writes; Schaltfläche „Code sichern“ exportiert den aktuellen Editorinhalt als Textdatei. Kein vollständiger Fortschrittsimport/-export und keine Gastmigration.

Die fachliche Prüfung, ob Python die Aufgabe löst, bleibt wie bisher im Browser. Die API ist keine unabhängige Prüfungs- oder Benotungsinstanz und führt keinen Schülercode auf dem Server aus.

## Noch erforderlich

- Erstanmeldung und Passwort-Wiederherstellung mit überprüftem Mailversand; CLI-Anlage ersetzt diese Unterrichtsabläufe nicht.
- Erweiterte Abnahme für Sitzungsablauf im laufenden Editor, Browser-Zurück/Seiten-Cache und ungespeicherten Text bei Geräteabbruch. Die aktuelle Warteschlange ist nur im Arbeitsspeicher, keine dauerhafte Offline-Outbox. Bestätigte Serverstände sind davon unabhängig.
- Automatische Hostinger-Auslieferung mit Deployment-Secrets, Datenbank-Backup-/Löschkonzept einschließlich Aufbewahrung der Wiederholungsbelege, Lasttest und reale Schulgeräteprüfung.
- Die grundlegende Hostinger-HTTPS-/Cookie-/Cache-Prüfung ist bestanden; die lokale Login-Suite nutzt dasselbe Paketlayout. Erweiterten Betriebs-/Ausfalltest und Datenbank-Restore ergänzen. Die vorhandene Webroot-Zurückschaltung ist kein Datenbank-Restore.

## Tests

Node.js 22 oder neuer und PHP mit PDO SQLite werden benötigt:

```sh
npm test
npm run test:backend
npm run test:login
```

`PHP_BINARY` kann einen PHP-Pfad vorgeben. Unter Windows erkennt der Test außerdem die im ignorierten Cache eingerichtete portable Laufzeit `.cache/php-runtime/php-8.5.10/php.exe`. Es wird keine systemweite Installation verändert.

Wenn `AGENTPY_TEST_MYSQL_DSN`, `AGENTPY_TEST_MYSQL_USER` und `AGENTPY_TEST_MYSQL_PASSWORD` gesetzt sind, läuft derselbe Test zusätzlich gegen MariaDB/MySQL. Der Datenbankname muss auf `_test` enden. **Nur eine eigene Wegwerf-Testdatenbank verwenden:** Die Tests erzeugen Konten und einen Fehler-Trigger und bereinigen ihre Konten sowie die Login-Limit-Tabelle. Die CI richtet dafür einen eigenen MariaDB-Container ein.

Geprüft werden Gerätewechsel, fremde Profile, Cookie-Erneuerung, CSRF/Origin, falsche Passwörter, abgelaufene Sitzung, 15 Anmeldungen über dieselbe IP, tatsächliche parallele Schreibkonflikte, gleichzeitige Wiederholungen, Rollback nach einem künstlichen Fehler innerhalb der Transaktion, Hilfestände, Größenlimits und beschädigte gespeicherte Daten. `test:login` prüft zusätzlich Chromium/WebKit mit echter PHP-API, isolierter SQLite-Datenbank und synthetischen Konten; es baut die öffentliche Dateiauswahl tatsächlich zusammen. Kein Klassenlasttest über eine ganze Unterrichtsstunde.

Die Login-Tests benötigen installierte Playwright-Browser (`npx playwright install chromium webkit`). Ihr Server hört nur auf 127.0.0.1:4174; Testdaten liegen unter `.cache/login-browser-*`, Testbilder unter `.cache/login-results`. Keine dieser Dateien veröffentlichen. GitHub führt Login-Tests zusätzlich vor Pages-Veröffentlichungen aus.

## Konfiguration und Datenbank

`config.example.php` zeigt die erforderlichen Werte. Echte Konfiguration außerhalb von `public/` und außerhalb des Repositorys ablegen und `AGENTPY_CONFIG` auf deren absoluten Pfad setzen. Alternativ Umgebungsvariablen verwenden:

| Variable | Bedeutung |
| --- | --- |
| `AGENTPY_ENVIRONMENT` | `production` (Standard); `development` nur lokal |
| `AGENTPY_ORIGIN` | Exakt `https://agentpy.bildungdigital.at`, ohne abschließenden Slash |
| `AGENTPY_DSN` | `mysql:host=…;dbname=…;charset=utf8mb4` |
| `AGENTPY_DB_USER` / `AGENTPY_DB_PASSWORD` | Separater Datenbankbenutzer und Passwort |
| `AGENTPY_SESSION_PATH` | Optionaler privater Sitzungsordner; andernfalls PHP-Vorgabe |

Schema per `php server/bin/manage.php migrate` anlegen. Erforderlich: PHP 8.2+, PDO MySQL, InnoDB, UTF-8 (`utf8mb4`) und HTTPS. Migration 2 ergänzt `classes`, `users.display_name`, `users.class_id` sowie `schema_migrations`. Eine alte Datenbank mit vorhandenen Konten wird vor Änderungen abgewiesen: Namen/Klassen dürfen nicht geraten werden. Die leere Pilotdatenbank kann aktualisiert werden; wiederholtes Ausführen auf Schema 2 erhält bestehende Konten. Vor Änderungen sichern; MySQL-DDL ist nicht als Ganzes transaktional.

`php server/bin/manage.php create-class` nimmt `{name}` über Standardeingabe an und liefert die Klassen-ID. Für den Pilot sind Klassennamen innerhalb dieser Installation eindeutig; Schul-/Jahreszuordnung und Lehrerrollen folgen später.

`php server/bin/manage.php create-user` nimmt `{email, password, name, classId}` über Standardeingabe an. Mindestlänge **8 Unicode-Zeichen**, höchstens 72 UTF-8-Bytes wegen bcrypt; keine Nullzeichen. Name und Klassenname: 1–100 Zeichen ohne Steuerzeichen. Namen werden als Text angezeigt, nicht als HTML. Fehlende/unbekannte Klassen werden abgewiesen. Konto und leerer Lernstand entstehen gemeinsam in einer Transaktion; doppelte E-Mail überschreibt kein Konto. Ausgabe: ID, E-Mail, Name, Klassen-ID und Klassenname, niemals Passwort oder Hash.

Keine Passwörter in Kommandozeilenargumenten oder eingecheckten Dateien ablegen. `scripts/provision-hostinger-account.mjs RELEASE-ID` nimmt die Zugangsdaten als JSON auf Standardeingabe entgegen (bei interaktivem Terminal ohne Echo), verwendet ausschließlich die festgelegte Hostinger-Installation, erzeugt/referenziert die Klasse und prüft anschließend den Browser-Login ohne Änderung des Lernstands. Fehlerdetails werden wegen möglicher Zugangsdaten nicht ausgegeben; bei unklarer Anlage vor Wiederholung den Kontostand prüfen. Der Betriebsablauf für Schülerkonten und Passwortwechsel bleibt offen.

Der Builder erzeugt ausschließlich öffentliche Dateien unter `public/`; Hostinger erhält diese als `public_html`. Private PHP-Anwendung und Schema liegen unter `agentpy-private/releases/RELEASE-ID/app`, Konfiguration und Sitzungen ebenfalls außerhalb des Webroots. Die vorbereitete GitHub-Pages-Pipeline veröffentlicht nur ausgewählte statische Dateien; PHP und Testdateien werden ausgeschlossen.

## API-Vertrag v1

Endpunkt: `/api/index.php?action=…`. Alle Antworten sind JSON mit `Cache-Control: no-store`. Fehler enthalten ausschließlich `error.code`, keine SQL- oder Konfigurationsdetails.

| Methode / Aktion | Ergebnis |
| --- | --- |
| `GET session` | `profile` oder `null`, dazu `csrfToken` |
| `POST login` | Anfrage `{email, password}`; neue Sitzung, Profil und neuer CSRF-Token |
| `POST logout` | Anfrage `{}`; Sitzung erneuert und abgemeldet |
| `GET state` | `{profile, state: {revision, data}}` |
| `POST write` | `{profile, state, replayed}` nach bestätigter Transaktion |

POST benötigt `Content-Type: application/json`, die konfigurierte `Origin` und `X-CSRF-Token`. Angemeldete Datenzugriffe und Logout benötigen außerdem `X-Agentpy-Profile` mit der ID des geladenen Profils. Dieser Header schützt vor alten Tabs nach einem Kontowechsel; er ersetzt keine Anmeldung und wählt keine fremden Datensätze aus.

Eine Schreibanfrage lautet beispielsweise:

```json
{
  "operationId": "e8576280-137e-4a1f-8bf4-60466146c25c",
  "expectedRevision": 0,
  "command": {
    "type": "complete",
    "levelId": "mission1_level1",
    "code": "print(\"Hallo\")"
  }
}
```

Bei Wiederholung dieselbe Kennung und denselben Inhalt verwenden. Bei einem Konflikt den neuen Stand laden und die gewünschte Änderung ausdrücklich abgleichen. Ein Fehler darf nie als erfolgreicher Speicherstatus erscheinen. Maximal 32 KiB Code pro Levelfassung, 64 KiB pro Anfrage und 2 MiB pro Gesamtstand.

Weitere Schreibkommandos: `attempt` mit `levelId/code`, `reset` ohne Zusatzfelder, `unlocks` mit einer Liste bekannter `unlockIds`, `feature` mit `featureId: "pixelmuseum"` und `value: {version: 1, count, levels}`. Hilfestufen müssen bekannte Themen und Werte 1–3 verwenden; `count` muss ihrer Summe entsprechen. Überspringen vergibt keine Abschluss-Codefassung.

## GitHub

Der vorbereitete Workflow läuft auf `main`, `dev-login-save` und Pull Requests. Logik-, Browser- und Backendtests sind Veröffentlichungsvoraussetzungen. Nur `main` darf weiterhin nach GitHub Pages veröffentlichen; der Entwicklungsbranch veröffentlicht nicht automatisch. Die erste Hostinger-Testversion wurde kontrolliert per SSH aktiviert, eine GitHub-Actions-Verbindung zu Hostinger ist noch nicht eingerichtet.
