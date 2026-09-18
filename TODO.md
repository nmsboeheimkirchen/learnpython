# Roadmap und offene Entscheidungen

18.09.2026: Nutzer bestätigt Login, Speichern und Logout im persönlichen Testkonto. Neue Oberfläche, Klassencode-Neuanmeldung, Kontobereich und Lehreransicht werden **vor Umsetzung besprochen**; Vorschläge und offene Entscheidungen in [LOGIN-NEXT-STEPS.md](LOGIN-NEXT-STEPS.md). `CTEST` ist noch nicht aktiviert.

## Lernpfad

- [x] Pixelmuseum: offene Lösungswege, klare und geräteunabhängige Weltregeln
- [ ] Gemeinsame Helikopterflucht als interaktives Kursfinale umsetzen
  - [x] Hangar und Bildaufbau aus Variante A übernehmen
  - [x] Helikopter modern, kantig und facettiert wie in Variante B gestalten
  - [x] Teaser mit „Der Lord kommt zurück.“ beginnen
  - [x] Auftrag auf Bordcomputer, Zugangscode, Startsysteme und Flucht ausrichten
  - [x] Passende Bildzustände „Hangartor geschlossen“ und „Hangartor offen“ bereitstellen; die Mission startet mit geschlossenem Tor (siehe `assets/images/escape/hangar-states.md`)
  - [x] Stufe 1 „Das Seruianer-Signal“: gestörtes Laufzeitsignal entschlüsseln und den Bordcomputer entsperren
    - [x] Störzeichen mit `replace()` entfernen; die Rückwärts-Variante als mögliche spätere Aufgabe vormerken
    - [x] Pro Seitenaufruf ein zufälliges Passwort aus 256 Zeichen einschließlich Sonderzeichen erzeugen und zwischen je zwei Passwortzeichen eines von genau 255 `?` setzen
    - [x] Jede exakt richtige Passwortlösung akzeptieren; `replace()` durch Aufgabenstellung, Signallänge und Hilfen nahelegen, aber nicht über versteckte Code-Provenienz erzwingen
    - [x] Die frühere Brute-Force-Idee durch einen kurzen, praxisnahen Textbefehl ohne Indexzähler ersetzen
    - [x] Das Signal ausschließlich über `signal = bordcomputer.receive()` zur Laufzeit bereitstellen
    - [x] Nach erfolgreichem Passwort nur den Zugang entsperren; Navigation und Rotor bleiben offline, das Hangartor bleibt geschlossen
  - [ ] Stufe 2 „Cockpit reparieren“: die beschädigte `heli_config.json` zuerst als Datei kennenlernen und danach mit `json.loads()` in Python verwenden
    - [x] Einstiegstext verwenden: „Notzugang hergestellt. Startkonfiguration unvollständig. Manueller Systemstart erforderlich.“
    - [x] Teil 2a „Helikopterzugang und Hangartor öffnen“ ausschließlich mit einem sichtbaren JSON-Dateieditor bauen
      - [x] `heli_config.json` mit den Gruppen `heli`, `cockpit` und `hangar` anzeigen; Hauptdisplay online, alle übrigen Systeme zunächst offline beziehungsweise geschlossen
      - [x] Auftrag: genau `heli.zugang_offen` und `hangar.tor_offen` von `false` auf `true` ändern; JSON-Grundregeln vor Python erklären
      - [x] Semantisch mit `JSON.parse()` prüfen: Formatierung und Schlüsselreihenfolge sind frei, beide Zielwerte müssen Booleans sein und die Cockpit-Werte unverändert bleiben
      - [x] Fehlerfeedback beim Editor belassen; nur bei Erfolg zum Hero scrollen und das vorhandene Rendering mit offenem Hangartor zeigen
      - [x] Stufe 2 nach erfolgreicher Stufe 1 als deutlich klickbaren nächsten Auftrag freigeben
    - [ ] Teil 2b „Systeme manuell starten“ mit nebeneinander geplantem JSON-Dateieditor und Python-Codefeld bauen
      - [ ] Den aktuellen Dateiinhalt über `bordcomputer.lese_datei("heli_config.json")` bereitstellen und mit `daten = json.loads(datei_text)` als Dictionary laden
      - [ ] Einen lokalen, auf `loads()` und kurze Strings begrenzten JSON-Shim für die vorhandene Skulpt-Version ergänzen
      - [ ] Navigation und Rotor über `daten["cockpit"]` gezielt auf `True` setzen; Zugang und Hangartor bleiben aus Teil 2a offen
      - [ ] Den tatsächlichen Endzustand prüfen statt eine einzige vorgeschriebene Codeform oder versteckte Provenienz zu erzwingen
      - [ ] Erst nach korrekter Struktur Rotor und Navigation starten und die Abfluganimation freigeben
  - [ ] Finale ohne Echtzeitdruck als nachvollziehbare Zustandsmission bauen
