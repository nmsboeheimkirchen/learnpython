# Übergabe: dev-login-save

## Update 18.09.2026: Sicherung und Planung

Nutzer hat Login, Speichern und Logout selbst erfolgreich getestet und Commit/Push auf `dev-login-save` beauftragt. Der r2-Implementierungsstand und diese Dokumentation werden damit in Git gesichert; ältere Angaben „uncommittet/ungepusht“ weiter unten beschreiben den Stand vor diesem Auftrag. Hostinger wird dadurch nicht neu veröffentlicht, GitHub Pages bleibt unangetastet. Neue Wünsche zu Kopfzeile, Passwortsichtbarkeit, Klassencode/Registrierung, Kontobereich und Lehreransicht **nicht implementieren**, bevor die Planung besprochen ist: [LOGIN-NEXT-STEPS.md](LOGIN-NEXT-STEPS.md). `CTEST` ist nur vorgesehen, noch kein gültiger Einladungscode. Keine Änderung an Schülerdaten oder persönlichen Konten für diesen Auftrag.

Stand: 17.09.2026, **Hostinger-Testversion `pilot-20260917-r2` öffentlich aktiv**, Schema 2 mit Namen und Pflichtklasse. Das vom Nutzer beauftragte persönliche Testkonto ist in Klasse `Test` angelegt, echter Chromium-Login/Profilanzeige/Logout bestanden; Lernstand unverändert leer. Passwort nie in Dateien/Ausgaben speichern. Keine Schülerfreigabe. Zuerst diese Datei, `HOSTINGER-DEPLOY.md`, `LOGIN-PILOT.md`, `server/README.md` und Änderungen lesen; nicht erneut von vorne planen. Keine ungefilterte Ausgabe ungetrackter Dateinamen (siehe Zugangsdaten-Warnung unten).

## Neueste Fortsetzung: Konto und Klasse (r2)

- Nutzer fordert acht statt zwölf Zeichen, Name und genau eine Klasse für jedes Konto. Umgesetzt in `server/src/account-management.php`, `schema.sql`, `manage.php` und eigenem API-Profil; Status zeigt Namen/Klasse als Text. Keine Lehrerrolle oder fremden Kontozugriffe.
- CLI `create-class`: `{name}`. CLI `create-user`: `{email,password,name,classId}` auf stdin. 8 Unicode-Zeichen Mindestlänge, 72 UTF-8-Bytes bcrypt-Obergrenze, kein Nullzeichen. `classes.name` für diesen einzelnen Pilot eindeutig; `users.class_id` NOT NULL/FK. Beide Provisionierungs-Kommandos bleiben privat.
- Migration 2: ergänzt `classes`, `display_name`, `class_id` und `schema_migrations`. Verweigert alte DB mit Konten ohne Profil, rät keine Zuordnung. Leere Alt-DB und Wiederholung auf befüllter v2-DB getestet. Keine umfassende allgemeine Migrationsverwaltung; kein automatisches Schema-Downgrade.
- **34/34 Backendtests** auf SQLite und MariaDB, **16/16 Login-Browsertests**, **207/207 Logik-/Deploymenttests** (197 + 10) grün. Ein anfänglicher Testreihenfolgefehler (Anonymtest benutzte schon eingeloggte Sitzung) nur im Test behoben und alles erneut bestanden. Tests decken 7/8-Zeichen-Grenze, Umlaute, Obergrenze, unbekannte/fehlende Klasse, Namensvalidierung, doppelte E-Mail, Pflicht-FK, Migrationsabbruch und Wiederholung ab. Lokale Test-MariaDB danach geordnet beendet.
- Vor Live-Migration DB mit 0 Konten erneut bestätigt. Privater SQL-Dump `agentpy-private/backups/before-profile-v2-20260917.sql`, 5087 Bytes, SHA256 `0bd33d26f0aed7f658f9d421519385d1aaf3391f29baf7046ad117cb020fa03c`. Per `mariadb-dump` erzeugt, Passwort nur serverintern als Prozessumgebung. Noch kein Restore getestet; Dump stammt **vor** dem persönlichen Konto.
- Neues unverändertes Paket `pilot-20260917-r2`, **119 Dateien**, Archiv-SHA256 `003cc3b756e7da6a5aea2f04871fc3ca02a0972b5574f3a4ff6586399a563477`. Lokal `.cache/hostinger/`, auf Hostinger privat neben r1. Kein Herkunftscommit, da weiterhin uncommittet/ungepusht. R1 nicht überschrieben.
- Live-Migration, r2-Aktivierung und abschließendes `confirm` bestanden. Zählung danach: 1 Konto, 1 Klasse, 1 Lernstand (Revision 0), 0 Wiederholungsbelege; Schema 2. R1-Webroot gesichert unter `agentpy-private/backups/web-20260917182715-236acdac39`. Rückfallbefehl jetzt mit ID `pilot-20260917-r2` verwenden; Datenbankschema nicht zurücksetzen. R1 kann vorhandene Konten lesen/anmelden, seine alte CLI-Kontoanlage erfüllt das neue Schema nicht mehr.
- Live-Healthcheck und Login-Speicher-Smoke für r2 grün, einschließlich Profilname/Klasse; dabei zwei synthetische Konten und eine synthetische Klasse angelegt und gezielt wieder gelöscht. Anschließend persönliches Testkonto über `scripts/provision-hostinger-account.mjs` und verdeckte stdin-Eingabe eingerichtet, echter Browser-Login/Name/Klasse/Logout geprüft, **keine Fortschrittsänderung**. Keine Selbstregistrierung; kein Passwortwechsel-/Reset-Ablauf bisher.
- Ältere Angaben zu null Konten, vier Tabellen und r1 als aktuellem Release in den folgenden historischen Einrichtungsdetails beschreiben die erste Veröffentlichung; für Fortsetzung gilt dieser r2-Abschnitt. Keinen leeren Erstinstallationszustand mehr annehmen, keine Kontoanlage blind wiederholen.

