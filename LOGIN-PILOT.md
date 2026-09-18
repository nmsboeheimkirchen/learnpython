# Arbeitsstand: Schüler-Login und Gerätewechsel

Stand: 17.09.2026. **Testversion `pilot-20260917-r2` auf https://agentpy.bildungdigital.at aktiv**, Schema 2 mit Name und Pflichtklasse sowie acht Zeichen Mindestpasswortlänge. Persönliches Testkonto des Nutzers in Klasse `Test` angelegt und echter Browser-Login geprüft, Lernstand leer. Temporäre Live-Testkonten und Testklasse entfernt. 34 Backendtests, 16 Login-Browsertests und 207 Logik-/Deploymenttests grün; Live-Speicherung/Gerätewechsel/Kontentrennung erneut geprüft. Noch keine Schülerfreigabe, kein Commit/Push und kein automatisches Hostinger-Deployment. GitHub Pages unverändert. Betrieb/Rückfall: [Hostinger-Einrichtung](HOSTINGER-DEPLOY.md). Exakte Fortsetzung: [LOGIN-HANDOFF.md](LOGIN-HANDOFF.md).

## Ziel bis 30.09.2026

- Eine Klasse mit 30 Schüler:innen, davon ungefähr 15 gleichzeitig aktiv.
- Anmeldung mit **E-Mail-Adresse und Passwort**, vom Nutzer am 16.09.2026 bestätigt.
- Zieladresse: **https://agentpy.bildungdigital.at/**. Frühere Schreibweisen `agenty` beziehungsweise `learnpy` sind überholt. Vorhandene Gaststände müssen laut Nutzer für diesen Umzug nicht übernommen werden.
- Nach Anmeldung auf einem anderen Laptop sind zentral bestätigte Codefassungen, Abschlüsse und Freischaltungen wieder verfügbar.
- Mindestumfang: Bei erfolgreichem Levelabschluss den zugehörigen Code und Fortschritt gemeinsam zentral speichern. Bevorzugt zusätzlich den letzten ausgeführten Versuch sichern; bei nachgewiesenen Lastproblemen auf Abschluss-Speicherung begrenzen.
- Keine Übertragung einzelner Tastendrücke. Wenn nur Abschlüsse übertragen werden, wandert unfertiger Code ausdrücklich nicht auf das andere Gerät mit.
- Gastbetrieb bleibt verfügbar und strikt vom angemeldeten Stand getrennt. Keine automatische Übernahme oder Vermischung.
- Lehreransicht, Klassenverwaltung, PDF-Namenslistenimport, Microsoft-/OneDrive-Anbindung und Hybrid-Synchronisierung folgen später und sind keine Voraussetzung für diesen Pilot.

## Vorhandene Grundlage

- Statische HTML-/JavaScript-Anwendung; Python läuft über Skulpt im Browser.
- `assets/data/learning-data-core.js`: gemeinsame Speicher-Fassade mit `ProgressStore`, `CodeStore`, Koordinator und bisher inaktivem `DraftCache`.
- `assets/data/local-learning-data.js`: gekapselter Gastadapter mit bestehenden lokalen Schlüsseln und Schutz gegen parallele Tab-Änderungen.
- Unveränderlicher Gast-/Profilkontext, E-Mail/Passwort-Anmeldung, serverseitige Zugriffsprüfung und Remote-Adapter sind lokal verbunden. Gastdaten werden im Kontomodus nicht geöffnet; verspätete Antworten einer beendeten Sitzung werden verworfen.
- Lesezugriffe bleiben synchron auf der zuvor geladenen Kontomomentaufnahme. Alle produktiven Missionsruntimes warten im Kontomodus auf den asynchronen Bootstrap. Netzwerkfehler sperren den Start, statt Gastdaten zu laden.
- Tests decken lokale Speicherung, Speicherfehler/Quota, mehrere Tabs, PHP-Transaktionen sowie echten Browser-Login, Gerätewechsel, Kontowechsel und sichere Wiederholung nach verlorener Antwort ab. Hostinger-Lasttest, Backup und reale Schulgeräte-Abnahme fehlen noch.
- Vom Nutzer manuell geprüft: Lehrermodus einschließlich bisheriger Helikopterflucht, direkter Missionseinstieg, Wiederherstellung und Lernpfad bis Safeknacker einschließlich Überspringen.
- Pixelmuseum-Briefing: Hilfestände werden gespeichert und automatisiert geprüft. Die zwei Passwort-Hinweise im Finale sind derzeit nur Seitenzustand.
- GitHub bleibt Quellcodeverwaltung; das bestehende Gastangebot auf GitHub Pages bleibt parallel zur neuen Hostinger-Testversion unverändert.