- [ ] A/B-Varianten entfernen und je eine kanonische Start- und Fluchtseite festlegen
  - [x] Fluchtseite vereinheitlichen; alte B-Adresse auf die kanonische Seite weiterleiten
  - [x] Startseitenvariante B auswählen und als öffentliche `index.html` festlegen
  - [ ] Alte Startseitenvarianten entfernen oder auf die kanonische Seite weiterleiten
- [ ] Startseite nach Fertigstellung des gesamten Lernpfads aktualisieren
- [ ] Optional: vollständigen Hell-/Dunkelmodus mit Kontrast- und Beamerprüfung entwickeln

## Fortschritt und Anmeldung

Aktuelle Priorität (16.09.2026): Login mit E-Mail-Adresse und Passwort sowie zentral gespeicherter Code für Gerätewechsel innerhalb von zwei Wochen, für 30 Schüler:innen mit etwa 15 gleichzeitig Aktiven. Hostinger-Kapazität anhand der Screenshots vorgeprüft; Zieladresse ist `agentpy.bildungdigital.at`. Komprimierter Arbeitsstand, Einrichtungsschritte und Abnahmetests: [Login-Pilot](LOGIN-PILOT.md).

- [x] Stufe 1: den bestehenden Gastbetrieb ohne Änderung des normalen Lernablaufs hinter austauschbaren Speicher-Schnittstellen kapseln
  - [x] `ProgressStore` für Freischaltungen und Hilfestände einführen; der lokale Abschlussstatus wird weiterhin aus den erfolgreichen Codefassungen abgeleitet
  - [x] `CodeStore` für versuchte und erfolgreich abgeschlossene Codefassungen einführen; Quellcode bleibt von der späteren Lehreransicht getrennt
  - [x] `DraftCache` als bewussten No-op vorsehen: weiterhin nur beim Klick auf „Ausführen“ speichern; ein häufiges Tastendruck-Autosave erst bei nachgewiesenem Bedarf ergänzen
  - [x] Bestehende gültige lokale Daten ohne Verlust ausschließlich als anonymen Gaststand übernehmen; korrupte und unbekannte Einträge sicher normalisieren
  - [x] Direkte Zugriffe auf `localStorage` außerhalb des Gast-Adapters und klar getrennter Geräteeinstellungen durch einen Architekturtest verhindern
  - [x] Bestehende Lernpfad-, Wiederherstellungs- und Reset-Abläufe unverändert als Regressionstests beibehalten
- [x] Stufe 1 durch gezielte Speicher- und Isolationstests absichern
  - [x] Fehler bei `storage.getItem()`, `storage.setItem()` und `storage.removeItem()` sowie überschrittene Speicherquote testen; ein fehlgeschlagener Schreibvorgang darf nicht als gespeichert erscheinen
  - [x] Gleichzeitige Änderungen in zwei Tabs testen und in den Zielbrowsern mit einer kombinierten Web-Locks-/IndexedDB-Sperre vor verlorenen Aktualisierungen schützen; der Linux-WebKit-Test prüft ausdrücklich den Fallback gegen nur scheinbar originweit geteilte Web Locks
  - [x] Anonymen Stand, Reset, Normalisierung und Wiederherstellung in Chromium und WebKit als Browser-Tests prüfen
  - [x] Tests dokumentiert: `learning-data-core.test.mjs` prüft Profilbindung und verspätete Antworten; `local-learning-data.test.mjs` Speichervertrag und Fehler; `progress-architecture.test.mjs` die Kapselungsgrenze
  - [x] Browser-Tests dokumentiert: `progress-storage.spec.mjs` prüft Fehler, Reset und Wiederherstellung; `progress-multitab.spec.mjs` parallele Änderungen in zwei Tabs – jeweils Chromium und WebKit