## Git und Veröffentlichung

- Branch `dev-login-save` wurde von `main` bei `f2ceb63` angelegt und ist ausgecheckt.
- Alle neuen Änderungen sind aktuell **uncommitted und ungepusht**. Der geprüfte Arbeitsstand wurde auf Hostinger als Testversion aktiviert (Manifest-Herkunftscommit null, keine falsche Git-Zuordnung). Vier Datenbanktabellen angelegt. Bestehendes GitHub Pages und andere Hostinger-Websites unverändert.
- `LOGIN-PILOT.md` und Teile von `TODO.md` enthielten schon zu Turnbeginn die gemeinsame Planung; bewahren.
- https://agentpy.bildungdigital.at/ liefert die AGENT-PY-Testversion über PHP 8.3.33/LiteSpeed; HTTP leitet mit 301 auf HTTPS um. Keine Nameserver-/Hauptdomain-/Mailänderung. Noch keine öffentliche Registrierung oder Passwortwiederherstellung.

## Fertige lokale Implementierung

- `server/src/{bootstrap,auth,storage}.php`, `server/public/api/index.php`, `server/schema.sql`, `server/bin/manage.php`, `server/config.example.php`, `server/README.md`.
- E-Mail/Passwort, bcrypt, serverseitige Sitzungen, Rotation, Ablauf, HttpOnly/Secure/SameSite-Cookies in Produktion, Origin+CSRF-Prüfung und kontogebundener Profilheader gegen alte Tabs.
- Keine öffentliche Registrierung: CLI-Kontoanlage vorhanden; Wiederherstellung und praktischer Schüler-Onboarding-Ablauf noch offen.
- API-Aktionen session/login/logout/state/write; Schreibkommandos attempt/complete/reset/unlocks/feature. Erfolgreicher Code und Freischaltungen werden gemeinsam transaktional gespeichert. Versionen verhindern stilles Überschreiben; Operationskennungen erlauben sichere Wiederholung.
- Nur eigene Sitzungsdaten zugänglich. Maximal 32 KiB Code, 64 KiB Anfrage, 2 MiB Gesamtstand. PHP führt Schülercode NICHT aus; Erfolg wird noch clientseitig festgestellt, kein manipulationssicheres Benotungssystem.
- Pixelmuseum-Briefing-Hilfestände und ausdrückliche Überspring-Links sind angebunden und gegen Gerätewechsel geprüft. Die zwei Passwort-Hinweise im Museum-Finale bleiben wie zuvor flüchtiger Seitenzustand.
- Neu: `assets/data/remote-learning-data.js`, `account-config.js`, `account-bootstrap.js`, `account-ui.css`. Geschützte Same-Origin-Anfragen, profilgebundener Snapshot, serialisierte Writes, exakte Wiederholung bei fehlender Bestätigung, kein automatisches Überschreiben von Konflikten. Core-Dispose beendet auch den Remote-Adapter.
- Login/Logout auf index/index-b und allen 30 Runner-Seiten. Runner, Drohne/PICO, Agententraining, Heli und Museum warten im Kontomodus auf das Laden. Im eingeloggten Modus werden auch Geräteeinstellungen nur flüchtig gehalten, kein Gastadapter geöffnet.
- Identitätswechsel per BroadcastChannel sowie Prüfung bei Fokus/Sichtbarkeit/Seiten-Cache-Rückkehr. Alte Tabs werden gesperrt; bei erkanntem Kontowechsel Editor geleert. Fehlerstatus, Wiederholen, ausdrücklich bestätigtes Neuladen und Textdatei-Export des aktuellen Codes vorhanden.
- Standard `saveMode: "attempts"`; alternativ `"completion-only"` mit Versuchen ausschließlich im Tab-Arbeitsspeicher. Keine Tastendruck-Uploads. Kein persistenter Offline-Puffer: nicht bestätigte Änderungen sind bei Schließen/Absturz gefährdet; UI warnt und bietet Codeexport an.
- `account-config.js` bleibt im Repo auf **enabled: false**. Der lokale Login-Testserver aktiviert es ausschließlich in seinem Wegwerf-Release. Nicht ohne private Serverkonfiguration in Produktion einschalten.
- `scripts/build-static-site.mjs` und `tests/static-release.test.mjs`: Pages erhält öffentliche statische Dateien, keine PHP-Quellen, Konfiguration, SQL oder Tests; Commit-Marker bleibt erhalten. Zwei beim echten Release-Test entdeckte Paketierungsfehler sind behoben: Versionsordner wie `vendor/5.65.2` werden mitgenommen; produktiv benötigte `prototypes/finale.js` und `.css` ausdrücklich eingeschlossen.
- Workflow `.github/workflows/pages.yml`: Backendjob mit MariaDB und zusätzlicher Login-Browserjob auf Chromium/WebKit neben Logik/Gastbrowser. Alle vier Jobs Voraussetzung für Veröffentlichung. Tests auch auf Entwicklungsbranch. Veröffentlichung weiterhin nur von main nach Pages. Noch KEIN Hostinger-Deployment.
- `.gitignore` erweitert, npm-Skripte `test:backend` und `build:pages`, Testsammlung ergänzt. Alter Workflow-Quelltexttest wurde an den neuen Builder angepasst; funktionaler Release-Test prüft auch den Commit-Marker.

