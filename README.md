# AGENT PY – Python Agenten-Training

Eine browserbasierte Lernplattform, mit der Schüler:innen die Grundlagen von Python in aufeinander aufbauenden Agentenmissionen kennenlernen. Erklärungen, Editor, Programmausführung und Rückmeldungen befinden sich direkt auf der jeweiligen Aufgabenseite.

**Direkt starten:** [nmsboeheimkirchen.github.io/learnpython](https://nmsboeheimkirchen.github.io/learnpython/)

## Was bietet das Projekt?

- Python-Code ohne Installation direkt im Browser schreiben und ausführen
- Schrittweise Aufgaben mit unmittelbaren, auf den aktuellen Lösungsstand bezogenen Rückmeldungen
- Ein durchgehender Lernpfad von ersten Ausgaben bis zu Schleifen, Funktionen, Turtle-Grafik und JSON
- Zwei größere Projektmissionen mit unterschiedlichen Graden an Führung
- Automatische Freischaltung der nächsten Etappen
- Lokale, versionsfest eingebundene Browserbibliotheken statt externer CDNs
- Bedienung auf Schul-Laptops und Tablets

## Lernpfad

| Abschnitt | Mission | Python-Inhalte |
| --- | --- | --- |
| 1 | System Access | `print()`, Pausen, Variablen und `input()` |
| 2 | Bombe entschärfen | Vergleiche, `if`, `elif` und `else` |
| 3 | Safe-Knacker | `while`, Zahleneingaben und `random.randint()` |
| 4 | Geheimdienst-Chat | `for`, Strings, `ord()`, `chr()` und Caesar-Verschiebung |
| Training | Drohnensteuerung | Turtle, Koordinaten, eigene Funktionen, Suchen und Sammeln |
| Projekt | PICO: Rettungssignal | Zustände, Energieplanung und eine mehrstufige Rettungsmission |
| Projekt | Pixelmuseum: Sternenfragment | Offene Routenplanung, Inventar und eine Fluchtmission |
| Abschluss | Gemeinsame Helikopterflucht | Bordcomputer, Zugangscode und JSON-Konfiguration – in Weiterentwicklung |

Die ersten vier Missionen führen neue Python-Werkzeuge nacheinander ein. Anschließend verbindet die Drohnensteuerung diese Grundlagen mit Turtle, Koordinaten und eigenen Funktionen. Danach wählen die Lernenden zwischen der geführteren PICO-Mission und dem offeneren Pixelmuseum. Beide Wege münden in die gemeinsame Helikopterflucht.

## Fortschritt und Daten

Die Anwendung benötigt derzeit weder Benutzerkonto noch Backend. Lernfortschritt und Code werden ausschließlich im lokalen Browserspeicher des verwendeten Geräts gespeichert.

Das bedeutet:

- Auf demselben Gerät und im selben Browser kann später weitergearbeitet werden.
- Zwischen verschiedenen Geräten oder Browsern findet keine Synchronisierung statt.
- Das Löschen der Browserdaten entfernt auch den gespeicherten Fortschritt.
- Über **Fortschritt zurücksetzen** in der Navigation können die lokal gespeicherten Lerndaten gezielt gelöscht werden.

## Technischer Aufbau

Die Anwendung ist eine statische Website aus HTML, CSS und JavaScript. Python läuft mit [Skulpt](https://skulpt.org/) im Browser; [CodeMirror](https://codemirror.net/5/) stellt den Codeeditor bereit. Beide Bibliotheken sowie weitere benötigte Abhängigkeiten werden aus dem Repository ausgeliefert.

```text
.
├── index.html                      # Startseite
├── mission1_*.html … mission4_*.html
│                                      Grundlagenmissionen
├── agent_training_*.html          # Drohnen- und Turtle-Training
├── projektwahl.html               # Auswahl der Projektmission
├── pico_*.html                    # PICO-Projekt
├── pixelmuseum_*.html             # Pixelmuseum-Projekt
├── helikopter_flucht*.html        # Gemeinsamer Abschluss
├── impressum.html                 # Impressum
├── assets/                        # Gestaltung, Laufzeitlogik, Bilder und Bibliotheken
├── tests/                         # Unit- und Browser-Tests
└── .github/workflows/pages.yml    # Tests und GitHub-Pages-Veröffentlichung
```

## Lokal ausführen

Für die Lernplattform selbst ist kein Build-Schritt erforderlich. Nach dem Klonen genügt ein lokaler Webserver, zum Beispiel mit Python:

```bash
git clone https://github.com/nmsboeheimkirchen/learnpython.git
cd learnpython
python -m http.server 8000
```

Danach ist die Startseite unter [http://localhost:8000](http://localhost:8000/) erreichbar.

## Tests

Für die automatisierten Tests werden Node.js und die im Projekt festgeschriebenen npm-Abhängigkeiten benötigt:

```bash
npm ci
npm test
```

Die Browser-Tests mit Playwright werden so gestartet:

```bash
npm run test:e2e
```

Die Tests prüfen unter anderem Lernpfad und Freischaltungen, Aufgabenvalidierung, gespeicherten Fortschritt, sichere Programmausgabe, die Drohnenmissionen sowie wichtige Abläufe auf Laptop- und Tablet-Größen.

## Veröffentlichung

Ein Push auf `main` startet den Workflow in [`.github/workflows/pages.yml`](.github/workflows/pages.yml). Nach erfolgreichen Logik- und Browser-Tests wird der aktuelle Stand über GitHub Pages veröffentlicht und anschließend mit einem Smoke-Test überprüft.

Offene Arbeit und geplante Erweiterungen stehen in der [Roadmap](TODO.md).

## Lizenz und Impressum

Das Projekt steht unter der [MIT-Lizenz](LICENSE). Urheber ist **Dipl. Ing. Michael Bieglmayer**.

Idee und Beratung: **Ioannis Männl BEd**

Zum [Impressum](impressum.html)