- [ ] Stufe 2: E-Mail-Login-Pilot mit technisch strikt getrenntem Datenstand und Gerätewechsel umsetzen (Ziel: 30.09.2026)
  - [x] Backend und Lernseiten auf `dev-login-save` lokal verbinden: PHP-Sitzungen, Passwort-Hashing, CSRF-/Profilprüfung, transaktionale Speicherung, Revisionen und idempotente Wiederholungen
  - [x] 194 Logiktests, 30 Backendtests auf SQLite/MariaDB und 133 bestehende Browsertests bestanden (16.09.2026)
  - [x] Remote-Adapter, profilgebundener Bootstrap, Login-Oberfläche, Code-Textdateiexport und Speicher-/Konfliktstatus; 12 Browser-Integrationstests und 2 Dialog-Layout/Fokus-Tests auf Chromium/WebKit bestanden
  - [ ] Pilot-Abnahme gemäß `LOGIN-HANDOFF.md`: Kontoanlage/Wiederherstellung, automatische Auslieferung, Datenbank-Backup-Restore, Last und reale Schulgeräte; erste Hostinger-Testveröffentlichung erfolgt
  - [x] Hostinger-Ressourcen anhand der Plan- und Auslastungsbilder vorprüfen; Zieladresse `agentpy.bildungdigital.at` und E-Mail/Passwort festgelegt
  - [x] Website, DNS und HTTPS bereit; HTTPS-HEAD auf `agentpy.bildungdigital.at` liefert HTTP 200 (16.09.2026)
  - [x] Eigene Hostinger-Datenbank verbinden und initial vier InnoDB-/utf8mb4-Tabellen anlegen; keine Schülerkonten vorhanden
  - [ ] Kontoanlage, Wiederherstellung und Mailversand festlegen
  - [x] Mindestpasswortlänge auf Nutzerwunsch 8 Zeichen; Tests für 7/8 Zeichen, Umlaute, bcrypt-Obergrenze und Nullzeichen
  - [x] Name und genau eine Pflichtklasse pro Konto: Datenbank-Fremdschlüssel, private Klassen-/Kontoanlage und Anzeige im eigenen Kontostatus; noch keine Lehrerübersicht
  - [x] Migration 2 für leeren Alt-Pilotbestand, Abbruch bei bestehenden Alt-Konten, wiederholbare Migration und Erhalt bestehender v2-Konten auf SQLite/MariaDB geprüft; 34 Backendtests, 16 Loginbrowser- und 207 Logik-/Deploymenttests grün
  - [x] r2 mit Schema 2 nach privatem SQL-Backup auf Hostinger aktiviert; Live-Speicherung/Isolation geprüft, synthetische Konten bereinigt, persönliches Testkonto in Klasse `Test` angelegt und Browser-Login ohne Fortschrittsänderung geprüft
  - [x] Erfolgreiche Codefassung und Freischaltungen gemeinsam zentral speichern; ausgeführte Versuche separat sichern und Modus `completion-only` ohne Versuch-Uploads anbieten (Hostinger-Testrelease nutzt `attempts`)
  - [x] Jede Speicher-Fassade dauerhaft an genau einen unveränderlichen Gast- oder Profilkontext binden und verspätete Antworten einer beendeten Sitzung verwerfen
  - [x] Beim Login-Bootstrap den Profilkontext vor dem ersten Fortschrittszugriff eindeutig auf Gast oder Login festlegen
  - [x] Im Loginmodus weder Gastdaten lesen noch schreiben und bei Netzwerk- oder Serverfehlern niemals auf den lokalen Gaststand zurückfallen; für alle Missionsruntime-Familien mit absichtlich blockiertem Browserspeicher getestet
  - [x] Login, Logout und Wechsel zwischen zwei Identitäten in echten Browsern testen; Gaststand bleibt unverändert, altes Kontofenster wird gesperrt und sein Editor geleert
  - [x] Zwei unabhängige Browserkontexte als Geräte einschließlich Versionskonflikt und sicherer Wiederholung nach verlorener Commit-Antwort testen
  - [ ] Optionalen Export und Import des lokalen Gastfortschritts prüfen; eine Übernahme in ein Loginprofil darf nur als ausdrücklich bestätigte Einweg-Aktion erfolgen
  - [x] Serverbestätigung, Login, Transaktionen und sichere Wiederholungen testen; bei Fehlern keinen falschen Speichererfolg anzeigen
  - [ ] Passwort-Wiederherstellung sowie Sitzungsablauf im laufenden Editor und Browser-Zurück/Seiten-Cache ergänzend end-to-end testen
  - [ ] Lasttest mit 15 gleichzeitig Aktiven und 30 als Reserve einschließlich Anmeldungs- und Abschlussstößen durchführen; Details und weitere Abnahmetests siehe `LOGIN-PILOT.md`