## Verifizierter Teststand

- **197/197 Logiktests grün**, zuletzt am 17.09. einschließlich drei neuer Hostinger-Pakettests. Private und öffentliche Dateiauswahl, Cache-Kennung, Manifest, ungültige IDs/Speichermodi/Ausgaben und Symlinks getestet.
- **30/30 Backendtests grün, nichts übersprungen**: SQLite und MariaDB, reale HTTP-Sitzungen und zwei PHP-Worker. Kontentrennung, Geräte, konkurrierende Writes/Wiederholungen, Rollback, Ablauf, beschädigter Stand, deaktivierte Konten, Grenzen, Hilfestände/Skip und Login-Drosselung. 15 reguläre Konten von einer IP getestet; KEIN vollständiger Klassenlasttest.
- **133/133 bestehende Browsertests grün**: aktuelle Standardmatrix Chromium plus WebKit-@ipad, nicht die zusätzliche optionale vollständige WebKit-Matrix.
- **16/16 Login-Browsertests grün**, zuletzt am 17.09. mit echtem Hostinger-Paketlayout: zwölf Login-Integrationstests, zwei Dialog-Layout/Fokus-Tests und zwei neue Tests gegen Auslieferung privater Dateien (Chromium/WebKit, PHP/SQLite). Bei unbekannten Pfaden kann PHPs lokaler Entwicklungsserver index.html mit 200 liefern; der Test vergleicht dann exakt den Startseiteninhalt, statt diesen Fallback mit einem Datenleck zu verwechseln. Reale Hostinger-Privatpfade separat mit 404 geprüft.
- **10/10 PHP-Einrichtungs-/Deploymenttests grün** (`npm run test:hosting`), gemeinsam mit vier Paket-/Pages-Tests 14/14. Wiederholung überschreibt kein Passwort, ungültige Ziele werden abgewiesen, Sonderzeichen bleiben Daten, manipulierte Pakete scheitern, unkonfigurierte API bleibt geschlossen. Neu: Aktivierung/Bestätigung/Rollback, Sperre bei offenem Deployment, injizierter zweiter Rename-Fehler, Prozessabbruch nach erster Umbenennung und verweigerte Bestätigung manipulierter Public-Dateien. Rechteprüfung unter Unix/CI, Windows nicht als POSIX-Nachweis gewertet.
- `git -c core.safecrlf=false diff --check` ohne Whitespacefehler. Keine echten Schülerdaten verwendet. Test-MariaDB wieder heruntergefahren.
- Neuer GitHub-Workflow noch nicht remote ausgeführt; `test:hosting` im Backendjob ergänzt. Die 30 Backend- und 133 Gastbrowser-Tests sind der vorherige bestandene Stand, in dieser Fortsetzung nicht erneut ausgeführt. 197 Logik- und 16 Login-Browsertests zuletzt vor dem Upload; seitdem keine App-Quellen geändert, nur Deploymenthelfer/Tests/Dokumentation.
- **Live-HTTPS-Healthcheck bestanden** (`scripts/check-hostinger.mjs`): Weiterleitung, Release-ID, HTML-/JS-Cache, private Pfade, API-no-store, individuelle Sitzungen, Secure/HttpOnly/SameSite/Host-only-Cookie, anonymer Standzugriff verweigert.
- **Live-Login-Smoke bestanden** (`scripts/smoke-hostinger-login.mjs`): zwei synthetische Konten; zwei unabhängige HTTP-Sitzungen als Geräte, Abschlusscode und Stand exakt wieder gelesen, idempotente Wiederholung, veralteter Write abgewiesen, Konto-/Profiltrennung, CSRF, Logout und unabhängige zweite Sitzung. Genau diese zwei Konten danach gelöscht. Anschließend `users`, `learning_states`, `write_receipts` jeweils 0 Zeilen bestätigt. Login-Limit-Metadaten/kurzlebige Testsitzungen nicht pauschal gelöscht. Keine echten Schülerdaten.
- **Live-Browser-Smoke bestanden** (`scripts/check-hostinger-browser.mjs`): Chromium und WebKit/iPad-Profil, Homepage/Assets, Gastfreigabe, Login-Dialog/Fokus/Viewport/Abbrechen. Screenshots `.cache/hostinger-browser/{chromium,webkit-ipad}-login.png` angesehen. Kein echter Schulgerätetest, kein live authentifizierter Browser-End-to-End-Test (dieser bisher lokal), kein Klassenlasttest oder Datenbank-Restore.

