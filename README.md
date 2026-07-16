# Python Agenten-Training

> **Direkt im Browser starten:**  
> [https://nmsboeheimkirchen.github.io/learnpython](https://nmsboeheimkirchen.github.io/learnpython)

Eine browserbasierte Python-Lernplattform für Schüler:innen. In kurzen Agenten-Missionen werden grundlegende Programmierkonzepte Schritt für Schritt erklärt, direkt ausprobiert und automatisch überprüft.

## Was bietet das Projekt?

- Python-Code direkt im Browser schreiben und ausführen
- Editor mit Syntaxhervorhebung auf Basis von CodeMirror
- Python-Ausführung mit Skulpt, ohne lokale Python-Installation
- Konkrete Rückmeldungen zu noch fehlenden Lösungsschritten
- Automatisch freigeschaltete Level und gespeicherter Lernfortschritt
- Drei Missionen mit insgesamt zehn Leveln

## Lernpfad

| Mission | Thema | Inhalte |
| --- | --- | --- |
| 1 – System Access | Erste Python-Befehle | `print()`, `import`, Pausen, Variablen und `input()` |
| 2 – Bombe entschärfen | Entscheidungen | Vergleiche, `if`, `elif` und `else` |
| 3 – Safe-Knacker | Wiederholungen und Zufall | `while`-Schleifen, Zahleneingaben und `random.randint()` |

Die Aufgaben bauen aufeinander auf. Nach erfolgreicher Ausführung wird das nächste Level freigeschaltet. Der Fortschritt wird im jeweiligen Browser gespeichert.

## Verwendung

Am einfachsten wird die veröffentlichte Version geöffnet:

[Python Agenten-Training starten](https://nmsboeheimkirchen.github.io/learnpython)

Danach:

1. Mission auswählen und die Aufgabenbeschreibung lesen.
2. Den Python-Code im Editor ergänzen.
3. **Code ausführen** anklicken.
4. Die Rückmeldung beachten und den Code bei Bedarf verbessern.
5. Nach bestandener Aufgabe mit dem nächsten Level fortfahren.

Alle benötigten Browserbibliotheken liegen versionsfest im Repository. Die veröffentlichte Website benötigt daher keine zusätzlichen Verbindungen zu externen CDNs. Die Anwendung ist für aktuelle Versionen von Chrome, Edge, Firefox und Safari ausgelegt.

## Lokal ausführen

Das Projekt ist eine statische Website und benötigt keinen Build-Prozess. Ein kleiner lokaler Webserver genügt:

```bash
python -m http.server 8000
```

Anschließend im Browser öffnen:

```text
http://localhost:8000
```

Alternativ kann jeder andere statische Webserver verwendet werden.

## Projektstruktur

```text
.
├── index.html                 # Einstieg und Weiterleitung zur ersten Mission
├── mission1_*.html            # Mission 1 mit vier Leveln
├── mission2_*.html            # Mission 2 mit drei Leveln
├── mission3_*.html            # Mission 3 mit drei Leveln
├── assets/
│   ├── vendor/                # Browserbibliotheken, Lizenzen und Prüfsummen
│   ├── style.css              # Gemeinsames Layout und Design
│   ├── editor.js              # Gemeinsame Einrichtung des Python-Editors
│   ├── navigation.js          # Gemeinsame Navigation aller Missionen
│   └── runner.js              # Python-Ausführung, Fortschritt und Validierung
├── tests/
│   └── runner.test.mjs        # Automatisierte Tests der zentralen Logik
└── .github/workflows/pages.yml
                               # Veröffentlichung über GitHub Pages
```

## Tests

Die Tests verwenden ausschließlich die in Node.js integrierten Testwerkzeuge. Mit Node.js 18 oder neuer können sie so ausgeführt werden:

```bash
node tests/runner.test.mjs
```

Geprüft werden unter anderem die Level-Validatoren, die sichere Konsolenausgabe und der Erfolgsdialog der Abschlusslevel.

## Veröffentlichung

Jeder Push auf den Branch `main` startet den GitHub-Actions-Workflow und veröffentlicht den aktuellen Stand automatisch über GitHub Pages.

## Lizenz

Dieses Projekt steht unter der [MIT-Lizenz](LICENSE).