- [ ] Stufe 3: Klassenverwaltung und Lehreransicht nach dem Gerätewechsel-Pilot fachlich modellieren
  - [ ] Lehrerrolle, Klassen, Beitrittscodes, Mitgliedschaften, Namenslistenimport, Fortschrittsansicht und Löschabläufe definieren
  - [ ] In der zentralen Lehreransicht standardmäßig nur Abschlussstatus, Zeitpunkt und erforderliche Lernmetadaten anzeigen; Entwürfe und vollständige Quellcodes bleiben privat
  - [ ] Optional später Microsoft-Anmeldung ergänzen und zunächst auf den eigenen Schultenant begrenzen
  - [ ] Eine Hybridoption prüfen: privater vollständiger Schülerstand im OneDrive-App-Ordner, Klassen und datensparsame Fortschrittsprojektion in einer zentralen PHP-Datenbank
  - [ ] OneDrive-Snapshot und zentrale PHP-Projektion mit Revisionen, idempotenten Ereignissen und einer wiederholbaren Outbox gegen partielle Schreibfehler absichern
  - [ ] Partielle Hybridfehler ausdrücklich testen: OneDrive erfolgreich/PHP fehlgeschlagen, PHP erfolgreich/OneDrive fehlgeschlagen, doppelte Übertragung und Wiederaufnahme nach Abbruch
  - [ ] Backend-Lasttest mit realistischer Klassenanzahl, gleichzeitigen Anmeldungen, Programmläufen und Abschlussmeldungen durchführen; Antwortzeiten, Fehlerrate und Datenbanklast protokollieren
- [x] Richtung für das erste Unterrichtsjahr festgelegt: Gastbetrieb beibehalten und einen zusätzlichen E-Mail-Login-Pilot für Gerätewechsel vorbereiten; dessen Freigabe hängt von Hosting-Prüfung und Abnahmetests ab
- [ ] Vor Cloudspeicherung Verantwortlichkeit, Hosting, Löschfristen, Backups und Sicherheitsbetrieb klären

## Domain und Veröffentlichung