## Hintergrund der ersten Veröffentlichung (r1)

### Hostinger-Einrichtung inzwischen bestätigt

- Datenbank und eigener Datenbankbenutzer: jeweils `u535472856_agentpy`, Host `localhost`, MariaDB 11.8.9. PDO-Verbindung geprüft, vor Migration exakt diese DB und 0 Tabellen verifiziert. Danach über privates `app/bin/manage.php migrate` vier Tabellen angelegt: `users`, `learning_states`, `login_limits`, `write_receipts`, alle InnoDB/utf8mb4_unicode_ci. Migration nicht erneut als Erstinstallation behandeln.
- Nutzer hat bestätigt, das im früheren Screenshot sichtbare Datenbankpasswort geändert zu haben. Das neue Passwort nicht im Chat oder Repository anfordern/ablegen.
- SSH laut hPanel aktiv: Host `195.35.49.40`, Port `65002`, Benutzer `u535472856`. Dieser Hosting-Zugang ist nicht automatisch auf die AGENT-PY-Website beschränkt; andere Websites nicht verändern.
- Mit Zustimmung einen eigenen Ed25519-Schlüssel ohne Passphrase für Deployment erzeugt: privat `C:\Users\Cy-X\.ssh\agentpy_hostinger`, öffentlich gleicher Pfad mit `.pub`. Private Datei außerhalb des Repositorys, niemals ausgeben oder hochladen. Fingerabdruck des öffentlichen Schlüssels: `SHA256:yyjXh66NPwi73fnLjbYn/CMjUbw+A35eMef5KCTd0zM`.
- Nutzer-Screenshot bestätigt: öffentlicher Schlüssel als `agentpy-deploy` in Hostinger eingetragen.
- Serverfingerabdruck am 16.09. per Keyscan und am 17.09. beim SSH-Handshake identisch: `SHA256:kQ+KAVjYVkgYHDhqYVqI4r7lIa7KPJVGfk12xK3MGG0` (ED25519). Hostinger hat keinen unabhängig bestätigten Referenzwert geliefert. Nutzer hat am 17.09. ausdrücklich erstmaliges Vertrauen erlaubt ("ich vertraue"). **Diese Entscheidung ist erledigt: nicht erneut um Supportbestätigung bitten.** Kein Verzicht auf sonstige Zugriffssicherheit.
- Genau diesen Hostschlüssel bei der ersten Verbindung per Fingerabdruck bestätigt; gespeichert in `C:\Users\Cy-X\.ssh\agentpy_hostinger_known_hosts`. Weitere Verbindungen erfolgreich mit `StrictHostKeyChecking=yes`, `HostKeyAlgorithms=ssh-ed25519`, `UpdateHostKeys=no`, `BatchMode=yes`, `IdentitiesOnly=yes`, `IdentityAgent=none`, `ForwardAgent=no`, `ClearAllForwardings=yes`, `-F NUL` und diesem `UserKnownHostsFile`. Bei späterer Abweichung stoppen, nicht `StrictHostKeyChecking=no` verwenden.
- Lokaler Windows-Quotingfehler bei der ursprünglichen Schlüsselerzeugung korrigiert: versehentliche Passphrase mit Zustimmung per interaktivem `ssh-keygen -p` entfernt. Der öffentliche Schlüssel/Fingerabdruck blieb unverändert; Anmeldung anschließend ohne Rückfrage geprüft. Private Datei niemals ausgeben oder ins Repository kopieren.
- Erfolgreich angemeldet als `u535472856`, Home `/home/u535472856`. AGENT-PY-Domainverzeichnis per `realpath` bestätigt: `/home/u535472856/domains/agentpy.bildungdigital.at`; Webroot `public_html` darunter. Die ursprüngliche `default.php` liegt jetzt im privaten Webroot-Backup. Keine anderen Websites inspiziert/geändert.
- **CLI-Falle:** einfacher Befehl `php` ist PHP 7.4.33, für unsere App ungeeignet! Für Einrichtung/Migration explizit `/opt/alt/php83/usr/bin/php` verwenden (8.3.33). PDO MySQL/SQLite, Session, JSON, OpenSSL und `password_hash` geprüft vorhanden. Zusätzlich PHP 8.4.19 unter `/opt/alt/php84/usr/bin/php` vorhanden. Web-PHP war zuvor per HTTPS-Header 8.3.33. `rsync`, `tar`, `mysql` sind als CLI verfügbar.
- Privater Ort: `/home/u535472856/domains/agentpy.bildungdigital.at/agentpy-private` (0700), mit `config.php` und `database-password.txt` (0600), `sessions`, `backups`, `tools`, `releases`. Nutzer hat Passwort direkt dort eingetragen; Verbindung funktioniert. Rechte nach Deployment nochmals kontrolliert. Kein Fehler-/Setup-Endpunkt im Webroot. Passwortdatei nicht lesen, ausgeben oder herunterladen; nur serverseitig durch `config.php` verwenden. Genaue Klickfolge für spätere Rotation in `HOSTINGER-DEPLOY.md`.
- Initialisierung erfolgte mit `server/bin/prepare-hostinger.php`, danach Helfer aus dem Domainverzeichnis nach `agentpy-private/tools/prepare-hostinger.php` verschoben (0600). Keine bestehende Datei überschrieben. Prüfer liegt in `agentpy-private/tools/verify-hostinger-release.php`.
- `scripts/build-hostinger-release.mjs` erzeugt getrennt `public/`, `app/` und ein SHA256-/Größenmanifest. Im öffentlichen Paket nur eine PHP-Datei (`api/index.php` als Einstieg zur privaten Anwendung). Aktiviert Login nur im Paket und kennzeichnet alle lokalen JS/CSS-Verweise mit der Release-ID. Pages-/Quellkonfiguration bleibt deaktiviert. Static-Builder zusätzlich gegen Asset-Symlinks und unbekannte endungslose Dateien gehärtet; LICENSE/SHA256SUMS bleiben enthalten.
- Paket `pilot-20260917-r1` ist **aktiv und bestätigt**, unveränderte Quelle unter `agentpy-private/releases/pilot-20260917-r1`. Alle **118 Dateien** mit Manifest geprüft, alle sechs PHP-Dateien unter PHP 8.3.33 syntaktisch geprüft. Archiv `agentpy-private/pilot-20260917-r1.tar.gz`, SHA256 `3ad05a574bf52e0ad0e8e1a10ccbbbe58bb6b2fe65a61ad27f1290f02457f172`, 3.35 MB; gleicher lokaler Stand unter `.cache/hostinger/`. Herkunftscommit null, weil uncommitteter Arbeitsstand. Neue Änderungen unter neuer ID bauen, r1 nicht still überschreiben. Modus `attempts`, keine Tastendruck-Uploads.
- Neue private Helfer `tools/activate-hostinger.php` und aktualisierter `tools/verify-hostinger-release.php`, beide 0600 und PHP-linted. Aktivierung schreibt ein Journal vor zwei Umbenennungen; kurze Umschaltlücke möglich, nicht atomar. Vorheriger Webroot in `agentpy-private/backups/web-20260917075818-73b8645a20`. Nach erfolgreichen Liveprüfungen `confirm` ausgeführt; `active-deployment.json` vorhanden, offenes Journal privat archiviert. Zurückschaltung: `/opt/alt/php83/usr/bin/php <private>/tools/activate-hostinger.php <domainroot> pilot-20260917-r1 rollback`. Nur bei tatsächlichem Bedarf ausführen, niemals Datenbank-Rollback damit behaupten. Exakter Befehl in `HOSTINGER-DEPLOY.md`.
- Nächster fachlicher Schritt: eigener manueller Testzugang und sinnvoller Kontoanlage-/Passwortwiederherstellungsablauf. Es gibt derzeit KEIN dauerhaftes Testkonto und keine Selbstregistrierung. Keine Passwörter aus verdächtigen lokalen Dateien oder alten Screenshots übernehmen. Bis Freigabe weiterhin nur synthetische Konten.
- Achtung bei Git: Eine neue, fremde/ungetrackte Textdatei mit passwortähnlichem Dateinamen wurde gesehen, nicht geöffnet oder verändert. Nicht committen/veröffentlichen; keine pauschalen `git add`-Befehle. Dateinamen/Inhalt nicht in Ausgaben wiederholen. Nutzer soll klären, ob dort Zugangsdaten liegen.

