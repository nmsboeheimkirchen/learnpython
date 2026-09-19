# Hostinger: Testveröffentlichung und Rückfall

## Update 19.09.2026: Phase 1 bereit, noch keine Live-Umschaltung

Registrierung/Verifikation und Mailwarteschlange sind implementiert. Lokal bestanden: 197 Logik-, 50 Backend-, 133 Missionsbrowser-, 24 Loginbrowser- und 11 Deploymenttests. Nach einem WebKit-CI-Fehler wurde der Übergang Verifikation→Login gegen überlappende Sitzungsanfragen korrigiert (2221728); **GitHub-CI 35455450506 erfolgreich**. Lokales geprüftes Paket: `.cache/hostinger/pilot-20260919-r4` (124 Dateien, Herkunft 2221728). **Live bleibt `pilot-20260917-r2`, Datenbank/persönliches Konto unverändert.** Vor Freigabe fehlen bestätigter Testmail-Empfang und hPanel-Cron. Die älteren Abschnitte darunter sind historischer Stand; nicht als leere Datenbank interpretieren.

Eine genehmigte Testmail (`AGENT PY: Versandtest Phase 1`) von `noreply@agentpy.bildungdigital.at` an `michael@cybershoes.io` wurde vom Transport angenommen. Das beweist noch keinen Empfang. `mail()`/Sendmail unter PHP 8.3.33 sind verfügbar, `crontab` über SSH nicht.

