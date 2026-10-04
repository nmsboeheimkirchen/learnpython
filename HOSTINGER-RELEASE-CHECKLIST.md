# Hostinger-Releasecheckliste

Diese Checkliste ergänzt [HOSTINGER-DEPLOY.md](HOSTINGER-DEPLOY.md) und den
[technischen Regelvertrag](ACCOUNT-SYSTEM.md). Releasevorbereitung, Aktivierung
und Bestätigung sind getrennte Schritte. Aktueller Arbeitsstand im
[Handoff](LOGIN-HANDOFF.md).

## Kandidat vom 04.10.2026 – Operation Nullpunkt und globale Korrekturen

| Punkt | Stand |
| --- | --- |
| Release-ID | `pilot-20261004-r16` |
| Quellcommit | `bd051cbfde5fcfde02898ce13a8e428d136999ce` auf `dev-login-save` |
| GitHub | Missionsänderungen und separater Testcommit MAIN-26 gepusht |
| CI | [Application tests 37186064017](https://github.com/nmsboeheimkirchen/learnpython/actions/runs/37186064017), alle fünf Jobs erfolgreich; 151 Chromium-, 75 WebKit-, 68 Konto-/Gerätewechsel-Browserfälle |
| Tatsächlicher Live-Stand, lesend geprüft | `pilot-20260926-r15`, Commit `d00c8da65369f9405afd6ee150fccc6262f630de`, Schema 9, keine ausstehende Aktivierung |
| Bestehender Bestand | 17 Konten, 17 Lernstände, 7 Klassen; reine Zählabfrage, keine personenbezogenen Inhalte ausgegeben |
| Paket | 193 Dateien, 21.722.769 Bytes (ohne Manifest); lokal per SHA256 und PHP verifiziert |
| Manifest SHA256 | `61ea7a177cc050acaf4427af47cf6ae719030cf84dc6b89879cc706f2cabb0b1` |
| Backend/API/Anmeldung | Alle 28 privaten Appdateien bytegleich zu r15 |
| Private Bereitstellung | Auf Hostinger unter `agentpy-private/releases/pilot-20261004-r16`, serverseitig manifestverifiziert; Webroot/private Konfiguration vor und nach Upload hashgleich |
| Fortschritt | PICO-Level-IDs und Gewichte bleiben erhalten; Anzeigename wird „Operation Nullpunkt“ |
| Datenbankmigration | Keine vorgesehen: Schema 9 bleibt bestehen |
| Live-Aktivierung | Noch nicht ausgeführt; der Auftrag umfasst die Vorbereitung |

Laut Nutzer sind die Schülerinnen und Schüler noch nicht bei PICO. Daraus folgt
keine Berechtigung, Code, Freischaltungen oder andere Lernstände zu löschen.
Bestehende Konten werden nicht als Testkonten verwendet.

## 1. Vorbereitung

- [x] README, technischen Regelvertrag, bisherigen Releaseablauf und Thread
  „login datenspeicherung SuS“ zur Vorgeschichte lesen.
- [x] Arbeitsbranch/Remote/Quellcommit feststellen und vorhandene Commits pushen;
  `main` und GitHub Pages bleiben auf ihrem bisherigen Stand.
- [x] Live-Release, Schema, Bestandszahlen, private Konfiguration unverändert,
  Mailworker und fehlende ausstehende Aktivierung lesend prüfen.
- [x] HTTPS, öffentliche Releasekennung, Cache-Regeln, Sitzungstrennung und
  Nichterreichbarkeit privater Pfade am bestehenden r15 prüfen.
- [x] Vollständige CI: Logik, Missionsbrowser Chromium/WebKit, Konto-/Gerätewechsel,
  PHP-API auf SQLite und MariaDB sowie Hostingtests erfolgreich.
- [x] Unveränderliches Paket aus ausschließlich versionierten Dateien des
  Quellcommits bauen; kein Export beliebiger ungetrackter Arbeitsdateien.
- [x] Manifest, Dateianzahl, Größen und SHA256 prüfen; private App von öffentlichem
  Webroot trennen. Backenddateien mit dem aktiven r15 vergleichen.
- [x] Paket ausschließlich unter der neuen privaten Release-ID ablegen
  und serverseitig verifizieren; `public_html` dabei unverändert lassen.
- [x] Quellcommit, Paket-/Manifestprüfung, CI und verbleibende Schritte im Handoff
  festhalten und die Vorbereitungsdokumentation committen/pushen.

Lokales Paket: `.cache/hostinger/pilot-20261004-r16`. Gebaut aus `git archive`
des genannten Commits; ausschließlich exportierte Servertextdateien wurden von
CRLF auf LF normalisiert, damit der unveränderte Backendcode auch byteweise r15
entspricht. Der Arbeitsbaum wurde dadurch nicht geändert. Lokaler Prüfbericht:
`.cache/hostinger-r16-package-report.json`.

Der frühere ungeprüfte Kandidat `.cache/hostinger/pilot-20261003-r16` ist verworfen
und darf nicht hochgeladen werden. Das Vorbereitungsskript
`.cache/stage-hostinger-r16.mjs` kennt nur `inspect` und `stage`, keine Aktivierung
oder Datenbankänderung. `stage` setzt den erfolgreichen vollständigen CI-Lauf für
exakt diesen Commit voraus und kontrolliert Webroot/private Konfiguration vor
und nach dem privaten Upload. Pakete nie unter einer bestehenden ID ersetzen.
`stage` ist bereits erfolgreich ausgeführt; **nicht wiederholen**. Der Bericht
liegt unter `.cache/hostinger-r16-staging-report.json`. Der abschließende
Dokumentationscommit verändert das getestete Paket nicht.

## 2. Unmittelbar vor der ausdrücklich beauftragten Live-Aktivierung

- [ ] Frische Kontrolle: Live weiterhin r15, Schema 9, keine fremde ausstehende
  Aktivierung; Kandidat und Quellcommit entsprechen den Prüfnachweisen.
- [ ] Frische private SQL-Sicherung und Webroot-Sicherung mit Prüfsummen anlegen;
  Zugangsdaten, SQL-Inhalte und Schülercode bleiben außerhalb von Git/Chat.
- [ ] Rückfallverfahren anhand des Backendvergleichs bestätigen: bei diesem
  Kandidaten nur Web-/App-Version zurückwechseln, **keine alte SQL-Sicherung
  über neuere Lernstände zurückspielen**.
- [ ] Kurzes Wartungsfenster/Schreibpause für einen belastbaren Vorher-Nachher-
  Bestandsvergleich festlegen; laufende Schülerarbeit berücksichtigen.
- [ ] Private DB-/Mail-/Schlüsselkonfiguration, Sitzungen, Lernstände, Klassen,
  Mitgliedschaften und Rechte erhalten. Keine Neuinitialisierung, Testkonten,
  Testmails, Bereinigung oder Migration ohne einen gesonderten Anlass.
- [ ] Den neuen geprüften Kandidaten mit dem Aktivierungswerkzeug umschalten.
  Den bereits ausgeführten r15-Migrationsoperator nicht wiederholen.

## 3. Nach der Aktivierung

- [ ] Live-Release/Quellcommit, HTTPS/Cache, Sitzungsschutz und private Pfade prüfen.
- [ ] Bestandsvergleich und Konfigurationsvergleich bestätigen; keine Rücksetzung
  oder unerwartete Schemaänderung. Echte Konten nur lesend prüfen.
- [ ] Anonyme Chromium-/WebKit-Prüfung von Anmeldung, Gastansicht und Missionen;
  keine echten Schülerkonten durch Testprogramme oder Schreibversuche verändern.
- [ ] Mailworker folgt dem neuen Release; Registrierung/Recovery-Konfiguration
  ist unverändert. Keine automatische Testmail versenden.
- [ ] Erst nach erfolgreicher Abnahme Release bestätigen und den endgültigen
  Live-Stand in HOSTINGER-DEPLOY.md, ACCOUNT-SYSTEM.md und Handoff aktualisieren.

Ein GitHub-Push aktiviert kein Hostinger-Release. Das GitHub-Repository ist
derzeit öffentlich; die technische Trennung der Release-Pakete macht einen
Git-Branch nicht privat.
