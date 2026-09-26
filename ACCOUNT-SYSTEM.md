# AGENT PY: Datenhaltung, Konten, Klassen und Rechte

Technischer Regelvertrag für Wartung und Weiterentwicklung. Stand: **26.09.2026**.
Dieses Dokument beschreibt die beabsichtigten Regeln und ihre Umsetzung im aktuellen Entwicklungsstand; es ist **kein Nachweis einer Veröffentlichung**. Änderungen müssen Code, Tests und diesen Regelvertrag gemeinsam aktualisieren.

## 1. Zuerst lesen: Status und verbindliche Leitplanken

| Stand | Bedeutung |
| --- | --- |
| Zuletzt bestätigte Produktion | Hostinger **`pilot-20260926-r15`, Schema 9**, Deployment bestätigt, `pendingDeployment=false`; siehe jüngsten Eintrag in [LOGIN-HANDOFF.md](LOGIN-HANDOFF.md). |
| Veröffentlichte Verwaltung | Klassenbesitz, Rollenentzug, Kontenverwaltung, feste Schul-Domain und Schülertransfer sind in r15 enthalten. Herkunft: `d00c8da65369f9405afd6ee150fccc6262f630de`, `dev-login-save`. |
| Geprüfte Schülerübertragung | Schema 9, API, Oberfläche und Regressionstests auf `dev-login-save`, geprüfter Commit `d00c8da65369f9405afd6ee150fccc6262f630de`. **CI 36194686016 vollständig erfolgreich**: SQLite/MariaDB, Hosting, Logik, beide Missionsbrowser und 68/68 Konto-Browsertests. Lokaler Transfer-Nachlauf 2/2 erfolgreich, Dialogbilder geprüft. |
| Releaseprüfung | Private Bestandskopie mit zweimaliger SQLite-Migrationsprobe, MariaDB-Pfad in CI, danach Live-Migration 7→8→9 mit frischer SQL-Sicherung und **24 unveränderten Datentabellen**. HTTPS, anonyme Chromium-/WebKit-Oberfläche, rein lesende Klassen-/Adminabfragen und Mailworker erfolgreich geprüft. Keine echten Konten für Funktionstests verändert. |

Die folgenden Funktionsbeschreibungen entsprechen dem r15-Anwendungsstand; ausdrücklich als Ideen oder Grenzen bezeichnete Funktionen bleiben ausgenommen. Nach einer späteren Veröffentlichung diesen Statusblock und den Handoff aktualisieren. Historische Abschnitte in Handoff, TODO und `server/README.md` sind **keine neuen Aufträge**, insbesondere nicht zum Löschen echter Konten.

### Unveränderliche Grundregeln bei normalen Erweiterungen

1. **Konto-ID ist die Identität.** E-Mail, Anzeigename, Klasse und Lehrrolle können sich ändern, die Konto-ID und ihr Lernstand bleiben bestehen.
2. **Gastdaten und Kontodaten bleiben getrennt.** Kein automatischer Import, Zusammenführen, Überschreiben oder lokaler Ersatzspeicher für fehlgeschlagene Kontospeicherung.
3. **Mitgliedschaft, Lehrrolle und Klassenbesitz sind verschiedene Beziehungen.** Eine Klasse anzeigen zu dürfen bedeutet nicht, sie löschen oder übertragen zu dürfen.
4. **Rechte gelten serverseitig.** Versteckte Buttons, Klassenname `Lehrer:innen`, E-Mail-Domain, URL und Browserflags vergeben keine Verwaltungsrolle.
5. **Ein Schülertransfer ist keine Kontolöschung und keine Neuregistrierung.** Passwort, Lernstand, Programmcode und unabhängige Mitgliedschaften bleiben erhalten.
6. **Löschen ist kontextabhängig.** Aus einer Klasse entfernen kann eine Mitgliedschaft entfernen oder ein exklusives Schülerkonto löschen. Globale Admin-/Selbstlöschung löscht das Konto unabhängig von weiteren Schülerklassen.
7. **Keine stillen Datenreparaturen.** Fehlender/kaputter Kontolernstand ist ein Fehler, niemals ein neues leeres Profil. Namenskonflikte bei Migration nicht automatisch umbenennen.
8. **Keine echten Konten für destruktive Tests verwenden.** Tests nur in isolierten Entwicklungsdatenbanken; keine alten Operator-Skripte erneut ausführen.
9. **Keine Geheimnisse in Git, Logs, Dokumentation oder Testbildern.** Konkrete Passwörter, Tokens und private Schlüssel gehören nicht hierher.
10. **Ein grüner Einzeltest ist keine Releasefreigabe.** SQLite, MariaDB, beide Browser, Paketgrenzen, Migration und Bestandserhalt gemeinsam prüfen.

## 2. Wegweiser im Code

| Verantwortung | Implementierung |
| --- | --- |
| API-Einstieg, Methoden und Rechteprüfung | [server/public/api/index.php](server/public/api/index.php) |
| Konfiguration, DB-Verbindung, Fehler, Bootstrap | [server/src/bootstrap.php](server/src/bootstrap.php) |
| Sitzung, Login, CSRF, Profilidentität | [server/src/auth.php](server/src/auth.php) |
| Kontenerstellung, Passwortregeln, Migrationsreihenfolge | [server/src/account-management.php](server/src/account-management.php) |
| Lernstand, Revision, erlaubte Schreibbefehle | [server/src/storage.php](server/src/storage.php) |
| Klassencode, Registrierung, E-Mail-Bestätigung | [server/src/registration.php](server/src/registration.php) |
| Passwort-Reset, Sitzungswiderruf | [server/src/recovery.php](server/src/recovery.php) |
| Versandwarteschlange / SMTP | [mail.php](server/src/mail.php), [smtp.php](server/src/smtp.php), [mail-worker.php](server/bin/mail-worker.php) |
| Klassen, Schülerlisten, Mitgliedschaften, Bestätigen/Bearbeiten/Löschen | [server/src/teachers.php](server/src/teachers.php) |
| Superadmin, Lehrereinladungen und Co-Teaching | [server/src/roles.php](server/src/roles.php) |
| Feste Schul-Domain, Besitzerwechsel, Rollenentzug, globale Konten, Selbstlöschung | [server/src/management.php](server/src/management.php) |
| Schüler übertragen / zusätzlich zuordnen, Zustimmungsanfragen | [server/src/transfers.php](server/src/transfers.php) |
| Gemeinsame Lernstandsschnittstelle | [learning-data-core.js](assets/data/learning-data-core.js), [local-learning-data.js](assets/data/local-learning-data.js), [remote-learning-data.js](assets/data/remote-learning-data.js) |
| Login-/Kontodialoge, Profilwechsel, Gastwarnung | [assets/data/account-bootstrap.js](assets/data/account-bootstrap.js) |
| Persistente Vollbild-/Kontoshell | [app.html](app.html), [assets/data/account-shell.js](assets/data/account-shell.js) |
| Lehrer-/Adminoberfläche | [lehrer.html](lehrer.html), [teacher-ui.js](assets/data/teacher-ui.js), [teacher-ui.css](assets/data/teacher-ui.css) |
| Dialoggestaltung im Elternfenster | [assets/data/account-ui.css](assets/data/account-ui.css) |
| Einheitliche Fortschrittsberechnung | [assets/data/course-progress.js](assets/data/course-progress.js) |
| Deployment/Paketgrenzen | [HOSTINGER-DEPLOY.md](HOSTINGER-DEPLOY.md), [build-hostinger-release.mjs](scripts/build-hostinger-release.mjs), [build-static-site.mjs](scripts/build-static-site.mjs) |

## 3. Wo welche Daten liegen

### 3.1 Gast: nur in diesem Browser und dieser Origin

Der lokale Adapter verwendet `localStorage`: `unlockedLevels_v2`, `completedLevelCode_v1`, `attemptedLevelCode_v1`, `pixelmuseumHelp_v1`. Es gibt zusätzlich historische UI-Schlüssel, die nicht mit Kontodaten verwechselt werden dürfen. Die temporäre Gast-Vorführeinstellung liegt bei aktivem Kontosystem unter `agentpy-guest-teacher` in `sessionStorage`.

Browser-/Gerätewechsel synchronisiert Gastdaten nicht. Das Löschen von Browserdaten kann sie entfernen. Ein anderes Protokoll oder eine andere Domain hat einen anderen Speicher. Der Adapter behandelt Speicherfehler, Quota, konkurrierende Tabs und kombinierte Code-/Freischaltungsänderungen; lokale Locks nutzen Web Locks bzw. den vorhandenen Fallback. Keine direkten neuen `localStorage`-Zugriffe in einzelnen Missionen einführen.

