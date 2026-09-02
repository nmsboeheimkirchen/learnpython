# Roadmap und offene Entscheidungen

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