## Nächste Arbeitsschritte nach r2

1. Persönliches Testkonto ist vorhanden; Nutzer kann sich anmelden. Git-Änderungen prüfen, dabei den oben beschriebenen verdächtigen ungetrackten Dateinamen nicht ausgeben. Browser-/API-Anbindung ist vorhanden. Commit/Push bislang nicht beauftragt.
2. **Datenbank, SSH, Passwort, Konfiguration, Schema und Testveröffentlichung sind erledigt; nicht neu anlegen oder wieder nach Passwort fragen.** Keine Passwörter hier oder im Repository ablegen. Private Pfade, Aktivierung/Rollback und Live-Tests siehe `HOSTINGER-DEPLOY.md`.
3. GitHub-Hostinger-Auslieferung fehlt noch. Nach Commit-/Push-Auftrag Änderungen gezielt prüfen/stagen und durch CI laufen lassen. Neue Pakete unter neuer ID. Nicht einfach das ganze Repository hochladen. Die jetzige Testversion stammt aus dem geprüften lokalen Arbeitsstand, nicht aus einem remote bestandenen CI-Lauf.
4. Schüler-Kontoanlage und Passwortwiederherstellung mit geprüftem Mailversand/Unterrichtsablauf ergänzen. CLI-Anlage mit Pflichtklasse ist nur Grundlage. Datenschutz/Verantwortlichkeit/Löschung und Backups klären. Über Pilotmigration 2 hinausgehende Migrationen und Aufräumen alter Wiederholungsbelege fehlen noch.
5. Ergänzende Browserabnahme: abgelaufene Sitzung während Arbeit, Zurück/Seiten-Cache, unterbrochener Seitenaufruf, Wiederanmeldung nach Serverfehler und ungespeicherter Text beim Verlassen. Noch kein dauerhafter Offline-Puffer; darüber bewusst entscheiden, nicht still Gastdaten verwenden.
6. Auf Hostinger weiterhin ausschließlich synthetische Testkonten; 15/30-Personen-Last und Datenbank-Backup-Restore noch prüfen. Danach zwei echte Schulgeräte/Schulnetz. Bestehende WordPress-Sicherheitswarnungen desselben Kontos klären. Lehreransicht/Microsoft/OneDrive bleiben zurückgestellt.