Bei einem Gast-Missionsstart erscheint der Hinweis auf reine Browserspeicherung, mit OK bzw. Anmelden. Es gibt kein dauerhaftes Kontooverlay rechts unten. Der Startbildschirm zeigt bei vorhandenem Stand „Setze fort“, führt aber zur Missionsübersicht; ohne Stand „Training starten“. Die Fortsetzung ist eine Empfehlung aus dem Lernstand, keine gespeicherte chronologische Besuchshistorie.

### 3.2 Angemeldet: zentraler Lernstand je Konto

`learning_states.user_id` gehört zu genau einem Konto, nicht zu einer Klasse. Alle Mitgliedschaften desselben Kontos teilen daher denselben Lernstand. Der Server liefert eine Revision und ein Dokument mit:

| Feld | Inhalt / Bedeutung |
| --- | --- |
| `attemptedCodes` | Zuletzt gespeicherte Versuche pro stabiler Level-ID. |
| `completedCodes` | Als erfolgreich gespeicherte Lösungen pro Level-ID; Grundlage der Prozentanzeige. |
| `unlockedIds` | Freigeschaltete Navigation; allein kein erfolgreicher Abschluss. |
| `featureProgress` | Explizit erlaubte Zusatzdaten, derzeit Pixelmuseum-Hilfe. |

Die Lehrerliste erhält Abschluss-/Freischaltungs-IDs für die Anzeige, **nicht den gespeicherten Quellcode**. Admin-Kontenlisten enthalten ebenfalls keine Lösungen, Hashes oder Tokens.

Das Frontend lädt den Kontolernstand vor Nutzung des Adapters (`AgentLearningDataReady`). `saveMode` unterscheidet Speichern von Versuchen und reines Abschlussspeichern; „Code speichern“ löst ausdrücklich einen Speichervorgang aus. Es gibt keine Zusage, dass jeder Tastendruck schon am Server liegt. Die Remote-Schreibwarteschlange ist im Speicher, keine dauerhafte Offline-Outbox. Bei Verbindungsproblemen Fehler anzeigen und ungesicherten Code sichern lassen; nicht unbemerkt auf Gastdaten umschalten.

### 3.3 Schreibsicherheit

`write {operationId, expectedRevision, command}` arbeitet in einer Transaktion. Der Server bestimmt `userId` ausschließlich aus der Sitzung. Eine wiederholte identische Operation wird über `write_receipts` erkannt; dieselbe ID mit anderem Inhalt liefert `OPERATION_ID_REUSED`. Eine veraltete Revision liefert `REVISION_CONFLICT`, nicht „letzter Schreibzugriff gewinnt“. Ein Replay liefert den aktuellen Zustand und rollt spätere Arbeit nicht zurück.

Erlaubte Befehle/Felder und Level-/Unlock-IDs stehen in `storage.php` und müssen mit dem Browsermodell übereinstimmen. Code ist auf 32768 Bytes pro Schreibbefehl begrenzt, der API-Body auf 65536 Bytes. Erfolg speichert Code und Freischaltungen zusammen. Ansichten/Skip-Links zählen nicht als Abschluss. Kontowechsel, alte Tabs und verspätete Antworten dürfen keine Daten des vorherigen Kontos in das neue übernehmen.

**Bewertungsgrenze:** Python und die fachlichen Validatoren laufen im Browser. Der Server validiert Schreibstruktur/Identität, führt aber die Python-Lösung nicht erneut fachlich aus. Fortschritt ist deshalb eine Lernhilfe, kein manipulationssicherer Prüfungsnachweis.

### 3.4 Datenmodell und Beziehungen

| Tabellen | Aufgabe / Besonderheit |
| --- | --- |
| `users`, `classes` | Konto mit eindeutiger normalisierter E-Mail und einer erforderlichen primären `class_id`; `classes.name` kann bei verwalteten Klassen ein interner Schlüssel sein. Öffentlicher Name steht in `teacher_classes.display_name`. |
| `class_memberships` | Zusätzliche bzw. explizite Schüler-/Gruppenzugehörigkeiten. `accountClasses()` berücksichtigt auch die primäre Referenz. Nie nur eine der beiden Quellen auswerten. |
| `learning_states`, `write_receipts` | Lernstand/Revision und Idempotenz je Konto. |
| `email_confirmations` | Bestätigungsstatus der Adresse, unabhängig von `users.active`. Aktiv und unbestätigt ist ein erlaubter Zustand. |
| `auth_epochs`, `login_limits` | Widerruf alter Sitzungen und Missbrauchsbegrenzung. PHP-Sitzungen liegen zusätzlich serverseitig im privaten Sitzungsspeicher. |
| `class_registration`, `class_invitations`, `invitation_secrets` | Kapazität, Codehash/Gültigkeit sowie verschlüsselter Code für die Anzeige beim Lehrer. Entschlüsselungsschlüssel liegt privat außerhalb des Webroots. |
| `pending_registrations`, `mail_jobs` | Reservierte Neuanmeldungen ohne fertiges Konto und Bestätigungsmails. |
| `password_resets`, `recovery_mail_jobs` | Resetberechtigung und Reset-/Benachrichtigungsmails. |
| `teachers`, `superadmins` | Tatsächliche Rollen; `teachers.class_limit` begrenzt eigene Klassen. |
| `teacher_classes`, `class_teachers` | Ein Inhaber pro verwalteter Klasse; zusätzliche Lehrkräfte separat. Keine Schüler-Mitgliedschaft durch Co-Teaching. |
| `teacher_invitations`, `teacher_mail_jobs` | E-Mail-Einladung, Limit und spätere Rollenannahme. |
| `class_namespaces` | Feste ursprüngliche Schul-Domain plus normalisierter Namenshash (Schema 8). |
| `student_transfers` | Noch offene Schülerübertragungen (Schema 9), mit Quelle, Ziel, Konto, anfragendem Inhaber, Modus und Ablauf. |
| `mail_dispatch_lock`, `mail_attempts` | Gemeinsames Versandbudget, auch bei mehreren Workern. |
| `teacher_audit` | Ausgewählte Verwaltungsereignisse mit IDs/Aktion/Zeit, keine vollständige revisionssichere Historie jeder Profiländerung. |
| `schema_migrations` | Angewendete Versionen; nicht durch Webaufrufe automatisch migrieren. |

Passwörter werden als bcrypt-Hash gespeichert, nicht im Klartext. Bestätigungs-/Reset-/Einladungstabellen prüfen Tokenhashes. **Die Mailwarteschlangen benötigen bis zum Versand den tatsächlichen Token**; nach erfolgreicher Transportannahme wird das Tokenfeld geleert. Datenbank und Backups enthalten also sensible Daten und sind nicht zur Veröffentlichung geeignet.

### 3.5 Lebensdauer und Löschung

Abgelaufene Registrierungen/Resets werden in den vorgesehenen Worker-/Anforderungsabläufen bereinigt. Mailversuchsdatensätze außerhalb des 24-Stunden-Fensters entfallen bei der Budgetprüfung. Abgelaufene Transferanfragen sind sofort unwirksam und nicht mehr sichtbar; ihre physische Bereinigung erfolgt derzeit beim Anlegen neuer Transferanfragen. Nicht jede abgelaufene Lehrereinladung oder jeder Auditdatensatz wird automatisch sofort gelöscht.

Globale Kontolöschung entfernt die zugeordneten Lernstände, Mitgliedschaften und abhängigen Datensätze über Foreign Keys bzw. explizite Bereinigung. Sie bereinigt **nicht automatisch private SQL-Backups, sämtliche Audit-IDs oder fremde Mailpostfächer**. Aufbewahrung und Löschung von Backups/Logs müssen betrieblich geregelt werden. Es gibt derzeit keine vollständige automatisierte Aufbewahrungs- oder Datenschutzexportfunktion.

## 4. Login, Sitzung und Navigation

