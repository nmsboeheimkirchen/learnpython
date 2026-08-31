# Roadmap und offene Entscheidungen

## Lernpfad

- [x] Pixelmuseum: offene Lösungswege, klare und geräteunabhängige Weltregeln
- [ ] Gemeinsame Helikopterflucht als interaktives Kursfinale umsetzen
  - [x] Hangar und Bildaufbau aus Variante A übernehmen
  - [x] Helikopter modern, kantig und facettiert wie in Variante B gestalten
  - [x] Teaser mit „Der Lord kommt zurück.“ beginnen
  - [x] Auftrag auf Bordcomputer, Zugangscode, Startsysteme und Flucht ausrichten
  - [ ] Stufe 1 „Das Seruianer-Signal“: Bordcomputer mit begrenzter Kandidatensuche entsperren
    - [ ] Abgefangenes Signal mit Kennung `SERU` und Prüfziffern `135790` zeigen
    - [ ] Mit einer terminierenden `while`-Schleife `SERU1`, `SERU3`, `SERU5`, `SERU7` über `bordcomputer.pruefe(code)` prüfen
    - [ ] Bordcomputer-API auf genau fünf alphanumerische ASCII-Zeichen und höchstens zwölf Versuche begrenzen
    - [ ] Vollständigen Brute-Force über 36⁵ Kombinationen ausdrücklich vermeiden, damit der Browser nicht blockiert
    - [ ] Nach `SERU7` nur den Zugang entsperren; Navigation, Rotor und Hangartor bleiben sichtbar offline
  - [ ] Stufe 2 „Cockpit-Systeme booten“: beschädigte Startkonfiguration mit `json.loads()` reparieren
    - [ ] Erfolgreichen Code aus Stufe 1 als Ausgangslage übernehmen
    - [ ] Lokalen, auf `loads()` und kurze Strings begrenzten JSON-Shim für die vorhandene Skulpt-Version ergänzen
    - [ ] JSON-Text in das Python-Dictionary `daten` laden und erst danach die verschachtelte Struktur verändern
    - [ ] `daten["systeme"]["navigation"]["online"]`, Rotor, Hangartor und `startfreigabe` gezielt auf `True` setzen
    - [ ] `cockpit.booten(daten)` nur mit dem tatsächlich von `json.loads()` erzeugten Dictionary akzeptieren
    - [ ] Erst nach korrekter Struktur Rotor und Navigation starten, das Hangartor öffnen und die Abfluganimation freigeben
  - [ ] Finale ohne Echtzeitdruck als nachvollziehbare Zustandsmission bauen
- [ ] A/B-Varianten entfernen und je eine kanonische Start- und Fluchtseite festlegen
  - [x] Fluchtseite vereinheitlichen; alte B-Adresse auf die kanonische Seite weiterleiten
  - [x] Startseitenvariante B auswählen und als öffentliche `index.html` festlegen
  - [ ] Alte Startseitenvarianten entfernen oder auf die kanonische Seite weiterleiten
- [ ] Startseite nach Fertigstellung des gesamten Lernpfads aktualisieren
- [ ] Optional: vollständigen Hell-/Dunkelmodus mit Kontrast- und Beamerprüfung entwickeln

## Fortschritt und Anmeldung

- [ ] Bestehenden Gastfortschritt hinter einer austauschbaren Speicher-Schnittstelle kapseln
- [ ] Für das erste Unterrichtsjahr entscheiden: ausschließlich lokaler Gastbetrieb oder zusätzlicher Pilot
- [ ] Optionalen Export und Import des lokalen Gastfortschritts prüfen
- [ ] Microsoft-Anmeldung zunächst auf den eigenen Schultenant begrenzen
- [ ] Vor Cloudspeicherung Verantwortlichkeit, Hosting, Löschfristen, Backups und Sicherheitsbetrieb klären
- [ ] Spätere Klassenfunktionen vor der Datenbankwahl modellieren: Lehrerrolle, Klassen, Beitrittscodes, Mitgliedschaften und Fortschrittsansicht
- [ ] Angemeldeten Cloudstand und lokalen Gaststand technisch strikt getrennt halten

## Domain und Veröffentlichung

- [ ] `learnpy.bildungdigital.at` als Ziel-Domain vorbereiten
- [ ] `bildungdigital.at/learnpy` auf die Subdomain weiterleiten
- [ ] Domainwechsel zu einem geeigneten Zeitpunkt planen, da lokaler Gastfortschritt nicht zwischen Origins mitwandert

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
