# GitGuardian-Prüfung vom 22.09.2026

## Ergebnis

Die fünf vom Nutzer gezeigten Funde enthalten keine produktiven Zugangsdaten.
`No checker` im Dashboard ist kein Nachweis eines gültigen Passworts.

| Gemeldete Datei | Befund | Einordnung in GitGuardian |
| --- | --- | --- |
| `tests/hostinger-setup.test.mjs` | Lokales SMTP-Testkennwort; nur Objekterzeugung/`preSend()`, kein SMTP-Versand, Testabsender unter `.test`. | Test credential |
| `tests/login-e2e/recovery.spec.mjs` | Passwortwechsel eines kurzlebigen localhost-Testkontos. | Test credential |
| `scripts/check-hostinger-mail.mjs` | `smtp_password_file` verweist auf eine private Datei auf dem Server; der Pfad ist kein Passwort. | False positive (not a secret) |
| `server/config.example.php` | Beispielwerte und Pfad zur Passwortdatei, kein Passwortinhalt. | False positive (not a secret) |
| `tests/static-release.test.mjs` | Künstlicher `.env`-Inhalt zum Prüfen, dass private Dateien nicht veröffentlicht werden. | Test credential |

## Zusätzliche Prüfung

Der aktive SMTP-Dateiinhalt wurde auf seinem eigenen Server gegen 1.368 eindeutige
versionierte Textblobs (21.235.080 Bytes) aller lokal erreichbaren Git-Commits
verglichen. Berücksichtigt wurden Quelltexte, Konfigurations- und Dokumentdateien;
Ergebnis: **kein Treffer**. Das Passwort wurde weder ausgegeben noch heruntergeladen.
Dies ist eine gezielte Prüfung des aktiven SMTP-Passworts, keine pauschale Garantie
für sämtliche Geheimnisse, Binärdateien, nicht lokal bekannte Git-Referenzen oder
externe Logs.

## Änderungen

- SMTP-Testwerte und das neue Passwort im Recovery-Test entstehen nun pro Lauf zufällig.
- Der SMTP-Test nutzt ausschließlich `smtp.example.test`, keine echte Provideradresse.
- Der Static-Release-Test erzeugt ebenfalls nur einen zufälligen Wegwerfwert.
- Die Beispielkonfiguration enthält leere, außerhalb Git einzurichtende SMTP-Felder.
- Der Preflight kennzeichnet den privaten Dateipfad ausdrücklich als Pfad und nicht als Kennwort.
- Keine globale Scanner-Ausnahme, kein Abschalten der Prüfung und kein History-Rewrite.
- Produktive SMTP-Konfiguration und Passwort bleiben unverändert; die Befunde begründen keine Rotation.

Historische GitGuardian-Funde verschwinden durch einen neuen Commit nicht automatisch.
Die fünf geprüften Vorfälle müssen im Dashboard mit den obigen Gründen eingeordnet
werden. Diese Dokumentation behauptet nicht, sie dort bereits geschlossen zu haben.

Bei einem künftig tatsächlich veröffentlichten Passwort: zuerst beim Anbieter
widerrufen/rotieren, alle Verbraucher aktualisieren und mögliche Nutzung prüfen;
ein bloßes Löschen aus dem nächsten Commit reicht nicht.
Referenz: https://docs.gitguardian.com/public-monitoring/remediate/remediate-incidents