- E-Mail wird getrimmt und kleingeschrieben; sie ist der Loginname. Anzeigenamen sind frei gewählte, begrenzte Beschriftungen, keine Berechtigungen.
- Neue Passwörter: mindestens acht Unicode-Zeichen, maximal 72 UTF-8-Bytes, kein Nullbyte. Keine zusätzliche Pflicht zu Großbuchstaben/Ziffern/Sonderzeichen. Hashing: bcrypt, Kostenfaktor 12.
- Loginbegrenzung: zehn Versuche pro E-Mail und 150 pro IP im 15-Minuten-Fenster. Allgemeine Fehlermeldung nennt mögliche Ursachen (nicht angelegt, nicht bestätigt, falsche E-Mail/Passwort), verrät aber nicht, welches Konto existiert.
- Produktion verwendet `__Host-agentpy_session`, Secure, HttpOnly, SameSite=Lax, Path `/`, ohne Domainattribut. Sitzungs-ID und CSRF-Token werden beim Login/Logout erneuert. Inaktivität maximal zwei Stunden, absolute Sitzung maximal zwölf Stunden.
- Änderungen benötigen korrekte Origin, serverseitiges CSRF-Token und gegebenenfalls angemeldetes Profil. `X-Agentpy-Profile` schützt vor alten Tabs nach Kontowechsel, ersetzt aber keine Authentifizierung.
- `auth_epochs` widerruft bestehende Sitzungen etwa nach Passwortreset, E-Mail-Änderung und Rollenannahme/-entzug. Zugriff auf gelöschte/inaktive Konten scheitert ebenfalls. Der Browser erkennt dies beim nächsten Abgleich/Request, nicht durch einen garantierten sofortigen Push.
- Anmeldung aus einem Gastlevel, normales Abmelden und erkannter Sitzungswiderruf führen zur Startseite. Gaststand wird nicht importiert; Kontostand nicht in den Gastadapter kopiert.
- Ausnahme: Der ausdrücklich angebotene Logout zum Bestätigen/Annehmen eines Links für ein anderes Konto erhält diesen Link und setzt den Dialog fort. Sonst keine Ausnahme von der Startseitenregel.
- Vollbild- und Personensymbol bleiben rechts oben in der persistenten Shell. Levelwechsel laden das Kinddokument, nicht die ganze Shell; Browserbeschränkungen der Fullscreen-API weiterhin beachten.
- Bestätigungsaktionen sind stärker hervorgehoben als Abbrechen. Passwortaugen, sichtbare Fokusmarkierung, verständliche Fehlermeldungen und Dialogzustände dürfen durch CSS-Änderungen nicht verschwinden. Dialoge der Lehreransicht werden in das **Elterndokument** eingefügt: erforderliche Icongrößen gehören deshalb auch in `account-ui.css`.

## 5. Neuanmeldung, Klassencode und Bestätigung

1. Nicht angemeldete Person wählt Neuanmeldung und gibt einen Code aus fünf Großbuchstaben ein. Codes sind zufällig, nicht Schul- oder Rollenberechtigungen.
2. Fünf Fehlversuche in derselben serverseitigen Sitzung sperren für 300 Sekunden. Zusätzlich wirken IP-/Gesamtbegrenzungen für Schul-NAT. Abbrechen oder Dialogneustart setzt die Sperre nicht zurück. Cookieverlust erzeugt zwar eine neue Sitzung, beseitigt aber nicht die IP-Bremse.
3. Erfolgreiche Prüfung liefert Klassenname und einen serverseitigen Grant für zehn Minuten. Beim eigentlichen Registrieren werden Code und Klasse erneut unter Sperre geprüft.
4. Name, E-Mail, Passwort und Wiederholung eingeben. Die Registrierungsoberfläche prüft Übereinstimmung; das API-Registrierungsobjekt enthält derzeit nur `name,email,password`. Passwortformat wird serverseitig geprüft. Reset und neue Lehrereinladung prüfen die Wiederholung zusätzlich serverseitig.
5. Standardkapazität 32 Schülerplätze. Bestehende Schüler plus nicht abgelaufene Registrierungsreservierungen zählen, Lehrkräfte nicht. Sitzvergabe und Prüfung dürfen nicht ohne Klassensperre getrennt werden.
6. Bei **exakter E-Mail-Domain-Gleichheit mit dem aktuellen Klasseninhaber** wird das Konto sofort aktiv, aber die Adresse bleibt unbestätigt. Es wird keine Bestätigungsmail benötigt. Das ist eine bewusst gewählte Unterrichtserleichterung, **kein Nachweis der Adressinhaberschaft**.
7. Andere Domains erzeugen eine reservierte Anmeldung für 48 Stunden und einen Mailjob. Erst explizite Bestätigung aktiviert das Konto. Bereits existierende E-Mails werden nicht überschrieben; generische Antworten verhindern Kontoauskunft.

**Zwei Domainregeln nicht verwechseln:** Die Anmeldeausnahme verwendet die aktuelle E-Mail-Domain des Inhabers. Namenseindeutigkeit verwendet dagegen die dauerhaft gespeicherte ursprüngliche Schul-Domain (Abschnitt 8). Besitzer-/Adresswechsel ändern diese beiden Größen daher unterschiedlich.

Ein Klassenbeitrittscode gilt zehn Tage. Nach Ablauf zeigt die Lehreransicht „generieren“ statt eines alten Codes. Ein wiederholter Erneuerungsrequest während eines gültigen Codes erzeugt nicht ständig neue Codes. `CTEST` ist **kein eingebauter Sonderzugang**; alte Testklassen/Codes dürfen nicht durch Migration wiederhergestellt werden.

Bestätigungslinks enthalten einen zufälligen 256-Bit-Token im URL-Fragment, nicht in Query/Access-Log. Aktivierung erfolgt nur durch explizites POST, nicht durch das Öffnen des Links (Mailscanner!). Der Bestätigungstoken gilt bis höchstens 24 Stunden nach einem Versandversuch, begrenzt durch die 48-Stunden-Reservierung; bei erneutem Versandversuch wird diese Bestätigungsfrist innerhalb der Reservierung neu gesetzt. Natürlicher Codeablauf verhindert nicht die Bestätigung einer zuvor gültig reservierten Anmeldung; ausdrücklicher Widerruf dagegen schon.

Bei fremdem angemeldeten Konto zeigt der Bestätigungsdialog nur den passenden Hinweis mit „Abmelden“ und „Abbrechen“, keine irreführende gleichzeitige Bestätigungsaufforderung. Nach erfolgreicher Aktivierung gibt es keinen stillen Auto-Login.

## 6. Passwort vergessen und Kontoinformation

Resetanforderung liefert für vorhandene, unbekannte, inaktive und pro Adresse begrenzte Konten dieselbe allgemeine Annahmeantwort. Drei Anforderungen je Adresse/15 Minuten und zusätzliche IP-Bremse. Ein noch gültiger angeforderter Link bleibt bei weiteren Klicks derselbe; keine Mailflut und kein gegenseitiges Entwerten.

Ein **aktives, unbestätigtes** Konto kann einen Reset erhalten. Eine noch reservierte Neuanmeldung ohne fertiges Konto dagegen nicht. Resetqueue maximal 24 Stunden; Resetlink eine Stunde ab **erstem** Versandversuch. Anders als bei Registrierungsbestätigung verlängern Wiederholungsversuche diese Stunde nicht. Der Reset ist an den aktuellen Passwort-Hash gebunden und nur einmal nutzbar.

Ein zu kurzes Passwort oder eine abweichende Wiederholung verbraucht den Link nicht: Felder im selben Dialog korrigieren. Erfolgreicher Reset ändert Passwort, widerruft alte Sitzungen und verbraucht den Link atomar. Klasse, Lernstand und Code bleiben erhalten. Anschließend getrennte Benachrichtigung ohne Passwort/Resetlink; kein automatisches Anmelden.

Eigene Kontoinfo zeigt E-Mail, „Klasse:“ und bearbeitbaren Anzeigenamen. Eigene E-Mail-Änderung ist **noch nicht implementiert**. Lehrkräfte können Schüleradressen innerhalb ihrer Klasse, Superadmins über die globale Liste bearbeiten. Das ist nicht dasselbe wie eine Selbstbedienungs-Adressänderung.

Adressänderung prüft Eindeutigkeit gegen Konten und offene Registrierungen sowie `previousEmail` gegen veraltete Dialoge. Sie setzt die Bestätigung zurück, widerruft Sitzungen und alte Resetjobs/-links; Lernstand und Konto-ID bleiben. Admin-Adressänderung verwirft zusätzlich Lehrereinladungen für alte/neue Adresse. Reine Namensänderung löst keinen Konto-/Lernstandswechsel aus. Unterrichtsgruppen und feste Namens-Domain werden nicht automatisch geändert.