Der stabile CLI-Dispatcher liegt bereits privat unter `agentpy-private/tools/mail-worker.php` (0600). Manueller Probelauf unter r2: `processed=0`; er folgt dem aktiven Release und stoppt beim Rückfall auf r2. Keine öffentliche Cron-URL, keine Kontenänderung. In hPanel nur bei dieser Website unter Erweitert → Cron-Jobs einen **Custom/benutzerdefinierten** Job jede Minute einrichten (fünf Zeitfelder jeweils `*`), andere Jobs nicht ersetzen. [Hostinger-Anleitung](https://www.hostinger.com/support/1583465-how-to-set-up-a-cron-job-at-hostinger/).

```text
/opt/alt/php83/usr/bin/php /home/u535472856/domains/agentpy.bildungdigital.at/agentpy-private/tools/mail-worker.php
```

Keine Passwörter/Umleitung ergänzen. Der explizite PHP-Pfad vermeidet die veraltete Standard-CLI. `node scripts/check-hostinger-mail.mjs worker-status` liest ausschließlich privaten Status (Release, Zeitpunkt, Anzahl). `ranAt` muss ohne manuellen Aufruf weitersteigen, um den Zeitplan nachzuweisen. Bisher manuell: `1789825650`, noch kein bestätigter Cron.

Vor Release: frisches privates SQL-Backup samt Hash (altes Backup vor persönlichem Konto!), neue unveränderliche Release-ID mit Herkunftscommit bauen/hochladen/Manifest prüfen, additives Schema 3 migrieren und serverintern Konten/Lernstände unverändert vergleichen. Echten zeitlich begrenzten `CTEST` für die vorhandene Klasse `Test` anlegen, kein neues persönliches Konto. Standard 32 Plätze inklusive bestehendem Testkonto.

Erst nach Mail-/Cron-Abnahme private `agentpy-private/registration-config.php` (0600) erstellen: `registration_enabled=true`, `mail_transport=sendmail`, `mail_from=noreply@agentpy.bildungdigital.at`, `mail_per_minute=10`, `mail_per_day=100`. Bootstrap übernimmt nur diese Mailwerte; DB-Zugangsdaten bleiben unangetastet. Danach Aktivierung, HTTPS-/Privatpfad-/Login-/Speicher-Smoke, neuer Cron-Heartbeat, schließlich `confirm` oder Webroot-Rollback. r2-API bleibt mit additivem Schema 3 kompatibel.

`MAIL-TRANSPORT-LIMIT`: rollierende projektweite Versandversuche einschließlich Fehler/Abbruch; andere Websites können zusätzlich das Anbieterbudget beanspruchen. SMTP-Adapter noch nicht implementiert. Reservierungen nach 48 Stunden beim nächsten Register-/Worker-Aufruf entfernen, Verifikationslink ab Versandversuch höchstens 24 Stunden und nie länger als Reservierung. Erneutes Anfordern/Passwort-Reset/Kontoverwaltung und Lehrerübersicht folgen separat. Genaue Fortsetzung: [LOGIN-HANDOFF.md](LOGIN-HANDOFF.md).

Stand 17.09.2026: **Testversion `pilot-20260917-r2` auf https://agentpy.bildungdigital.at aktiv.** Schema 2 ergänzt Namen/Pflichtklasse; Mindestpasswortlänge acht Zeichen. Persönliches Testkonto des Nutzers in Klasse `Test` angelegt, Browser-Login/Anzeige/Logout ohne Lernstandsänderung geprüft. Temporäre Testkonten und Testklasse wieder gelöscht. Keine echten Schülerkonten und keine Schülerfreigabe, kein automatisches Hostinger-Deployment. GitHub Pages und andere Hostinger-Websites unverändert. Arbeitsstand noch nicht committet/gepusht.

## Verzeichnisse

Unter `/home/u535472856/domains/agentpy.bildungdigital.at/`:

```text
public_html/                         aktive öffentliche AGENT-PY-Dateien
agentpy-private/                     Modus 0700, außerhalb des Webroots
  config.php                        Modus 0600, nicht ins Repository kopieren
  database-password.txt             Modus 0600, nur direkt auf Hostinger bearbeiten
  sessions/                         private PHP-Sitzungen
  backups/                          alte Webroots und Deployment-Protokolle
  tools/                            Einrichtung / Paketprüfung / Aktivierung
  active-deployment.json            bestätigtes Release und Rückfallziel
  releases/pilot-20260917-r2/         r1 bleibt ebenfalls privat erhalten
    public/                         unverändertes geprüftes Web-Paket
    app/                            private PHP-Anwendung und Schema
    manifest.json                   SHA256 und Größe jeder Paketdatei
```

Der öffentliche API-Einstieg enthält keine Zugangsdaten. Er lädt die Konfiguration aus `agentpy-private` und die zum Release gehörende Anwendung. Keine PHP-Quellen oder SQL-Dateien einfach nach GitHub Pages kopieren. Die einzige öffentliche PHP-Datei im Paket ist `api/index.php`.

## Passwort hinterlegen (bereits erledigt)

Nutzer hat die Eingabe bestätigt, die Verbindung funktioniert. Nicht erneut anfordern oder das Passwort ausgeben. Die folgende Anleitung bleibt nur für eine spätere Passwortänderung erhalten:

1. Hostinger → Dateien → Dateimanager → **Auf alle Dateien von Business Web Hosting zugreifen**.
2. `domains` → `agentpy.bildungdigital.at` → `agentpy-private` öffnen (nicht `public_html`).
3. `database-password.txt` bearbeiten und den gesamten Platzhalter `REPLACE_WITH_DATABASE_PASSWORD` durch das neue **Datenbankpasswort** ersetzen.
4. Nur das Passwort eintragen, keine Anführungszeichen. Speichern, Editor schließen. Nicht hierher kopieren oder als Screenshot schicken.

Das ist nicht das Hostinger-Kontopasswort und nicht ein künftiges Schülerpasswort. Sonderzeichen werden als Text gelesen, nicht als PHP-Code ausgeführt. Ein abschließender Zeilenumbruch wird entfernt; Leerzeichen innerhalb des Passworts bleiben erhalten.

## Paket und Tests

```sh
npm test
npm run test:hosting
npm run test:login
npm run build:hostinger -- .cache/hostinger/RELEASE-ID RELEASE-ID
```

IDs dürfen nur kleine Buchstaben, Ziffern und Bindestriche enthalten. Ausgabeordner müssen leer sein. `AGENTPY_SAVE_MODE=completion-only` wählt bei Bedarf die reduzierte Speicherung; Standard ist `attempts`. Der Builder ändert keine Quellkonfiguration: Pages bleibt Gastbetrieb. Für einen echten Git-Release wird `GITHUB_SHA` als Herkunftsmarker mitgegeben; das derzeitige uncommittete Testpaket behauptet keinen Commit als Herkunft.

- Es gibt eine explizite private Dateiauswahl und einen gefilterten öffentlichen Export; Zugangsdaten, SQL-Backups und Tests werden nicht öffentlich kopiert.
- Lokale JS-/CSS-Verweise erhalten eine Release-Kennung, HTML/JS/CSS werden im Hostinger-Webroot zur erneuten Cache-Prüfung markiert.
- `server/bin/prepare-hostinger.php` ist **nur CLI**, arbeitet ausschließlich neben einem passenden `public_html`, setzt enge Rechte und verweigert existierende private Installationen. Nie erneut ausführen, um ein Passwort zu ändern.
- `server/bin/verify-hostinger-release.php RELEASE-PFAD` prüft jede Dateigröße/Prüfsumme, zusätzliche/fehlende Dateien, Pfad-Traversal und Symlinks. Eine positive Ausgabe aktiviert nichts.
- `tests/hostinger-release.test.mjs`: Trennung, Ausschluss vertraulicher Dateien, Cache-Kennungen, Manifest, ungültige Ziele und Symlinks.
- `tests/hostinger-setup.test.mjs`: zehn bestandene Tests für Passwortschutz, Zielprüfung, Sonderzeichen, Dateirechte (unter Unix), Manipulationen, geschlossene Fehlerzustände, Aktivierung/Bestätigung/Zurückschaltung, parallele Deployment-Sperre, simulierten Rename-Fehler und Prozessabbruch mitten in der Umschaltung. Zusammen mit Paket-/Pages-Tests 14/14 grün.
- Die 16 Login-Browsertests nutzen genau diese Paketstruktur und prüfen zusätzlich die Nichterreichbarkeit privater Dateien. Der lokale PHP-Testserver liefert bei einigen unbekannten Pfaden die Startseite mit HTTP 200; dann muss die Antwort exakt der öffentlichen Startseite entsprechen. Auf Hostinger ergaben die direkten privaten Konfigurations-/Passwort-URLs HTTP 404.
- Der Backend-CI-Job führt auch `npm run test:hosting` aus. Es gibt weiterhin keinen automatischen Hostinger-Publish-Job.

## Datenbank und Live-Abnahme

Neu in r2: `classes`, `schema_migrations` (Version 2), `users.display_name` und nicht nullable `users.class_id` mit Fremdschlüssel. Upgrade nur bei leerem Alt-Kontobestand; vorhandenem v2-Bestand schadet eine Wiederholung nicht. 34 Backend-, 16 Loginbrowser- und 207 Logik-/Deploymenttests bestanden. Live-Healthcheck und Login-Speicher-Smoke auch mit `pilot-20260917-r2` wiederholt; zwei synthetische Konten und ihre Klasse gelöscht. Danach persönliches Testkonto via verdeckter stdin angelegt und Chromium-Login geprüft. Frühere Zählung 0 unten bezieht sich auf r1 vor dieser Kontoanlage.

Vor Migration privater SQL-Dump `backups/before-profile-v2-20260917.sql` (5087 Bytes, SHA256 `0bd33d26f0aed7f658f9d421519385d1aaf3391f29baf7046ad117cb020fa03c`). Dump enthält noch nicht das danach angelegte persönliche Konto. Wiederherstellung weiterhin nicht getestet, nicht mit dem Webroot-Rückfall verwechseln.

- MariaDB 11.8.9, DB und Benutzer `u535472856_agentpy`, Host `localhost`. Initiales Schema erst nach Prüfung auf leere Datenbank angelegt. `users`, `learning_states`, `login_limits`, `write_receipts`: InnoDB und `utf8mb4_unicode_ci`.
- `node scripts/check-hostinger.mjs https://agentpy.bildungdigital.at pilot-20260917-r1`: bestanden. HTTP→HTTPS, Release-ID, HTML-/JS-Revalidierung, private URLs, nicht gecachte API-Antworten, getrennte Sitzungen, Secure/HttpOnly/SameSite/Host-only-Cookie, anonymer Zugriff abgewiesen.
- `node scripts/smoke-hostinger-login.mjs pilot-20260917-r1`: bestanden. Legt ausdrücklich zwei zufällige synthetische Konten an und löscht anschließend nur diese. Prüft echten HTTPS-Login, Abschlusscode, zweites Gerät (unabhängige HTTP-Sitzung), Wiederholung, Versionskonflikt, Kontentrennung, CSRF und Logout. Keine Zugangsdaten in Ausgaben; DB-Passwort bleibt serverseitig. Kein Lasttest, keine Ausführung echter Schülerprogramme.
- `node scripts/check-hostinger-browser.mjs`: bestanden auf Chromium und WebKit/iPad-Profil. Startseite/Assets, Gastfreigabe, Login-Dialog, Fokus, Viewport und Abbrechen; Screenshots unter `.cache/hostinger-browser/` visuell geprüft. Das iPad-Profil ersetzt keinen echten Schulgerätetest.
- Konto-/Lernstand-/Wiederholungsbeleg-Zählung nach Testbereinigung: jeweils 0. Login-Drosselungsdaten und kurzlebige Testsitzungen sind keine Schülerkonten; reguläre Lösch-/Aufbewahrungsregeln noch ergänzen.

## Aktivierung und Rückfall

`server/bin/activate-hostinger.php DOMAINVERZEICHNIS RELEASE-ID activate|confirm|rollback` ist ein privater CLI-Helfer. Er verifiziert das vollständige Manifest, bereitet nur öffentliche Dateien vor, schreibt ein Wiederherstellungsprotokoll und verschiebt den alten Webroot in `agentpy-private/backups`. Zwei aufeinanderfolgende Umbenennungen bedeuten eine kurze Umschaltlücke, keine atomare Gesamtoperation. Während ein Deployment offen ist, wird keine neue Aktivierung zugelassen. Erst nach Live-Prüfungen `confirm` ausführen; sonst `rollback`.

Aktuelles Rückfallziel: `agentpy-private/backups/web-20260917182715-236acdac39` (r1-Testversion). Das frühere Backup `web-20260917075818-73b8645a20` enthält die ursprüngliche Hostinger-Standardseite. Auf dem Server bei einem tatsächlichen Rückfallauftrag:

```sh
/opt/alt/php83/usr/bin/php /home/u535472856/domains/agentpy.bildungdigital.at/agentpy-private/tools/activate-hostinger.php /home/u535472856/domains/agentpy.bildungdigital.at pilot-20260917-r2 rollback
```

Zurückschaltung behält auch die abgelöste Testseite privat auf und ändert **keine Datenbank**. Webroot-Sicherung ist kein Datenbank-Backup. Noch keine Wiederherstellung einer Datenbanksicherung getestet. Release `r1` nicht überschreiben; Änderungen unter einer neuen ID paketieren und prüfen.

## Nächste Schritte vor Schülerbetrieb

1. SSH nur mit dem bereits akzeptierten, lokal gespeicherten Hostkey nutzen. Passwortdatei niemals per `cat`, Download oder Toolausgabe auslesen. Nur serverseitig über die private Konfiguration verwenden.
2. **Explizit `/opt/alt/php83/usr/bin/php` nutzen**. Der einfache Befehl `php` startet auf diesem Konto PHP 7.4.33 und ist ungeeignet.
3. Kontoanlage/Erstanmeldung und Passwortwiederherstellung einschließlich gegebenenfalls benötigtem Mailversand festlegen und implementieren. Bisher nur private CLI-Kontoanlage, keine öffentliche Registrierung.
4. Datenbank-Backup und Wiederherstellung testen; spätere Schemaänderungen nur über versionierte Migrationen und mit Backup. Datenbank-Rollback ist nicht dasselbe wie Zurückschalten von Programmdateien.
5. Klassenlast mit 15/30 synthetischen Konten, zwei echte Schulgeräte, Schulnetz und organisatorische Freigabe prüfen. Datenschutz und Sicherheitswarnungen der benachbarten WordPress-Installationen vor echten Schülerdaten klären.
6. GitHub-Actions-Auslieferung nur nach erfolgreichen Tests und mit passenden Deployment-Secrets einrichten. Noch keine Secrets in GitHub gesetzt und nichts gepusht. Andere Websites dieses Hostingkontos nicht ändern.

Die öffentliche Testversion ist **kein** Unterrichts-Rollout. Ein persönliches Testkonto existiert jetzt in Klasse `Test`; weitere Konten nur ausdrücklich anlegen. Noch keine Selbstregistrierung und kein Passwort-Reset. R1-API ist mit Schema 2 lesend/anmeldend kompatibel, die alte r1-CLI-Kontoanlage nicht mehr verwenden.