## Hostinger: vorläufige Einschätzung

Die bereitgestellten Screenshots zeigen einen aktiven Vertrag **Business Web Hosting bis 17.04.2028**, deaktivierte automatische Verlängerung und ein Daily-Backup-Add-on. Der vorhandene Vertrag kann nach Nutzerangabe ohne zusätzliche Hosting-Ausgaben genutzt werden. Die nachgereichten Plan-Details bestätigen 2 CPU-Kerne, 3072 MB RAM, 60 PHP-Worker, 120 Prozesse, 200 GB Speicher und 100 Websites; die Tarifansicht nennt maximal 75 MySQL-Verbindungen pro Benutzer. Serverstandort ist Frankreich, Backupstandort Litauen. Belegt sind 8,89 GB und drei Websites; die 24-Stunden-Übersicht zeigt ungefähr 7 % CPU und 47 MB RAM. Das belegt freie Kapazität im beobachteten Zeitraum, ersetzt aber keinen Lasttest der neuen Anwendung.

**Arbeitshypothese: Der vorhandene Tarif reicht für diesen Pilot voraussichtlich aus.** Der Server führt keinen Schüler-Pythoncode aus, sondern bearbeitet kurze Anmeldungs-, Lade- und Speichervorgänge. Beispielrechnung, keine Messung: 15 aktive Personen × 4 Programmläufe pro Minute ergeben 60 Speicheranfragen pro Minute, im Mittel eine pro Sekunde. Bei angenommenen 10 KB Nutzdaten je Speicherung wären das in 50 Minuten ungefähr 30 MB Upload, ohne Protokoll-Overhead, Antworten und Seitendownloads. Gleichzeitige Anmeldungen und Speicherstöße müssen zusätzlich geprüft werden.

Hostinger führt Business inzwischen teilweise unter „Unlimited“ und weist darauf hin, dass bestehende Business-Verträge ihre bisherigen Grenzen behalten. Die aktuelle allgemeine Tabelle ist deshalb kein Beleg für die Kapazität dieses Kontos. Quelle: [Hostinger: Tarifgrenzen](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/), geprüft am 16.09.2026.

Noch zu prüfen:

- Klassenlast einschließlich gleichzeitiger Anmeldungen und Abschlüsse auf der künftigen Anwendung; bei Bedarf die längere Auslastungshistorie ergänzen. Ein Upgrade ist anhand der vorliegenden Daten nicht eingeplant.
- Neue Website mit PHP 8.3 und eigener Datenbank ist eingerichtet. Das Dashboard der alten Website cybershoes.com meldete zehn Schwachstellen und PHP 8.1; diese konkreten Meldungen und die Trennung der Projekte vor Speicherung echter Schülerdaten prüfen und bereinigen.
- Verfügbarer Mailversand für Kontobestätigung und Wiederherstellung; Zustellung an die Schüleradressen testen.