## 7. Mails, SMTP und Warteschlange

Alle Konto-Mails teilen Budget, Sperre und Worker: Registrierung, Reset, Resetbenachrichtigung und Lehrereinladung. Persönliche Anrede „Hallo NAME“; bei einer neuen Lehrereinladung ohne bestehendes Profil steht noch kein gewählter Name zur Verfügung (Fallback „Lehrkraft“). Schülertransfer erzeugt derzeit **keine Mail**, sondern eine Anfrage in „Meine Klassen“.

Der private Cron-Dispatcher `server/bin/mail-worker.php` folgt dem aktiven Release. Die Queue verwendet eine 300-Sekunden-Lease, Wiederaufnahme abgelaufener Leases und begrenztes exponentielles Backoff. Versandversuche werden **vor** dem Transport im gemeinsamen rollierenden Minuten-/24-Stunden-Budget gezählt. Ein Absturz kann deshalb Budget verbrauchen, ohne dass eine Mail zugestellt wurde. Ein Absturz nach Transportannahme kann selten einen erneuten Versand desselben Links bewirken: Mailtransport ist „mindestens einmal“, Tokenverbrauch dagegen einmalig.

Konservative Vorgabe: zehn Konto-Mails pro Minute und 100 pro 24 Stunden. Diese Zahlen sind die aktuelle Konfiguration, **keine allgemeingültige Aussage zu jedem Hostinger-Tarif**. `sendmail` ist im Code zusätzlich auf diese Obergrenze begrenzt; authentifiziertes SMTP kann nach Tarifprüfung anders konfiguriert werden. Ein externer Dienst kann den Engpass ändern, benötigt aber weiterhin kontrollierte Queue und Missbrauchsschutz.

Der Marker **`MAIL-TRANSPORT-LIMIT`** verbindet Konfiguration, Queue, UI-Hinweis und Tests. Bei Tarif-/Transportwechsel alle Fundstellen prüfen; nicht nur den Text ändern und nicht pauschal alle Limits oder Warteschlangen entfernen. Registrierung und Recovery sind unabhängig per privatem Flag deaktivierbar; ausgeschaltete Recovery darf die Prüfung bereits vorhandener Sitzungsepochen nicht deaktivieren.

SMTP nutzt den fest eingebundenen PHPMailer-Subset, TLS mit Zertifikatsprüfung (465/SSL oder 587/STARTTLS), authentifizierten Nutzer und passenden From/Envelope-Absender. Passwortdatei, DB-Zugang und Schlüssel liegen neben der privaten Konfiguration, nicht im öffentlichen Verzeichnis oder Repository. Grüne DNS-Einträge bzw. erfolgreiche Transportannahme sind noch kein Zustellnachweis: tatsächlichen Eingang und Absenderwarnungen getrennt prüfen. Keine persönlichen Passwortresets als Versandtest missbrauchen.

## 8. Lehrkräfte, Klassennamen und Klassenbesitz

### 8.1 Rollen und Grenzen

Die Gruppe heißt **Lehrer:innen**. Die tatsächliche Lehrberechtigung kommt aus `teachers`, Superadmin aus `superadmins`. Eine zusätzliche Mitgliedschaft in der Lehrergruppe allein genügt nicht. Bestehende Schülerkonten können zugleich Lehrkraft sein und ihre bisherigen Schülergruppen behalten.

Aktuell ausdrücklich provisionierter Superadmin: `michael@cybershoes.com`. Diese Adresse ist **kein automatischer Login-/Rollenbypass** und Migrationen vergeben die Rolle nicht anhand eines Textvergleichs. Kein zusätzliches Admin-Konto ohne ausdrückliche Freigabe erzeugen.

| Aktion | Schüler:in | Zusätzliche Lehrkraft einer Klasse | Klasseninhaber | Superadmin |
| --- | --- | --- | --- | --- |
| Eigener Lernstand / eigener Anzeigename | Ja | Ja | Ja | Ja |
| Schülerliste/Fortschritt einer Klasse | Nein | Eigene geteilte | Eigene | Nicht pauschal alle Klassen; über Inhaber-/Co-Zuordnung |
| Schülernamen/-E-Mail bearbeiten, E-Mail bestätigen | Nein | In geteilter Klasse | In eigener Klasse | Zusätzlich global Name/E-Mail über Kontenliste |
| Mitglieder aus einer Klasse entfernen | Nein | Nein | Ja, mit Erhalt weiterer Zugehörigkeiten | Als Inhaber; alternativ bewusste globale Kontolöschung |
| Klasse löschen / Code generieren | Nein | Nein | Ja | Als Inhaber |
| Co-Lehrkraft hinzufügen/entfernen | Nein | Nein | Ja | Als Inhaber |
| Gemeinsame Klasse verlassen | Nicht diese Funktion | Ja | Erst Besitz übertragen | Als Co-Lehrkraft |
| Klassenbesitz übertragen | Nein | Nein | An bereits hinzugefügte Lehrkraft | Als Inhaber; automatische Übernahme beim Rollenentzug separat |
| Schülertransfer anfordern/sofort zuordnen | Nein | Nein | Quellinhaber | Als Quellinhaber |
| Fremden Schülertransfer annehmen/ablehnen | Nein | Nein | Zielinhaber | Als Zielinhaber |
| Lehrrolle vergeben/entziehen, Limits verwalten | Nein | Nein | Nein | Ja |
| Globale Kontenliste bearbeiten/löschen | Nein | Nein | Nein | Ja, geschützte Adminausnahmen |

Kein Lehrer bearbeitet ein anderes Lehrerkonto über die Schüleraktionen. Eine zum Lehrer beförderte Person kann aus ihrer früheren Schülerklasse entfernt werden, ohne ihr Konto oder ihre Rolle zu löschen.

### 8.2 Klassenlimit, Namen und Code

Standardlimit zehn **eigene** Klassen, administrativ 1–100. Geteilte Klassen zählen nicht. Ein Limit kann nicht unter die schon selbst besessene Zahl gesetzt werden. Die automatische Übernahme nach Rollenentzug ist ausdrücklich vom Limit ausgenommen; danach kann der Admin oberhalb seines Limits liegen, aber nicht noch eine normale neue Klasse erstellen.

Klassenname eindeutig innerhalb der **ursprünglichen Schul-Domain**, nicht nur je Lehrer. Die Domain wird bei Anlage aus der E-Mail des Inhabers abgeleitet und in `class_namespaces` festgehalten. Sie bleibt bei Besitzer-/Schulwechsel und E-Mail-Änderung erhalten. Andere Schulen dürfen denselben Namen verwenden; nach wirklicher Klassenlöschung ist der Name innerhalb der ursprünglichen Domain wieder frei.

`classNameKey()` trimmt, fasst Unicode-Leerraum zusammen, vereinheitlicht ASCII-Groß-/Kleinschreibung sowie Ä/Ö/Ü/ẞ und bildet SHA256. Das ist **keine vollständige Unicode-Normalisierung/Casefolding-Lösung**. Diese Regel nicht ohne Migration bestehender Schlüssel austauschen. Die DB-Unique-Regel verhindert auch gleichzeitige Doppelanlage.

### 8.3 Co-Teaching und Besitzerwechsel

Klasseninhaber sehen Vorschläge bereits aktivierter Lehrkräfte derselben aktuellen E-Mail-Domain. Eine andere Schule lässt sich über exakte E-Mail hinzufügen, **aber nur bei schon existierender Lehrrolle**. Dadurch werden keine neuen Lehrerrollen vergeben. Keine zusätzliche Annahme erforderlich, wenn eine bereits freigeschaltete Lehrkraft zur Klasse hinzugefügt wird.

Lehrkraftnamen sind unterstrichen, Klick/Tippen zeigt die E-Mail. Das X am Co-Lehrer entfernt nur diese Unterrichtszuordnung; das X in der Superadmin-Lehrerliste ist dagegen ein Rollenentzug mit eigenem Warndialog. Nicht dieselbe Mutation verwenden.

Normale Besitzübertragung: Ziel muss schon Co-Lehrkraft sein und einen freien Platz im eigenen Klassenlimit haben. Klassen-ID, Code, Schüler, Fortschritt und ursprüngliche Schul-Domain bleiben. Bisheriger Inhaber wird Co-Lehrkraft, neuer Inhaber verliert seinen redundanten Co-Eintrag. Ein Inhaber darf nicht direkt „Klasse verlassen“, solange niemand den Besitz übernimmt. Offene Schülertransferanfragen an/von dieser Klasse werden beim Besitzerwechsel verworfen, damit eine frühere Zustimmungsbeziehung nicht still auf neue Personen übergeht.