- [x] `agentpy.bildungdigital.at` als Zieladresse festgelegt; frühere Schreibweisen `learnpy`/`agenty` ersetzt
- [x] Subdomain auf Hostinger eingerichtet und über HTTPS erreichbar (16.09.2026)
- [x] Eigene Datenbank und SSH-Zugang einrichten; erstmaliges Serververtrauen vom Nutzer freigegeben und Schlüssel für weitere Prüfungen gespeichert (17.09.)
- [x] Hostinger-Paket mit getrennten öffentlichen/privaten Dateien, Release-Cachekennung und SHA256-Manifest bauen; privat auf Hostinger ablegen, ohne `public_html` umzuschalten
- [x] Paket-/Einrichtungstests: keine Passwort-/Quelltext-Auslieferung, keine Passwortüberschreibung bei Wiederholung, ungültige Ziele/IDs/Symlinks, Passwort-Sonderzeichen, Manipulationen und geschlossene Fehlerzustände; 197 Logiktests, 10 PHP-Einrichtungs-/Deploymenttests und 16 Login-Browsertests bestanden
- [x] Privaten Konfigurationsort/Rechte und PHP 8.3 prüfen; alle 118 Paketdateien auf Hostinger verifizieren und private URLs auf HTTP 404 prüfen
- [x] Passwort direkt auf Hostinger eingetragen, DB-Verbindung geprüft und leere Datenbank initialisiert; Passwort bleibt ausschließlich privat auf dem Server
- [x] Aktivierung mit privater Webroot-Sicherung, Deployment-Sperre und Wiederherstellungsprotokoll; Tests für Bestätigung/Rollback, manipulierte Pakete, Rename-Fehler und Prozessabbruch bestanden
- [x] `pilot-20260917-r1` am 17.09. aktiviert und bestätigt: HTTPS-/Cookie-/Cache-/Privatpfadprüfung, Live-Login, Abschlusscode, zweite Sitzung, Wiederholung, Konflikt, Kontentrennung, CSRF und Logout bestanden; beide synthetischen Konten wieder gelöscht
- [x] Live-Startseite/Assets und Login-Dialog mit Fokus/Viewport/Abbrechen auf Chromium sowie WebKit/iPad-Profil geprüft; keine Schülerfreigabe oder echte Schulgeräte-Abnahme daraus ableiten
- [ ] GitHub Actions für anschließende Veröffentlichung auf Hostinger einrichten; Logik-, Backend-, Gastbrowser- und Loginbrowser-Tests als Voraussetzungen sind im Entwicklungsbranch vorbereitet
- [ ] Nach erfolgreicher Inbetriebnahme die bisherige GitHub-Pages-Adresse einschließlich alter Missionslinks über statische Weiterleitungsseiten auf die neue Adresse führen
- [x] Für diesen Domainwechsel keine Übernahme vorhandener Gaststände erforderlich (Nutzerentscheidung); keine vorhandenen Daten löschen
- [ ] Optional `bildungdigital.at/learnpy` durch den Domaininhaber auf die neue Subdomain weiterleiten lassen

## Rechtliches und Projekttransparenz

- [ ] Mit Schulleitung bzw. Datenschutzbeauftragten festlegen, wer Medieninhaber, Diensteanbieter und datenschutzrechtlich Verantwortlicher ist
- [x] Impressum mit den angegebenen persönlichen Daten erstellen und unten auf der Startseite verlinken
- [ ] Kontakt-E-Mail ergänzen und Impressums-/Offenlegungspflichten mit den geklärten Betreiberangaben abschließend prüfen
- [ ] Datenschutzerklärung bereits für Hosting, Server-Logs und lokalen Browserspeicher erstellen
- [ ] Vor Login oder serverseitiger Speicherung ergänzen: Datenarten, Zweck, Rechtsgrundlage, Empfänger/Auftragsverarbeiter, Speicherdauer, Löschung, Betroffenenrechte und Sicherheitsmaßnahmen
- [ ] Bei externem PHP-/Datenbank-Hosting Rollen und erforderliche Vereinbarungen schriftlich klären
- [x] Copyright-Zeile in `LICENSE` auf Dipl. Ing. Michael Bieglmayer korrigieren; MIT-Lizenz beibehalten
- [ ] Etwaige dienstliche Werknutzungsrechte anhand von Aufgaben, Auftrag und Vereinbarungen klären; Ferienzeit und Schul-Repository allein entscheiden die Zuordnung nicht
- [ ] Tester:innen, Beratung und substanzielle Beiträge in einer getrennten Credits-/Mitwirkenden-Seite dokumentieren
- [ ] Einsatz von ChatGPT/Codex transparent als Hilfsmittel beschreiben; menschliche Auswahl, Prüfung und Verantwortung klar benennen
- [ ] Anwendbarkeit von Art. 50 EU-KI-Verordnung prüfen und menschliche redaktionelle Kontrolle sowie Verantwortlichkeit dokumentieren
- [ ] Lizenzen und Herkunft aller Bilder, Schriften und eingebundenen Bibliotheken abschließend prüfen