## Lokale Tests wieder starten (PowerShell)

System-Node ist veraltet. Den gebündelten Node verwenden:

```powershell
& 'C:\Users\Cy-X\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/all.test.mjs
```

Portable PHP 8.5.10 und MariaDB 11.4.8 liegen ausschließlich unter gitignoriertem `.cache`, kein globaler Dienst wurde installiert. PHP wird vom Backendtest automatisch gefunden. Lokale Datenbank `agentpy_test`, Port 33367, ausschließlich synthetische Daten. MariaDB nach Abschluss dieses Turns stoppen; bei Fortsetzung zuerst prüfen, ob bereits ein Prozess lauscht. Bei Bedarf in separatem Terminal starten:

```powershell
& ./.cache/mariadb-runtime/extracted/mariadb-11.4.8-winx64/bin/mariadbd.exe --no-defaults --basedir=C:/Users/Cy-X/GitHub/e-d-u-c-a-t-i-o-n/learn_python/.cache/mariadb-runtime/extracted/mariadb-11.4.8-winx64 --datadir=C:/Users/Cy-X/GitHub/e-d-u-c-a-t-i-o-n/learn_python/.cache/mariadb-runtime/test-data --bind-address=127.0.0.1 --port=33367 --innodb-buffer-pool-size=32M --console
```