## 9. Schülerübertragung – seit r15 auf Hostinger

Einstieg: Inhaber öffnet Klasse, in der Schülerzeile das Pfeilsymbol „einer anderen Klasse zuordnen“. Keine Aktionen für offene Neuanmeldungen oder Lehrerkonten. Modus und Ziel sind ausdrücklich zu wählen:

| Modus | Quelle nach Erfolg | Ziel nach Erfolg | Sonstiges |
| --- | --- | --- | --- |
| Verschieben | Mitgliedschaft entfällt | Mitgliedschaft besteht | Falls Quelle primäre Klasse war, wird Ziel die primäre Klasse. |
| Zusätzlich zuordnen | Mitgliedschaft bleibt | Mitgliedschaft besteht | Primäre Klasse bleibt unverändert. |

Konto-ID, E-Mail/Bestätigung, Passwort, Aktivstatus, Lernstand, Programmcode und sonstige Mitgliedschaften bleiben unverändert. Ein Transfer ist **kein Aktivierungs- oder Bestätigungsweg**; ein inaktives bestehendes Konto bleibt inaktiv. Eine weitere Mitgliedschaft kostet nicht nochmals einen Sitz, wenn das Konto schon im Ziel ist.

### 9.1 Eigene Zielklasse

Nur eigene andere Klassen werden als Direktziele angeboten. Die Mutation wird sofort nach Bestätigung ausgeführt, sofern Kapazität frei ist. Zielzugehörigkeit zuerst herstellen, dann gegebenenfalls Quelle entfernen, alles in einer Transaktion. Quell- und Zielinhaber/Klassen werden in stabiler Reihenfolge gesperrt, die Schülerzeile ebenfalls; Rechte und Mitgliedschaft werden unter Sperre erneut geprüft.

### 9.2 Ziel mit anderem Inhaber

Ein gültiger, noch nicht abgelaufener Beitrittscode identifiziert die Zielklasse. Eine fremde Klassen-ID allein genügt nicht. Der Code erlaubt **nur die Anfrage**, niemals eine automatische Eintragung. Der Zielinhaber muss in „Meine Klassen → Schülerübertragungen“ annehmen oder ablehnen; der Quellinhaber kann zurückziehen. Co-Lehrer und unbeteiligte Lehrer dürfen nicht entscheiden oder die Anfrage sehen. Die Anfrage zeigt den beteiligten Inhabern Name/E-Mail und Quelle/Ziel, aber keine Lösungen oder Zugangsdaten.

Anfragen gelten zehn Tage ab Erstellung, reservieren keinen Sitz und ändern bis zur Annahme nichts. Ein natürlicher Ablauf des ursprünglich zur Anfrage verwendeten Codes beendet eine schon erstellte Anfrage nicht vorzeitig; ihre eigene Frist und ausdrückliche Annahme gelten. Eine identische Wiederholung nutzt dieselbe Anfrage ohne Fristverlängerung; abweichender Modus zur selben Person/Quelle/Ziel verlangt erst Zurückziehen. Es gibt keine automatische Mailbenachrichtigung.

Bei Annahme werden aktuelle Inhaber, Quellmitgliedschaft, Nicht-Lehrkraftstatus und Zielkapazität erneut geprüft. Offene Registrierungen zählen als reservierte Plätze. Ein zwischenzeitlich volles Ziel liefert `CLASS_FULL`: weder Quelle noch Konto ändern sich, die Anfrage bleibt bis Ablauf/Abbruch bestehen. Ist der Schüler bereits im Ziel, ist kein zusätzlicher Platz nötig; „Verschieben“ kann dann die Quelle trotzdem entfernen.

Annahme verbraucht genau diese Anfrage atomar. Ein doppelter Annahmeklick nach Erfolg findet sie nicht mehr. Ein erfolgreicher Move entfernt weitere offene Anfragen dieses Kontos aus derselben Quelle. Mitgliedschaftsentfernung, Klassenbesitzerwechsel, Klassen-/Kontolöschung oder Entzug der anfragenden Lehrrolle invalidieren bzw. löschen betroffene Anfragen. Wird die Person zwischenzeitlich zur Lehrkraft, kann die alte Schüleranfrage nicht mehr angenommen werden; sie lässt sich zurückziehen/ablehnen oder läuft ab.

**Wiederholungsgrenze:** Im Gegensatz zu Lernstandsschreibvorgängen haben Verwaltungsaktionen keine universelle `operationId`-Quittung. Nach einer verloren gegangenen Antwort Zustand neu laden. Ein erfolgreiches sofortiges Verschieben kann beim Wiederholen `MEMBER_NOT_FOUND` liefern, weil die Quelle schon entfernt wurde; es darf keine zweite Kontokopie angelegt werden. „Zusätzlich zuordnen“ ist bezüglich Mitgliedschaft sicher wiederholbar.

## 10. Superadmin, Einladungen und Rollenentzug

„Verwaltete Lehrer:innen“ steht oberhalb „Meine Klassen“. Einladung enthält E-Mail und Klassenlimit (Vorgabe zehn), gilt zehn Tage ab Erstellung und erfordert Annahme über den E-Mail-Link. Erst dann wird die Lehrrolle vergeben. Bestehende Konten behalten Passwort, Lernstand und Schülergruppen; `Lehrer:innen` wird ergänzt. Neue Konten wählen Name und Passwort mit Wiederholung. Annahme bestätigt die eingeladenen Adresse und widerruft vorherige Sitzungen. Kein stiller Rollenaufstieg durch bloßes Hinzufügen zur Klasse.

Eine noch gültige offene Einladung an dieselbe Adresse wird bei erneutem Anfordern wiederverwendet, nicht still mit neuem Limit oder neuer Frist ersetzt. Bereits aktive Lehrkräfte erhalten keine erneute Beförderung; ihr Limit wird über die eigene Limitaktion geändert. Ein inaktives vorhandenes Konto kann die Einladung nicht zur Reaktivierung verwenden. Eine offene Schülerregistrierung derselben Adresse verhindert die Anlage eines neuen Lehrerkontos; den Konflikt erst auflösen, nicht überschreiben. Das Erstellen einer Lehrereinladung setzt derzeit das Registrierungsflag voraus; bereits ausgegebene Links haben eine eigene Annahmeprüfung und werden nicht allein durch Abschalten dieses Flags widerrufen.

Beim Entzug gibt es die **nicht vorausgewählte** Option, auch das Konto zu löschen:

- **Konto behalten:** Alle eigenen Klassen gehen an den ausführenden Superadmin, auch über dessen Limit hinaus. Alle Co-Lehrzuordnungen und die Lehrerrolle entfallen. Andere Schülergruppen und Lernstand bleiben. Die Lehrergruppenmitgliedschaft wird entfernt. Ohne verbleibende Gruppe dient `Ohne Klasse` als neutraler Bestand ohne Verwaltungsrechte. Alte Sitzungen werden widerrufen, danach ist Schülerlogin weiter möglich.
- **Konto löschen:** Dieselbe sichere Klassenübernahme; anschließend Konto und dessen eigene Lerndaten löschen. Die übernommenen Klassen und fremden Schülerkonten bleiben bestehen.

Superadmin selbst ist vor Rollenentzug und globaler/Selbstlöschung geschützt. Seine Loginadresse wird auch nicht über die globale Kontenbearbeitung verändert; den eigenen Anzeigenamen kann er normal bearbeiten. Derzeit ist kein allgemeiner Mehr-Superadmin-/Recovery-Workflow implementiert.

Die aufklappbare Liste „Alle Konten und Klassenzugehörigkeiten“ enthält reale Konten, nicht bloß vorgemerkte Anmeldungen. Suche nach Name/E-Mail; Anzeige von Schüler-/Gruppenzugehörigkeiten **und getrennt** eigenen/geteilten Unterrichtsklassen. Bearbeiten ändert Name/E-Mail, nicht beliebige Mitgliedschaften. Globales Löschen ist bewusst stärker als Entfernen aus einer Klasse und darf nicht als harmloses Papierkorb-Kürzel ohne Warnung umgesetzt werden.

## 11. Löschmatrix und Sonderfälle

