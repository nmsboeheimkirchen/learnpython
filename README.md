# AGENT PY – Python Agenten-Training

Eine browserbasierte Lernplattform, in der Schüler:innen Python durch aufeinander aufbauende Agentenmissionen lernen: Erklärung, Editor, Programmausführung und Rückmeldung auf einer Seite, für Schul-Laptops und Tablets.

**Mit Schulkonto:** [agentpy.bildungdigital.at](https://agentpy.bildungdigital.at/)

**Statische Gastversion:** [GitHub Pages](https://nmsboeheimkirchen.github.io/learnpython/)

## Lernangebot

System Access, Bombe entschärfen, Safe-Knacker und Geheimdienst-Chat vermitteln Ausgaben, Variablen, Eingaben, Bedingungen und Schleifen. Im Agententraining folgen Koordinaten und eigene Funktionen. Danach stehen PICO und Pixelmuseum als Projektwege zur Verfügung; beide führen zur gemeinsamen Helikopterflucht, deren letzte zwei Levels noch in Entwicklung sind.

Python läuft mit lokal eingebundenem [Skulpt](https://skulpt.org/) im Browser; [CodeMirror](https://codemirror.net/5/) stellt den Editor bereit. Für die Lernseiten ist keine lokale Python-Installation nötig.

## Konten und Speicherung

- **Gast:** Code und Fortschritt bleiben in diesem Browser. Kein Geräteabgleich; gelöschte Browserdaten können den Stand entfernen.
- **Schulkonto auf Hostinger:** zentraler Lernstand, mit derselben E-Mail auf anderen Geräten nutzbar. Neuanmeldung erfolgt über einen Klassencode; E-Mail-Bestätigung und Passwort-Wiederherstellung sind eingebunden.
- Gaststand und Kontostand werden nicht automatisch zusammengeführt. Mit vorhandenem Stand führt „Setze fort“ zur Missionsübersicht.
- Konto- und Lehreransicht verwenden dieselbe Fortschrittsberechnung. Optionale Aufgaben und das zweite Projekt bringen Bonus, ersetzen aber keine Pflichtaufgaben.

## Lehrer:innen-Backend

Unter **Personenmenü → Meine Klassen** verwalten freigeschaltete Lehrkräfte eigene und gemeinsam unterrichtete Klassen: Klassenname, zeitlich begrenzter Beitrittscode, Schülerplätze, Anmeldestatus und kapitelweiser Lernfortschritt. Schülernamen und E-Mail-Adressen können korrigiert und unbestätigte Adressen bestätigt werden.

Der Klasseninhaber verwaltet Codes, Löschungen und zusätzliche Lehrkräfte. Gemeinsame Klassen zählen nur zu seinem Klassenlimit. Beim Entfernen/Löschen werden weitere Klassenzugehörigkeiten und Lehrerrollen berücksichtigt, damit nicht versehentlich weiterhin benötigte Konten und Lernstände verloren gehen.

Der Superadmin verwaltet Lehrereinladungen und Klassenlimits. Der neuere Entwicklungsstand ergänzt Klassenbesitzübertragung, Verlassen gemeinsamer Klassen, Rollenentzug, globale Kontenverwaltung und Schülertransfer: **verschieben** oder **zusätzlich zuordnen**, bei fremdem Inhaber erst nach Zustimmung. Diese Ergänzungen sind noch nicht sämtlich veröffentlicht; der [aktuelle Handoff](LOGIN-HANDOFF.md) nennt den verbindlichen Live- und Teststand.

Alle Detailregeln, Berechtigungen, Sonderfälle und zugehörigen Tests stehen im unten verlinkten Systemdokument. Diese README bleibt bewusst der Überblick.

## Entwicklung und Veröffentlichung

Die statischen Lernseiten lassen sich mit einem lokalen Webserver öffnen. Für Tests: `npm ci`, anschließend `npm test`; weitere Befehle für Browser, PHP-API und Hosting stehen in [package.json](package.json) und im Systemdokument.

Auf `dev-login-save` läuft [Application tests](.github/workflows/tests.yml) ohne Pages-Veröffentlichung. `main` veröffentlicht die geprüfte statische Version über [GitHub Pages](.github/workflows/pages.yml). Hostinger-Releases werden separat mit privaten Backenddateien, Datenbankmigration und Bestandsprüfung bereitgestellt.

Weiterführend: [Roadmap](TODO.md) · [Hostinger-Betrieb](HOSTINGER-DEPLOY.md) · [Arbeitsübergabe](LOGIN-HANDOFF.md).

## Lizenz und Impressum

Das Projekt steht unter der [MIT-Lizenz](LICENSE). Urheber ist **Dipl. Ing. Michael Bieglmayer**.

Idee und Beratung: **Ioannis Männl, BEd**

Zum [Impressum](impressum.html)

[**Datenhaltung, Login, Lehrer:innenverwaltung und Superadmin: vollständige Systemregeln, Sonderfälle, Rechte und Tests**](ACCOUNT-SYSTEM.md)