Quelle für den Dashboard-Pfad: [Hostinger: Ressourcennutzung prüfen](https://www.hostinger.com/support/2436138-how-to-check-resource-usage-in-hostinger/).

Der eingebaute serverseitige Mailversand ist laut Hostinger auf 10 Nachrichten pro Minute und 100 pro Tag begrenzt; direktes SMTP hat eigene Tarifgrenzen. Ein Code/Link per E-Mail bei jeder Anmeldung könnte deshalb gerade beim gemeinsamen Stundenbeginn stören. E-Mail-Adresse und Passwort benötigen im normalen Loginablauf keinen Mailversand. Quelle: [Hostinger: Versandgrenzen](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/).

## Vorgesehener Aufbau

- Kleine eigenständige PHP-Anwendung mit MySQL/MariaDB und eigener Datenbank samt eigenem Datenbankbenutzer; kein Einbau in WordPress.
- Statische Lernseiten und PHP-API unter derselben HTTPS-Origin `https://agentpy.bildungdigital.at` auf Hostinger; GitHub bleibt für Quellcode, automatische Tests und die Veröffentlichung zuständig. Pro Änderung weiterhin ein Push nach GitHub.
- Nach erfolgreicher Inbetriebnahme kann das bisherige GitHub-Pages-Angebot durch statische Weiterleitungsseiten ersetzt werden. Dabei auch alte Missionslinks auf die entsprechende neue Seite führen. Vorher nicht umschalten; die Übernahme alter Gastdaten ist kein Umzugsziel.
- Konten zunächst auf die Pilotgruppe begrenzen; Kontoanlage, erstmaliger Zugang und Wiederherstellung vor Unterrichtsbeginn festlegen. Dafür ist keine Lehrerübersicht erforderlich.
- Bei Passwort-Login: sichere Passwort-Hashes, serverseitige Sitzung mit geschütztem Cookie, CSRF-Schutz und begrenzte Loginversuche. Jeder Datenzugriff wird serverseitig anhand der Sitzung autorisiert, niemals nur anhand einer vom Browser übergebenen Profil-ID.
- Pro Person und Level mindestens erfolgreiche Codefassung, Abschluss, Freischaltungen und Revision speichern. Der letzte ausgeführte Versuch ist ein separates Feld und darf den erfolgreichen Code nicht überschreiben.
- Code und zugehörigen Abschluss transaktional schreiben. Wiederholte Anfragen dürfen keine doppelten Ereignisse auslösen; veraltete Revisionen dürfen neuere Fassungen nicht still überschreiben.
- Ladefehler dürfen nicht als leerer Lernstand erscheinen. Nur eine Serverbestätigung darf „zentral gespeichert“ anzeigen; bei Fehlern Code im Editor behalten und eine Wiederholung ermöglichen.
- Kein Rückfall auf Gastdaten bei Netzwerkfehlern. Ein etwaiger lokaler Puffer für angemeldete Personen braucht einen eigenen Profilbereich und getestete Logout-/Gerätewechsel-Regeln; vollständige Offline-Synchronisierung ist kein Mindestumfang.
- Datenbankkennwörter, Schülerdaten und Backups gehören weder ins Repository noch ins statische Pages-Artefakt. Eine gezielte Dateiauswahl ist im Entwicklungsbranch implementiert und getestet; der Workflow ist noch nicht gepusht.

## Umsetzung in zwei Wochen

1. Tage 1–2: Hostinger-Kapazität ist anhand der Screenshots vorgeprüft; E-Mail/Passwort und Zieladresse stehen fest. Website, DNS und HTTPS einrichten; Kontoanlage und Mailversand festlegen. Bestehende offene Punkte zu Verantwortlichkeit, Datenverarbeitung, Löschung und Backups für den Pilot klären.
2. Tage 3–5: Anmeldung, Abmeldung, Wiederherstellung und Remote-Adapter mit zentralem Lesen und transaktionaler Abschluss-Speicherung umsetzen.
3. Tage 6–8: profilgebundenen Bootstrap und Speicherstatus in die Lernseiten integrieren; Gerätewechsel prüfen und Speicherung des letzten ausgeführten Versuchs ergänzen, soweit die Messung dafür spricht.
4. Tage 9–11: Isolation, Ausfälle, Konflikte und Klassenlast automatisiert testen; Fehler beheben.
5. Tage 12–14: zwei echte Schul-Laptops, Schulnetz und gleichzeitigen Stundenbeginn erproben; Backup-Wiederherstellung und Rückkehr zum Gastangebot prüfen; Puffer für Korrekturen.

## Abnahmetests vor Schülerbetrieb

- [ ] Konto A auf Laptop 1: Level abschließen → zentrale Bestätigung → auf Laptop 2 anmelden → exakten Code, Abschluss und nächste Freischaltung sehen.
- [ ] Gast, Konto A und Konto B bleiben bei Login, Logout, Reload, Rücktaste und verspäteten Antworten isoliert; serverseitige Zugriffe auf fremde Datensätze werden abgewiesen.
- [ ] Kontoanlage, falsches Passwort, abgelaufene Sitzung und Wiederherstellung prüfen; API auch ohne gültige Anmeldung direkt testen. Die Begrenzung von Loginversuchen muss 15 reguläre Anmeldungen über dieselbe öffentliche Schul-IP zulassen.
- [ ] Zwei Geräte und zwei Tabs ändern denselben Level: kein stiller Datenverlust; eine Wiederholung überschreibt keine neuere Revision.
- [ ] Verbindungsabbruch vor Speicherung sowie nach Datenbank-Commit vor Empfang der Antwort: korrekter Status, sichere Wiederholung, kein doppelter Abschluss.
- [ ] Server-/Datenbankfehler, begrenzter lokaler Speicher und abgebrochener Seitenaufruf: kein falsches „gespeichert“, keine Gastdatenvermischung.
- [ ] Im reduzierten Abschlussmodus kommen erfolgreiche Fassungen geräteübergreifend an; unfertige Versuche werden nicht als zentral gespeichert ausgewiesen.
- [ ] Mit synthetischen Konten 15 gleichzeitige Anmeldungen, 15 gleichzeitige Abschlüsse und typische Programmläufe über eine Unterrichtsstunde prüfen; 30 gleichzeitige Personen als Reserve testen. Latenz, Fehler, Datenkorrektheit und Hostinger-Auslastung aufzeichnen.
- [ ] Pilot-Backup wiederherstellen und die vollständigen bestehenden Logik-/Browserregressionen erfolgreich ausführen.

## Nächste Einrichtungsschritte

Website, DNS, SSL, eigene Datenbank, SSH und erste Testveröffentlichung sind erledigt. Weiter mit Kontoanlage/Wiederherstellung, automatisierter Auslieferung, Klassenlast und Datenbank-Backup-Restore gemäß [HOSTINGER-DEPLOY.md](HOSTINGER-DEPLOY.md); noch keine echten Schülerdaten hochladen. Die folgenden Schritte dokumentieren auch bereits erledigte Einrichtungsschritte.

1. Nutzer: In Hostinger unter dem vorhandenen Business-Plan eine eigene PHP/HTML-Website hinzufügen und als bestehende Subdomain `agentpy.bildungdigital.at` eintragen. Die Hauptdomain muss nicht zu Hostinger umziehen. Danach die IP in den Details dieser neuen Website bestätigen; im bisherigen Plan-Screenshot steht `195.35.49.40`.
2. Domaininhaber: Beim DNS-Anbieter von `bildungdigital.at` einen A-Eintrag für `agentpy` auf die bestätigte Hostinger-IP setzen. Die Hauptdomain, ihre Nameserver und Mail-Einträge bleiben unverändert. Das ist eine DNS-Zuordnung, keine URL-Weiterleitung. Quelle: [Hostinger: eigenständige Subdomain einrichten](https://www.hostinger.com/support/1583405-how-to-create-and-delete-subdomains-in-hostinger/).
3. Nutzer und Projekt: DNS-Auflösung und Hostingers SSL-Zertifikat prüfen, danach HTTPS verbindlich verwenden. Datenbank sowie SSH-Zugang für die automatische Veröffentlichung einrichten; Zugangsdaten außerhalb des öffentlichen Repositorys hinterlegen.
4. Projekt: Bestehende GitHub-Tests erhalten, Backend-Tests ergänzen und ausschließlich den erfolgreich geprüften Stand nach Hostinger veröffentlichen; dort anschließend einen Smoke-Test ausführen. Nicht parallel ungeprüft bei jedem Push über eine separate Hostinger-Automatik veröffentlichen.
5. Nach erfolgreicher Inbetriebnahme: GitHub Pages auf Weiterleitungsseiten umstellen und Startseiten- sowie Missionslinks prüfen. Dies ist noch nicht umgesetzt oder veröffentlicht.