| Aktion | Voraussetzung / Bestätigung | Was bleibt? |
| --- | --- | --- |
| Ganze Klasse löschen | Inhaber, beide Pflichtcheckboxen, exakt `LÖSCHEN`; serverseitig erneut prüfen. | Konten mit anderen Mitgliedschaften/Lehrergruppe einschließlich Lernstand/Code; nur Zugehörigkeit zur gelöschten Klasse entfällt. |
| Exklusives Schülerkonto beim Klassenlöschen | Keine weitere Zugehörigkeit, kein geschütztes Lehrerkonto. | Konto und Lerndaten werden gelöscht; keine versteckte Übernahme in eine zufällige andere Klasse. |
| Einzelnen Schüler entfernen | Inhaber, Warnung ohne Tippen von `LÖSCHEN`. | Bei anderer Zugehörigkeit bleibt Konto vollständig; sonst echte Kontolöschung. |
| Offene Anmeldung entfernen | Inhaber, exakt diese Vormerkung in dieser Klasse. | Andere Anmeldungen/Konten bleiben; zugehörige Mailjobs entfallen. |
| Co-Lehrkraft X / selbst Klasse verlassen | Inhaber entfernt Co bzw. Co verlässt selbst. | Konto, Lehrrolle, eigene Klassen, Schülerzugehörigkeiten und Lernstand bleiben. |
| Lehrrolle entziehen | Superadmin, eigene Rolle geschützt; optionale Kontolöschung. | Alle betroffenen Klassen bleiben unter Adminbesitz; bei „behalten“ Schülerzugang erhalten. |
| Globale Admin-Kontolöschung | Superadmin, ausdrückliche Bestätigung, Adminziel geschützt. | Bei Lehrkraft werden eigene Klassen zuerst übernommen; andere Nutzer bleiben. |
| Eigene Kontolöschung | Angemeldet, aktuelles Passwort, ausdrückliche Bestätigung; keine eigenen Klassen, kein Superadmin. | Klassen anderer Inhaber bleiben; eigenes Konto, alle eigenen Mitgliedschaften und eigener Lernstand entfallen. |

Klassenlöschdialog: Warnung prägnant, destruktive Folgen rot; konkret aufgelistete Personen mit weiteren Klassen/E-Mail und Kontoerhalt grün, nur wenn solche Fälle vorhanden sind. Die Vorschau ist keine Autorisierung: tatsächliche Mitgliedschaften innerhalb der Löschtransaktion erneut auswerten. Vor Entfernen einer primären Klasse die primäre Referenz auf eine verbleibende Klasse umstellen, damit Foreign Keys nicht versehentlich ein zu erhaltendes Konto verhindern/löschen.

Klasse löschen entfernt Code, offene Anmeldungen/Mailjobs und betroffene Transferanfragen. Bestehender Benutzerstand darf nicht dadurch verloren gehen, dass dieselbe Person außerdem Lehrkraft oder in einer anderen Klasse ist. Eine Lehrkraft ohne eigene Klassen darf sich selbst löschen, auch wenn sie noch Co-Lehrkraft ist; dabei entfallen ihre Co-Zuordnungen. Ein Inhaber muss zuerst übertragen/löschen, nicht die Schutzprüfung im Frontend umgehen.

## 12. Fortschritt, Anzeige und Unterrichtshilfen

Eine einzige Berechnung in `course-progress.js` versorgt Konto- und Lehreransicht. Prozentwerte werden nicht als zweite Wahrheit in der DB gespeichert. Ein Eintrag mit String-Lösung in `completedCodes` zählt; kein Fortschritt nur durch Besuch, Versuch oder Unlock. Bestehende stabile Level-IDs bleiben auch bei späterer Umbenennung von PICO erhalten oder benötigen eine explizite Datenmigration.

| Abschnitt | Pflichtpunkte | Levelgewichte |
| --- | --- | --- |
| Missionen 1, 3, 4 | Je 15 | Je 5 / 5 / 5 |
| Mission 2 | 15 | 7,5 / 7,5; optional 02-3 zusätzlich 5 Bonus |
| Agententraining | 10 | 3 / 3 / 4 |
| Ein Projekt | 15 | Museum 5 / 10; PICO 3,75 je vier Hauptlevels |
| Helikopterflucht | 15 geplant | 4 / 4 / 4 / 3; H-3 und H-4 noch nicht vorhanden |
| Zweites Projekt | Bis 20 Bonus | Anteilig nach erledigten Levelgewichten des zweiten Projekts |

Mangels Chronologie füllt das weiter abgeschlossene Projekt den Pflichtslot, bei Gleichstand Pixelmuseum. Das andere zählt anteilig zum Bonus, auch wenn ursprünglich der andere Pfad ausgewählt wurde. PICO 2a ist kein Pflicht-/Prozentlevel. Aktuell maximal 93 Pflichtpunkte; sieben Punkte sind für H-3/H-4 reserviert und werden nicht vorzeitig geschenkt. Mit vollständigem Kurs später maximal 125 inklusive beider Boni. Bis 100 Pflichtpunkten zeigt das UI Grundwert plus Bonus getrennt; Bonus ersetzt keine Pflichtaufgabe.

Offene freigeschaltete Levels: rot, Link, „offen“. Gesperrte: rot, kein Link, Stern statt zusätzlichem „gesperrt“. Optional offen/gesperrt gedämpft orange-rot; erledigt optional blaugrün mit Stern/Häkchen/Link, sonst erledigt grün/Häkchen/Link. Die Legende erläutert Sterne für optional oder gesperrt. Lehreransicht hat dieselbe kapitelweise Struktur/Farben, ist aber **nur lesend** und springt nicht in den fremden Kontolernstand. Die Notentabelle enthält unverbindliche Unterrichtsvorschläge, keine automatische Leistungsentscheidung.

Angemeldete Lehrkräfte haben Musterlösungen automatisch. Angemeldete Schüler können den Gast-Vorführmodus nicht aktivieren. Ein aktivierter Gastmodus bleibt in der Tab-Sitzung bei Navigation erhalten. Alte lokale Lehrerflags sind keine Kontoberechtigung.

Fachliche Fortschrittsregeln nicht beim Kontoumbau entfernen: 02-3 verlangt auch einen getesteten falschen Kabelschnitt mit KABUMM; AG-3 gibt Projektwahl erst nach kompletter technischer Abnahme frei. Bei H-1/H-2 verschwinden Erfolgsüberlagerungen, Rücksetzen stellt sie wieder her; H-1 scrollt nach Erfolg nicht automatisch hoch. Die aktuelle H-1-Passphrase ist Teil der Aufgabenlogik, nicht ein echtes Zugangsgeheimnis.

## 13. API-Vertrag für Änderungen

Alle Endpoints laufen über `api/index.php?action=…`. Mutationen sind POST, mit exakt erlaubten Feldern, Origin/CSRF und den nachstehenden Rollenprüfungen. Ein nicht sichtbarer fremder Datensatz wird häufig absichtlich als 404 behandelt.

| Aktionen | Wesentliche Daten / Schutz |
| --- | --- |
| GET `session`, `state` | Öffentliche Sessionpolicy bzw. eigener Lernstand; `state` benötigt Profilguard. |
| `login`, `logout`, `write`, `update-profile` | Login `email,password`; write siehe Abschnitt 3; eigenes Profil derzeit nur `name`. |
| `check-invitation`, `register`, `verify-email`, `cancel-registration` | Nicht angemeldet; Registrierung aktiv; serverseitiger Grant/Token. |
| `request-password-reset`, `reset-password` | Recovery aktiv; Tokenverbrauch einmalig, Passwortwiederholung serverseitig. |
| GET `teacher-classes`; `teacher-class` | Lehrrolle; Klassenansicht nur Inhaber/Co. `classId` ist keine Berechtigung. |
| `teacher-create-class`, `teacher-renew-code` | Eigenes Quota/Namespace bzw. Inhaber der Klasse. |
| `teacher-confirm-email`, `teacher-update-member` | Inhaber/Co, tatsächlicher Schüler in Klasse, keine anderen Lehrerkonten; Bestätigung mit aktueller E-Mail, Bearbeitung zusätzlich `previousEmail,name`. |
| `teacher-delete-preview`, `teacher-delete-class`, `teacher-delete-member` | Vorschau nicht bindend; Löschmutationen Inhaber. Klasse: `confirmation,deleteClass,deleteExclusiveAccounts`. Mitglied: `memberId,kind` = `user`/`pending`. |
| `teacher-candidates`, `teacher-add-teacher` | Aktivierte Lehrkräfte, Inhaber entscheidet; exakte E-Mail bei Hinzufügen. |
| `teacher-remove-teacher`, `teacher-leave-class`, `teacher-transfer-class` | `classId`, ggf. `memberId`; Inhaber/Co-Regeln und Zielquota. |
| GET `teacher-transfers`; `teacher-transfer-targets` | Beteiligte Inhaber bzw. eigene Direktziele zu `classId`. |
| `teacher-transfer-student` | `classId,memberId,mode,targetClassId,code`; `mode` nur `move`/`add`; exakt ein nicht leeres Ziel (eigene ID oder gültiger Code). |
| `teacher-decide-transfer` | `requestId,decision`; `accept`/`decline` nur Zielinhaber, `cancel` nur Anfragender. |
| GET `admin-teachers`, `admin-accounts`; `admin-invite-teacher`, `admin-teacher-limit` | Superadmin; Einladungs-/Klassenlimit validieren, keine implizite Rollenannahme. |
| `teacher-invitation-info`, `accept-teacher-invitation` | Tokenbasierte Vorschau/Annahme, beide POST; Vorschau vergibt keine Rolle. |
| `admin-revoke-teacher`, `admin-update-account`, `admin-delete-account` | Superadmin, Zieladmin geschützt; Entzug benötigt boolesches `deleteAccount`, globale Löschung `confirmation:true`. |
| `delete-account` | Eigenes Konto, Passwort und `confirmation:true`, kein Klassenbesitz/Admin. |