Backendtest mit beiden Datenbanken (Kennwort ist ausschließlich ein wegwerfbares lokales Testkennwort, kein Hostinger-Zugang):

```powershell
$env:AGENTPY_TEST_MYSQL_DSN = 'mysql:host=127.0.0.1;port=33367;dbname=agentpy_test;charset=utf8mb4'
$env:AGENTPY_TEST_MYSQL_USER = 'root'
$env:AGENTPY_TEST_MYSQL_PASSWORD = 'agentpy-local-test-only'
& 'C:\Users\Cy-X\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/backend-api.test.mjs
```

Tests starten PHP-Prozesse und benötigen hier ggf. Sandbox-Freigabe (EPERM bei spawn). Niemals auf eine echte Schülerdatenbank richten: Fixtures verändern die isolierte Testdatenbank; Name muss auf `_test` enden. Ohne MySQL-Variablen läuft nur SQLite. Testdateien: `tests/backend-api.test.mjs`, `tests/backend-fixture.php`.

Browserbefehle (PATH muss den gebündelten Node vor dem alten System-Node enthalten):

```powershell
$env:PATH = 'C:\Users\Cy-X\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
node node_modules/@playwright/test/cli.js test --config playwright.login.config.mjs
node node_modules/@playwright/test/cli.js test --workers=2
```

Der Login-Testserver baut eine echte öffentliche Dateiauswahl, aktiviert darin den Kontomodus und erzeugt isolierte SQLite-Testkonten. Er läuft auf 127.0.0.1:4174, der Gasttestserver auf :4173. Nicht als Hostinger-Release verwenden. `.cache/login-results` enthält Screenshots/Traces; Testpasswörter sind nur synthetisch. Browser-Testserver werden von Playwright beendet.