Bei neuen Verwaltungsaktionen nicht pauschal den Header `X-Agentpy-Profile` weglassen, Kontodaten aus Request-IDs vertrauen oder Sessionwechsel durch automatisches Wiederanmelden kaschieren. Fehler wie `PROFILE_CHANGED`, `AUTH_REQUIRED`, `CLASS_FULL`, `MEMBER_CHANGED`, `TARGET_CLASS_LIMIT_REACHED` und Transferfehler brauchen verständliche, nicht destruktive UI-Behandlung.

## 14. Tests: welche Regeln wo abgesichert sind

Die folgende Matrix bezeichnet **Testquellen**, nicht automatisch erfolgreiche aktuelle Läufe. Verbindliche Commit-/Laufergebnisse stehen im jüngsten Handoff; spätere Testergänzungen müssen separat ausgeführt werden.

| Regelbereich | Tests / besondere Fälle |
| --- | --- |
| Gastdaten, Adapter, Reset, Quota/Fehler, Tabkonkurrenz | [learning-data-core.test.mjs](tests/learning-data-core.test.mjs), [local-learning-data.test.mjs](tests/local-learning-data.test.mjs), [progress-architecture.test.mjs](tests/progress-architecture.test.mjs), Browser-Speichertests unter `tests/e2e`. |
| Remoteisolation/Retry/Revisionskonflikt | [remote-learning-data.test.mjs](tests/remote-learning-data.test.mjs), [backend-api.test.mjs](tests/backend-api.test.mjs): getrennte Konten, alte Tabs, doppelte Requests, beschädigte Zustände, tatsächliche PHP-API. |
| Login, Logout, Gerätewechsel, Startseite, Shell | [login-save.spec.mjs](tests/login-e2e/login-save.spec.mjs), [shell.spec.mjs](tests/login-e2e/shell.spec.mjs), [polish.spec.mjs](tests/login-e2e/polish.spec.mjs). |
| Code, Cooldown, Kapazität, Registrierung, Mailqueue | [registration-cases.mjs](tests/registration-cases.mjs), [registration.spec.mjs](tests/login-e2e/registration.spec.mjs): falsche/abgelaufene Codes, Konkurrenz um letzten Platz, Dubletten, Mailversuchbudget/Lease, Bestätigung. |
| Reset, zu kurzes Passwort, Einmalverbrauch, Epoch | [recovery-cases.mjs](tests/recovery-cases.mjs), [recovery.spec.mjs](tests/login-e2e/recovery.spec.mjs). |
| Lehrereigene Klassen, Fortschritt, Löschungen | [teacher-cases.mjs](tests/teacher-cases.mjs), [teacher.spec.mjs](tests/login-e2e/teacher.spec.mjs). |
| Gleiche Domain aktiv/unbestätigt, Lehrer bestätigt/korrigiert, doppelte Mitgliedschaft, Erhalt beim Löschen | [teacher-membership-cases.mjs](tests/teacher-membership-cases.mjs), [membership.spec.mjs](tests/login-e2e/membership.spec.mjs): E-Mail-Änderung meldet Schüler ab, Lösung bleibt; geschützte Konten grün im Dialog. |
| Lehrereinladung neu/bestehend, zehn Tage, Co-Rechte, Adminschutz | [roles-cases.mjs](tests/roles-cases.mjs), [admin.spec.mjs](tests/login-e2e/admin.spec.mjs); Schema-7-Migration ohne automatische Rollenvergabe. |
| Schema 8, Domainnamen, Quota, Klassenübertragung, Rollenentzug, Selbst-/Adminlöschung | [management-cases.mjs](tests/management-cases.mjs): befüllte Migration/idempotent, Namenskonkurrenz, gleiche Namen aus zwei Domains bei einem Admin, Datenbestand erhalten, Admin geschützt. [management.spec.mjs](tests/login-e2e/management.spec.mjs): kleine Icons, E-Mail-Aufklappen, übertragen/verlassen, Kontenliste, Adresswiderruf, Rollenentzug, Selbstlöschung. |
| **Schema 9 / Schülertransfer** | [transfer-cases.mjs](tests/transfer-cases.mjs): additive Migration, Move/Add, primäre/weitere Gruppen, unveränderte Zugangsdaten/Lernstand, Eigentümer-/CSRF-/Codeprüfungen, Lehrer nicht als Schüler verschieben, zustimmungspflichtige Fremdklasse, Zehn-Tage-Frist/Retry, Ablehnung/Abbruch/Ablauf, reservierte Plätze, bereits vorhandene Zielmitgliedschaft, Eigentümerwechsel/Mitgliedsentfernung, zwei Worker/ein Sitz. Ergänzt: Quell-/Zielklassenlöschung mit geschütztem Mehrklassenkonto, Kontolöschung/Request-Cascade, Entzug beider Inhaberrollen und zwischenzeitliche Lehrerbeförderung. |
| **Transfer-UI** | [transfers.spec.mjs](tests/login-e2e/transfers.spec.mjs): eigene Klasse direkt, fremde Klasse mit Anfrage/Annahme, unveränderter Schülerzugang/Fortschritt, zusätzliche Zugehörigkeit, Dialogscreenshots; je Chromium/WebKit. |
| Prozent, Bonus, freie Links, gesperrt/optional | [course-progress.test.mjs](tests/course-progress.test.mjs), dazu Lehrer-/Kontobrowsertests. |
| Unterrichtsmodus | [teacher-mode.spec.mjs](tests/login-e2e/teacher-mode.spec.mjs): Gastsession über Levelwechsel, Schüler nicht berechtigt, Lehrkraft automatisch. |
| Missionsregeln und Heli | Core-Tests in [all.test.mjs](tests/all.test.mjs) sowie `tests/e2e`; u. a. komplette Abnahme, Kabeltests, Heli-Erfolg/Reset/Scrollposition. |
| Release, keine Secrets/privaten Dateien im Web, stabiler Worker | [hostinger-release.test.mjs](tests/hostinger-release.test.mjs), [hostinger-setup.test.mjs](tests/hostinger-setup.test.mjs), [static-release.test.mjs](tests/static-release.test.mjs). |
| Dokumentationszugang | [account-documentation.test.mjs](tests/account-documentation.test.mjs): Systemlink am README-Ende, existierende lokale Dokumentationslinks und Transfer-Testverweise. Kein automatischer Beweis inhaltlicher Vollständigkeit. |

### Ausführung

Node.js mit festgeschriebenen npm-Abhängigkeiten, Playwright-Browsern und für Kontotests PHP-CLI samt PDO-SQLite, PDO-MySQL und OpenSSL verwenden. Die tatsächlichen Befehle stehen in [package.json](package.json):

```text
npm ci
npm test
npm run test:backend
npm run test:login
npm run test:hosting
npm run test:e2e
```

`test:backend` startet echte lokale PHP-API-Prozesse und testet SQLite; mit den vorgesehenen `AGENTPY_TEST_MYSQL_*`-Variablen zusätzlich MariaDB. Datenbankname muss auf `_test` enden. CI verwendet eine isolierte MariaDB-Serviceinstanz. `tests/backend-fixture.php` ist CLI-/Development-begrenzt; Fixture-Token, Testpasswörter und synthetische Daten dürfen niemals durch Produktivwerte ersetzt werden. Browserkonfiguration [playwright.login.config.mjs](playwright.login.config.mjs) führt Chromium und WebKit aus; das ersetzt nicht jeden physischen iPad-/Mailclienttest.

### Aktueller Nachweis und zusätzliche Release-/Härtungsprüfungen

- **CI 36194686016 success** für `d00c8da65369f9405afd6ee150fccc6262f630de`: alle Jobs einschließlich erweiterter Transferfälle auf SQLite/MariaDB und 68/68 Konto-Browserfälle. Die zwei Fehler des alten Laufs 36152307210 betrafen einen inzwischen korrigierten Testselektor, nicht einen nachgewiesenen Fehler der Zielklassenauswahl.
- Lokaler Transfer-Nachlauf in Chromium und WebKit **2/2**, Screenshots der Zuordnung/Annahme auf Desktop-/Tabletbreite visuell kontrolliert. Lokaler Backendnachlauf **64/64**, einschließlich Rollenentzug, Klassen-/Kontolöschung, Request-Cascade und zwischenzeitlich erteilter Lehrerrolle. Dies ist weiterhin kein Produktionsnachweis.
- Hostinger r15: alle 25 ursprünglichen Tabellen privat auf demselben Server nach SQLite kopiert, Datenvergleich/Fremdschlüssel geprüft und eine zweite Kopie zweimal 7→8→9 migriert. Der MariaDB-Migrationspfad wurde separat in CI geprüft; die anschließende echte Live-Migration erhielt alle 24 bisherigen Datentabellen hashgleich. SQL-Restore ist **nicht** getestet. HTTPS-/Session-/Privatpfadchecks, anonyme Chromium-/WebKit-Smokes und reine Live-Leseabfragen für alle vier Lehrkräfte, Klassendetails, Transferanfragen und Superadminlisten erfolgreich; kein neuer angemeldeter/destruktiver End-to-End-Test auf echten Konten.
- Zusätzliche Härtungsfälle: wartende alte Schülerseite nach Transfer, angenommene echte Lehrereinladung während offener Schüleranfrage, genutzter/erneuerter Code und vorhandene Anfrage. Bestehende Foreign Keys/Transaktionen ersetzen gezielte Tests nicht.
- API-/Dialogfehler unter langsamem Netz, mehrfachen Klicks und verlorener Antwort prüfen. Keine Produktionskonten dafür löschen/verschieben.

## 15. Migration, Veröffentlichung und sichere Wartung

### Bewusst nicht als vorhandene Funktion behandeln

Frühere Gesprächsideen sind nicht automatisch implementiert: derzeit kein CSV-Export mit wählbarem Trennzeichen, keine freie Kapazitätsänderung durch den Klasseninhaber, kein Klassen-Umbenennungsdialog, keine eigene E-Mail-Änderung und kein direktes Setzen fremder Schülerpasswörter durch Lehrkräfte. „Passwort vergessen“ ist der vorhandene E-Mail-Weg. Ebenso gibt es keine automatische Mail für Schülertransfer, keine generelle klassenunabhängige Superadmin-Lernstandansicht und keinen Self-Service für zusätzliche Superadmins. Solche Erweiterungen benötigen eigene Regeln und Tests.

Schemafolge: 2 Konto/primäre Klasse/Lernstand; 3 Registrierung/Mail; 4 Reset/Epoch; 5 Lehrerklassen; 6 Mehrfachmitgliedschaft/Bestätigung; 7 Superadmin/Co-Teaching/Lehrereinladung; 8 feste Schul-Domain/Management; 9 Transferanfragen. Einstieg ist private CLI `manage.php migrate`, nicht ein öffentliches API-Setup.

Schema 8 prüft vorhandene Domain-/Namenskonflikte vorab und bricht bei Konflikten ab. Der alte Unique-Index auf Besitzer/Name wird entfernt, weil ein Admin gleich benannte Klassen verschiedener Schulen übernehmen können muss. SQLite verwendet einen geprüften Tabellenneuaufbau mit Foreign-Key-Prüfung; MariaDB DDL ist nicht vollständig transaktional. Deshalb vor Migration vollständige private Sicherung, Migrationsplan und Bestandshashes. Schema 9 ist additiv; es darf keine Konten erzeugen, Daten verschieben oder Rollen vergeben.

Hostinger-Paket enthält statische öffentliche Dateien/API-Einstieg und getrennten privaten PHP-Code. Neue `src/*.php` und Schema-Dateien ausdrücklich in Builder-Allowlist **und** Pakettest-Fixture aufnehmen. Beispielkonfigurationen nur mit Platzhaltern. Livekonfiguration, SMTP-Passwort, DB-Passwort und Code-Schlüssel nicht durch Release-Dateien ersetzen. Nach Upload Manifest/Checksummen prüfen; Aktivierung, Healthcheck und Releasebestätigung sind getrennte Schritte.

Branch `dev-login-save`: Anwendungstests ohne Pages-Deployment. `main`: getestetes statisches Pages-Deployment. Hostinger ist ein davon getrennter, ausdrücklich kontrollierter Releaseweg. Ein Git-Push veröffentlicht nicht automatisch das Kontobackend auf Hostinger.

Vor Veröffentlichung: vollständige Tests, frische Bestandsinspektion, private SQL-Sicherung, Wartungs-/Rollbackplan, vollständiges Paket, Migration und erneuter Bestandserhaltvergleich. Erst dann aktivieren, HTTPS-/Session-/Privatpfad-/Worker-Smokes, bestätigtes Deployment und aktualisierten Handoff. Ein alter Releasehelper darf nicht nur wegen ähnlichem Namen ausgeführt werden. Der lokale Operator `.cache/hostinger-r15.mjs` ist auf Schema 9 angepasst und für dieses Release bereits vollständig ausgeführt: **Upload, Migration, Aktivierung und Bestätigung nicht wiederholen**. Eine neue Veröffentlichung benötigt einen neuen geprüften Ablauf mit frischer Sicherung.

Rollback ist kein blindes Datenbank-Downgrade. Nach Passwortreset keine Authversion ohne Epochprüfung einsetzen; nach neuen Rollen-/Namensregeln keine alten Verwaltungsaktionen freigeben, die diese umgehen. Registrierung/Recovery oder Verwaltungszugriff nötigenfalls gezielt abschalten, aktuellen Authschutz behalten und kompatiblen Code-Fix ausliefern. Kein Zurückspielen alter SQL-Daten ohne ausdrücklichen Wiederherstellungsplan, weil dadurch neuere Lernstände verloren gehen können.

### Checkliste für eine spätere KI / neue Sitzung

1. Diesen Regelvertrag, jüngsten [LOGIN-HANDOFF.md](LOGIN-HANDOFF.md)-Abschnitt, relevante Implementierung und Tests lesen. Entwicklungs- und Livestand separat feststellen.
2. Auftrag auf betroffene Daten, Rollen, Sitzungen, Mails, Klassenkapazität und Löschfolgen abbilden. Fehlende Entscheidungen vor destruktiven Änderungen klären.
3. Bestehende Änderungen erhalten. Nur bekannte explizite Dateien stagen; niemals pauschal private Konfigurationen/Cache/Backups/unklare ungetrackte Dateien ausgeben oder aufnehmen.
4. Kleinste Änderung mit serverseitigen Prüfungen und passenden Negativ-/Konkurrenztests vornehmen. Keine neuen Rollenrechte nur durch UI vergeben.
5. Bei Datenmodelländerung befüllte/idempotente Migration und beide Datenbanken prüfen. Geheimnisse und Schülercode nicht in Testlogs drucken.
6. Code- und Dokumentationsbehauptungen gegen tatsächliche Tests abgleichen. „Test angelegt“, „Test bestanden“ und „live geprüft“ getrennt berichten.
7. Vor Veröffentlichung die Releaseprüfung ausführen; keine echte Nutzerlöschung/Passwortänderung für Tests. Bei Freigabe-/Zugriffsblockade sicheren lokalen Stand dokumentieren statt Schutz zu umgehen.
8. Dieses Dokument bei Regeländerungen aktualisieren; im Handoff Commit, Testresultate, offene Punkte, Migrations-/Deploymentstatus und aktive Prozesse festhalten. Zugangsdaten nicht hineinschreiben.
