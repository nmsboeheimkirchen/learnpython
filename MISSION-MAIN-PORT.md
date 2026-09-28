# Missionsänderungen für die öffentliche Version

Stand: 28.09.2026. Arbeitsbranch: `dev-login-save`.
Ausgangspunkt vor diesen Änderungen: `4d8bcbe`.

**Lokal gesichert:** `a36189e` – `mission-public: implement Nullpunkt levels 1-3
and requested terminal analysis`. Dieser Commit enthält MAIN-01 bis MAIN-10,
inklusive Renderings/Vorschauen und Tests. 219 Logiktests und 35 Browserprüfungen
grün. Keine Veröffentlichung; Level 4 bleibt bis zum nächsten Umbau alter Inhalt.
Systemvertrag und privater Handoff sind als separater Dokumentationsnachtrag
geführt und gehören nicht zur öffentlichen Missionsübernahme.

## Trennung von Missionsinhalt und Kontosystem

Missionsänderungen sollen später einzeln nach `main` übernommen werden.
Dafür isolierte Commits mit Präfix `mission-public:` verwenden und ihre Hashes
hier nach dem Commit ergänzen. Kein vollständiger Merge von `dev-login-save`
nach `main`; keine vollständigen Dev-HTML-Dateien über die Main-Dateien kopieren,
weil diese schon Konto-Einbindungen enthalten können. Nur die jeweiligen Diffs
übernehmen und im statischen Gastbetrieb prüfen.

Login, zentrale Speicherung, Lehreransicht, API, Datenbank und Deployment bleiben
separat. Bestehende lokale Gastfunktionen des öffentlichen Lernpfads erhalten.
Einzelne Branches eines öffentlichen GitHub-Repositories können nicht privat sein.
Für die gewünschte Trennung ist ein separates privates Repository erforderlich.
Eine spätere Verlagerung entfernt keine bereits veröffentlichten Kopien oder Historie.
Repository-Sichtbarkeit und Remotes wurden hier nicht verändert.

## MAIN-01: Pixelmuseum vor PICO

Status: lokal umgesetzt, noch nicht committet oder veröffentlicht.

- `index.html`: Vorbereitung bleibt zuerst; danach Pixelmuseum links und PICO rechts.
- `projektwahl.html`: Pixelmuseum links, PICO rechts; bei gestapelten Karten Museum zuerst.
- `tests/e2e/project-choice.spec.mjs`: bestehende Layoutprüfung auf die neue Reihenfolge angepasst.
- Keine Änderung an Missionsprüfungen, gespeicherten IDs, Gewichten oder Konto-/Backendcode.
- Prüfung: 3/3 lokale Browserprüfungen erfolgreich (Startseite Chromium,
  Projektwahl Chromium und WebKit/iPad einschließlich Kartenposition und Zielnavigation);
  `git diff --check` ohne Fehler. Kein Hostinger-Release.

## MAIN-02: Vier kurze Stationen – Plan freigegeben, Bildphase abgeschlossen

Nutzerfreigabe am 26.09.2026: mit den beiden Renderings beginnen, danach implementieren.
Die zwei Grundrenderings sind erzeugt und im Projekt gespeichert; die neue
Missionslogik und die Einbindung der Bilder sind noch nicht umgesetzt.

Name der Mission: **Operation Nullpunkt**. Die Drohne bleibt namenlos und
wird nur als „Drohne“ bezeichnet; die Benennungsaufgabe entfällt vollständig.
**PICO** bezeichnet im aktuellen Storyentwurf den Quantenrechner des Lords.
Der Name kann als Projektname stehen, ohne ein künstliches Akronym zu erfinden.
Am Terminal eignet sich „PICO · Quantenrechner“ als Beschriftung. Der Missionsuntertitel
„Stoppe den Quantenangriff“ erklärt weiterhin das Ziel, bevor der Eigenname bekannt ist.
Kein zusätzliches Statuslevel 2a.
Aktuell bestehen bereits vier Pflichtlevels plus optionales 2a; das Umbenennen
ist Teil des Einstiegs, kein eigenes Pflichtlevel.

### Geschärfter Auftrag: Quantenangriff auf den Zahlungsverkehr

Vom Nutzer vorgegeben: Schon zu Beginn ist klar, dass der böse Lord mit seinem
Quantencomputer kurz davorsteht, die kryptografische Absicherung einer Kryptowährung
oder des Bankensystems zu knacken. Der Entwurf mit dem fiktiven Bankennetz wurde
anschließend grundsätzlich bestätigt.

Titelvorschlag: **Operation Nullpunkt – Stoppe den Quantenangriff**.
Empfehlung für den Entwurf: ein fiktives internationales Bankennetz, dessen
Sicherheitsverfahren der Lord angreift. Gefälschte Überweisungen und gestohlene
Ersparnisse machen die Bedrohung verständlich. Keine reale Bank oder Kryptowährung
als angeblich aktuell kompromittiert darstellen; der unmittelbar bevorstehende
Durchbruch ist Teil der Spielwelt.

Vorschlag für die Missionskarte:

> Mit seinem Quantencomputer PICO steht der böse Lord kurz davor, die Sicherheit
> des weltweiten Bankennetzes zu knacken. Schleuse deine Drohne in sein Rechenlabor
> und stoppe den Quantenangriff.

Vorschlag für das Einstiegsbriefing:

> Der böse Lord steht kurz vor dem Durchbruch: Sein Quantencomputer PICO soll die
> digitalen Sicherheitsschlüssel des internationalen Bankennetzes knacken.
> Damit könnte er Überweisungen fälschen und fremde Konten plündern.
> Du und deine Kollegin habt euch in seine Basis eingeschleust. Während sie das
> Sternenfragment sichert, übernimmst du das Rechenlabor. Der Computer ist vom
> Internet getrennt; deine Drohne muss direkt an seinen Wartungsanschluss.
> Stoppe die Berechnung, bevor der Lord sein Ziel erreicht.

Der Titel bezeichnet den geplanten Stillstand des feindlichen Rechners;
er ist keine Behauptung über einen physikalisch erreichten absoluten Nullpunkt.
Die Bedrohung erscheint vor der Akkuaufgabe. Dramatische Anzeigen schreiten mit
den Missionsetappen voran, ohne einen echten Zeitdruck beim Lernen aufzubauen.
Technischer Hintergrund: Digitale Signaturen sichern die Echtheit von Aufträgen;
Verschlüsselung schützt deren Vertraulichkeit. Für die angedrohten gefälschten
Überweisungen sind Signaturen bzw. ihre geheimen Schlüssel die passende Grundlage.
Quelle: [NIST: What Is Post-Quantum Cryptography?](https://www.nist.gov/cybersecurity-and-privacy/what-post-quantum-cryptography).

| Station | Vorschlag für Pflichtpunkte | Handlung |
| --- | --- | --- |
| Energieproblem | 3 | Kurzen Direktflug versuchen und den Energiestopp als Diagnose verstehen. |
| Aufladen | 4 | Energiezelle ansteuern, finden und verwenden. |
| Terminalzugang | 4 | Rechner erreichen; visuelles logisches Wartungsrätsel lösen. |
| Sabotage | 4 | Vorbereitetes fiktives Sabotageprogramm einschleusen; sichtbare Ausfallsequenz. |

Historische Rätselidee (am 28.09. durch das Quantenregister in MAIN-09 ersetzt):
Vier Module mit Symbolen in vier Plätze setzen. Hinweise:
Kreis zuerst, Stern zuletzt, Dreieck unmittelbar vor Quadrat. Eindeutige Folge:
Kreis → Dreieck → Quadrat → Stern. Das ist eine erfundene Wartungssicherung,
keine Erklärung echter Quantenprogrammierung. Auswahl per Tippen und Tastatur
neben optionalem Ziehen anbieten; Hinweise statt Zeitdruck.

Rahmenidee: Zwei Agenten sind in der Basis. Wer die Rechnermission übernimmt,
steuert vor Ort eine Drohne zum physisch abgeschotteten Wartungsanschluss;
die Kollegin sichert währenddessen das Sternenfragment. Beide treffen sich am
Helikopter. **Pixelmuseum nicht ändern** (ausdrückliche Nutzervorgabe).

Die Sabotage zerstört den fiktiven Rechner. **Rauch und ein rauschendes Display
machen den Erfolg sichtbar.** Keine eingeblendete Meldung „PICO offline.
Quantenangriff gestoppt.“ im Kamerabild oder auf dem Terminal. Erst der
Levelabschluss erklärt, dass der Computer zerstört ist, und führt zum Helikopter.
Keine Behauptung, dass „Quanten heißlaufen“. Keine zusätzliche Pflichtaufgabe
für Rückflug oder Selbstzerstörung der Drohne.

### Bildregie und fertige Grundrenderings vom 26.09. (durch MAIN-03 abgelöst)

Grundrenderings fertig, folgende Verwendung für die Implementierung vorgesehen:

- Level 1/2, überarbeiteter Bildstand V4: Raumübersicht mit Bergen und Fensterstreben
  behalten. Links jetzt eine sichtbare Ladestation mit Dock, Ladeanschlüssen und
  Energiemodulen. Rechts ein deutlich höherer, oben breiter werdender goldener
  Quantenrechner, dessen obere Bauteile aus dem Bild ragen. Goldglanz, Lichtpunkte
  und Reflexe verstärken den technischen Eindruck. Eine gebogene spiegelnde
  Schutzverglasung ohne Teilungen steht davor. In der Raummitte
  führt ein eingefasster Treppenabgang nach unten; Wege bleiben seitlich frei.
  V4 ergänzt links im unteren Drittel eine grüne Energieflasche mit weißem Blitz.
  Bei Implementierung Start-/Lade-/Terminalkoordinaten und Flugroute an V4 anpassen;
  alte Koordinaten nicht ungeprüft übernehmen. Treppenbereich beim Routing beachten.
  Diese Ansicht als taktische Übersicht bezeichnen.
- Level 3: zunächst den Anflug in derselben Übersicht zeigen. Erst am Ziel
  Wechsel auf die Drohnenkamera direkt vor dem Terminal. Der Bildschirm ist
  frontal und rechteckig, damit sich Module gut darauf verschieben lassen.
  Der goldene Rechner und seine durchgehende reflektierende Glasscheibe bleiben
  dahinter sichtbar. Das logische Rätsel liegt als bedienbare HTML-/SVG-Fläche
  über dem Terminal; Reflexe überdecken die Interaktionsfläche nicht.
  V4 ersetzt den klobigen Rahmen durch eine dünne durchgehende Glasfläche mit
  feiner weiß-mintgrüner Kante und schlankem Träger. Auch das kleine Terminal
  in der Raumübersicht wurde angeglichen.
- Verbindliche Lichtkorrektur für V3: diagonaler Helligkeits-/Farbverlauf vom
  dunklen kühlen Vordergrund links unten zum hellen goldenen PICO rechts oben.
  Goldene Leuchtquellen nur am Rechner; Ladestation, Geländer, Terminal und
  Nebenanlagen in Graphit/Stahl mit zurückhaltendem Weiß und Mintgrün.
  In der Nahaufnahme sind Fenster- und Lichtspiegelungen im gebogenen Schutzglas
  deutlich sichtbar. Keine horizontalen Streben oder Teilungsringe vor dem Rechner.
- Level 4: dieselbe Kameraperspektive weiterverwenden. Rauch und Bildschirmrauschen
  zeigen die Folge der Sabotage. Der Rechner bleibt neben dem Terminal im Bild.
- Bildumfang dieser ersten Phase: eine gezielte Überarbeitung des vorhandenen
  Raumbilds und eine neue Terminalansicht. Ausfalleffekte folgen bei der Umsetzung.
  Kleine Kamerakennung und Akkustand genügen; Rätseltext bleibt stabil und lesbar.

| Asset | Ergebnis |
| --- | --- |
| `assets/images/finales/pico-quantum-lab-v4.webp` | 1672 × 941, 295584 Bytes; zusätzlich grüne Energieflasche mit weißem Blitz links unten, modernes kleines Terminal. |
| `assets/images/finales/pico-quantum-terminal-v4.webp` | 1672 × 941, 311470 Bytes; dünne Glaseinfassung, breites frontales Display, Glasreflexe am goldenen Rechner. |

Mit eingebautem Imagegen erzeugt und visuell geprüft; als WebP ohne Beschnitt
konvertiert. V1–V3 und das ursprüngliche Bild sind als ältere Entwürfe erhalten;
Dieser V4-Bildstand wurde am 27.09. durch die Kommandozentrale aus MAIN-03 abgelöst.
Vollständige Prompts und Herkunft:
[PICO-ART-PROMPTS.md](PICO-ART-PROMPTS.md). Noch kein Commit, Push oder Deployment.
Diese Assets und öffentliche Missionsdiffs gehören später in `mission-public:`-Commits;
Konto-/Backendänderungen gehören nicht dazu.

Die eigenständige Layoutprobe `prototypes/pico-terminal-fit.html` gehört zum
öffentlichen Missionsentwurf und greift auf keine Lernstandsspeicherung zu.
Vier Module und vier Zielplätze passen auf das breite Display: geprüft bei
1366 × 768, 768 × 1024 (WebKit), 701 × 900 und 390 × 844 Pixel Viewportgröße.
Bedienziele mindestens 44 Pixel, auf dem Handy unterhalb des Kamerabilds.
Tastaturabschluss und Ziehen geprüft. Bei Umsetzung die Terminalansicht über
die verfügbare Inhaltsbreite öffnen; im bisherigen geteilten Codeeditor-Layout
wäre das Display zu klein. Hinweise außerhalb des Bildschirms halten und die
Szenenhöhe für Laptops begrenzen, damit Hinweise gleichzeitig sichtbar bleiben.
Der Flaschenfuß liegt im Bild ungefähr bei (204, 629); Fundpunkt daran ausrichten.

### Wissenschaftliche Einordnung der Spielhandlung

Shors Algorithmus zeigt mathematisch, wie ein hinreichend großer, zuverlässiger
Quantencomputer Faktorisierung und diskrete Logarithmen effizient lösen kann.
Damit ist die Bedrohung entsprechender heutiger Public-Key-Verfahren begründet.
Ungewiss ist die praktische Realisierung der nötigen Hardware und ihr Zeitpunkt.
NIST beschreibt am 30.07.2026 verfügbare Quantencomputer als noch zu klein und
instabil für solche Angriffe. Post-Quanten-Verfahren bieten bereits eine
standardisierte Gegenstrategie; Quantencomputer brechen nicht jede Kryptografie.

Für die Geschichte besitzt der Lord einen geheimen, besonders weit entwickelten
Prototyp. Die Fähigkeit zum unmittelbar bevorstehenden Angriff ist Science-Fiction
auf realer algorithmischer Grundlage. Als konkretes Ziel passen geheime
Signaturschlüssel für Zahlungsaufträge, kein universeller Schlüssel für jede Bank.

Quellen: [Shors Originalarbeit](https://arxiv.org/abs/quant-ph/9508027),
[NIST, Forschungsstand vom 30.07.2026](https://www.nist.gov/blogs/taking-measure/quantum-computers-may-put-internet-traffic-risk-nist-safeguarding-computers-new).

## DEV-ONLY: Kompatibilität vor einem Missionsumbau klären

Für die lokale Umsetzung vom 28.09. ist die Zuordnung in MAIN-09 festgelegt:
historischen Levelabschluss erhalten, aber keinen neuen Registerzustand daraus
ableiten. Neue Durchläufe zählen erst nach Anflug und korrektem Register.

README, ACCOUNT-SYSTEM.md (besonders Abschnitt 12) und aktuellen LOGIN-HANDOFF.md
beachten. Das Umbenennen der Mission darf bestehende Lernstände nicht verlieren.
Alte erfolgreiche Lösungen dürfen zugleich nicht ungeprüft als gelöstes neues
Terminalrätsel gelten. Vor Umsetzung Zuordnung/Versionierung der Abschlüsse
und Umgang mit alten gespeicherten Python-Lösungen ausdrücklich festlegen.

Aktuelle PICO-Gewichte: viermal 3,75 Punkte; 2a zählt nicht zum Pflichtfortschritt.
Die vorgeschlagenen 3/4/4/4 ergeben ebenfalls 15 Punkte, verändern aber Teilstände.
Ein Rätsel ohne Python braucht einen passenden Abschlussnachweis über die vorhandene
Lernstandsschnittstelle. Solche Speicheranpassungen gesondert von öffentlichen
Missionsänderungen behandeln; keine versteckten Datenmigrationen in MAIN-02.

## MAIN-03: Kommandozentrale, Drohnenkamera und drei Ausfallstufen

Stand 27.09.2026: lokal als eigenständige Bildvorschau umgesetzt; kein Commit,
Push, Deployment oder Eingriff in produktive Missionslogik.

Die zwei vom Nutzer gelieferten Innenansichten ersetzen die Bergpanorama-Renderings
als aktuelle Bildgrundlage. PICO steht im Inneren der Kommandozentrale des Lords;
Sitzbereich, Kartenwand und Zugang lassen den Raum bewohnt wirken. Die rote
Raumbeleuchtung dieser neuen Referenz hat Vorrang vor der früheren Weiß-/Grün-Vorgabe.
Der Alarm setzt sich davon durch Pulsieren und den Ausfall anderer Lichtquellen ab.

Öffentliche Dateien für eine spätere selektive Übernahme:

- `assets/images/finales/pico-command-lab-v1.webp`
- `assets/images/finales/pico-command-terminal-v1.webp`
- `assets/images/finales/pico-command-failure-1.webp`
- `assets/images/finales/pico-command-failure-2.webp`
- `assets/images/finales/pico-command-failure-3.webp`
- `prototypes/pico-drone-camera.html`, `.css`, `.js`
- `prototypes/pico-terminal-fit.html`: Bildreferenz und Alternativtext auf Innenansicht aktualisiert.
- `PICO-CAMERA-PROMPTS.md`: Herkunft, vollständige Prompts und Effektbeschreibung.

Ablauf: Normalbetrieb → erste Rauchfahnen → dichterer Rauch, Störungen und
teilweise dunkle Anzeigen → dunkler Rechner, erloschene weiße Leuchten und
rauschendes Terminal. Keine Erfolgsmeldung im Kamerabild. Akku, Steuerverbindung
und Kameramarkierungen liegen als eigene Oberfläche darüber. Illustrative
Anzeige, keine echten Telemetriedaten und keine Speicherung.

Vier Bilder werden bei gleicher Perspektive überblendet. Rauch steckt in den
generierten Stufen; roter Lichtpuls und zusätzliches Terminalrauschen werden
animiert. Bewegung ist abschaltbar und berücksichtigt reduzierte Bewegung.
Die neue Raumübersicht verschiebt die Energieflasche an den linken Rand;
Flugroute und Fundpunkt bei der Missionsintegration neu ausrichten.

Prüfung: Chromium 1366 × 768 und 390 × 844, WebKit 768 × 1024. Alle vier Zustände,
Bildladung, Zwischenüberblendung, Anzeigenumschaltung und Überlauf geprüft;
Bedientasten mindestens 44 Pixel. Zusätzlich vollständiger Ablauf, Lichtpuls,
reduzierte Bewegung und Tastaturbedienung geprüft. Keine Browserfehler.
Pixelmuseum, Backend, Lernstands-IDs und Fortschrittsgewichte bleiben unverändert.
Die Vorschauseiten werden durch den bestehenden statischen Build nicht veröffentlicht.

## MAIN-04: Missionsübersicht und Level 1 lokal umgesetzt

Stand 27.09.2026. Kein Commit, Push oder Deployment. Aktueller Auftrag lokal fertig;
regelmäßige Checkpoints stehen oben in `LOGIN-HANDOFF.md`.

Level 1 heißt **Stoppe den Quantenangriff!**. Der Auftrag ist, die Drohne zu PICO
zu steuern. Der Einstieg verrät das Energieproblem nicht. Erst ein ausgeführter
Flugauftrag zum tatsächlichen Wartungsterminal mit anschließendem Akku-Stopp
schließt Level 1 ab. Kein Drohnenname, kein zusätzlicher Flug zur Energiezelle.
Leerer Code, gedruckte Erfolgsmeldungen und andere Flugziele reichen nicht.

Die neue Kommandozentrale wird produktiv in Level 1 verwendet. Ein eigener
SVG-Quadrocopter samt Flugspur folgt den tatsächlichen Python-Laufzeitpositionen;
die darunterliegende Turtle dient nur als Bewegungsengine und ist unsichtbar.
Akku und Koordinaten aktualisieren sich während des Flugs. Zurücksetzen lädt
den Startcode und setzt Darstellung und Akku zurück, ohne Lernstände zu löschen.

Öffentliche Missionsdateien für spätere selektive Übernahme:

- `pico_level1.html`
- `assets/nullpunkt-level1-core.js`, `assets/nullpunkt-level1.js`, `assets/nullpunkt-level1.css`
- `assets/images/finales/pico-command-lab-v1.webp` aus MAIN-03
- `assets/navigation.js`: neuer Missionsname, vier geplante Leveltitel, 2a aus Übersicht entfernt.
- `index.html`, `index-b.html`, `projektwahl.html`: Name, Auftrag und Bild erneuert;
  Museum vor Nullpunkt, Museum-Inhalte unverändert. Die B-Startseite bleibt eine Kopie der öffentlichen Startseite.
- `assets/data/course-progress.js`: ausschließlich sichtbare Bezeichnungen geändert;
  keine IDs, Gewichte oder Rechenregeln geändert.
- `assets/teacher-solutions.js`: neue Lösung `nullpunkt_level1`; alte Lösungen bleiben verfügbar.
- `assets/runner.js`: Text des Level-1-Erfolgs aktualisiert, Speicheradapter unverändert.
- `assets/drone-mission.js` und `assets/pico-mission.js`: bedingte Codeübernahme
  erst nach Datenbereitschaft; alter Level 2 erbt keinen neuen Nullpunkt-Starter.
- `tests/nullpunkt-level1-core.test.mjs`, `tests/e2e/nullpunkt-level1.spec.mjs`,
  `tests/all.test.mjs`, angepasste Assertions in `tests/runner.test.mjs`,
  `tests/e2e/pico-path.spec.mjs` und `tests/e2e/project-choice.spec.mjs`.
- `README.md`: Projektname aktualisiert. Handoff bleibt Dev-Dokumentation.

Kompatibilität: `pico_level1_navigation` bleibt stabil. Bereits erreichte
Level-1-Abschlüsse bleiben gültig, alte Versuche und Lösungen unverändert erhalten.
Beim Wiederherstellen wird kein neuer Flug und keine erfundene Telemetrie erzeugt.
Eigene gespeicherte Level-2-Lösungen/Versuche haben Vorrang vor jedem Starter.
Kein neuer direkter Speicherzugriff, keine Datenmigration, keine Backendänderung.

Grenze dieser Etappe: Die Übersicht benennt schon den Zielplan, Level 2–4 selbst
bleiben technisch der alte Pfad. Das optionale 2a bleibt über seine alte URL
erreichbar. Gewichte weiterhin 3,75 je Pflichtlevel; 3/4/4/4 zusammen mit dem
restlichen Umbau umstellen. Für Level 2 müssen Fundpunkt und Flugbudget an die
neue Flasche angepasst werden (rund 167 Einheiten vom Start, aktuell Budget 145).

Prüfung: 210/210 Logiktests; 13/13 Browserprüfungen für Level 1, Auswahl und alte
Folgelevels; abschließend 8/8 für Level 1 und Startseite nach UI-Statuskorrektur.
Chromium, WebKit/iPad, Handybreite, echte Animation, erfolgreicher/fehlender/falscher
Flug, Scheinausgabe, Speicherung, Reload, Reset, bestehender Altabschluss und
Übergang zu Level 2 geprüft. Start- und Handyansicht visuell kontrolliert.

## MAIN-05: Raumbild V2, Zahlungssystem und Akku links oben

Nutzerkorrektur vom 27.09.2026, lokal auf `dev-login-save`:

- Neue Raumübersicht aus `ChatGPT-Bild 27. Sept. 2026, 14_57_17.png`, ohne Beschnitt
  als `assets/images/finales/pico-command-lab-v2.webp` (1672 × 941, WebP Qualität 94).
  Kühles Licht an Decke und Eingang; der goldene Rechner bleibt der Blickfang.
- Referenzen in `pico_level1.html`, `index.html`, `index-b.html`, `projektwahl.html`
  und dem Raumübersicht-Link in `prototypes/pico-drone-camera.html` aktualisiert.
- „Zahlungssystem“ / „Zahlungssystems“ ersetzt den bisherigen Begriff in den vier
  produktiven HTML-Dateien einschließlich der Level-1-Metabeschreibung.
- `assets/nullpunkt-level1.css`: Akku-HUD links oben, inklusive Handyansicht.
- Bestehende Bildreferenz-Prüfung in `tests/runner.test.mjs` angepasst;
  Herkunft und aktueller Bildstand in `PICO-CAMERA-PROMPTS.md` festgehalten.

Dies sind ausschließlich öffentliche Darstellungs- und Textänderungen für spätere
selektive Übernahme. Altes Raumbild bleibt historisch erhalten. Keine Änderung
an Fluglogik, Speicherverhalten oder Backend.

Prüfung: 3/3 bestehende Browserprüfungen (Chromium, WebKit/iPad, Handybreite),
2/2 bestehende Startseitenprüfungen grün. Laptop- und Handyansicht visuell geprüft;
neues Bild geladen, Akku links oben und keine Überdeckung der Startdrohne.

## MAIN-06: Akkuwarnung mit Pause und kompaktere PICO-Editoren

27.09.2026, lokal fertig auf `dev-login-save`. Öffentliche Missionsänderungen:

- `pico_level1.html`, `assets/nullpunkt-level1.js`, `assets/nullpunkt-level1.css`:
  Beim tatsächlichen Akku-Stopp erscheint „Akku: kritischer Zustand!“ quer über
  dem Zentralenbild. Langsames rotes Pulsieren für sieben Sekunden, bei reduzierter
  Bewegung statisch. Ein kurzer, lokal synthetisierter Web-Audio-Warnton (270 ms)
  pro Flug. Audio wird durch den Startklick/Tastaturstart freigegeben.
- Erst nach sieben Sekunden wird ausgewertet, der nächste Level freigeschaltet
  und der bestehende Erfolgsdialog angezeigt. Alle Startvarianten sind während
  dieser Zeit gesperrt; Stoppen/Reset beendet die Wartephase ohne späten Erfolg.
  Auch eine falsche Route kann den Akku entleeren und warnt, erfüllt aber den
  Auftrag weiterhin nicht. Bestehende Abschlüsse lösen keinen Alarm beim Laden aus.
- Der separate Akku-Erklärblock unter dem Bild entfällt. Level 1 hat einen kurzen
  Auftrag direkt vor den oberen Steuerelementen statt einer doppelten Überschrift.
- Neues `assets/nullpunkt-layout.css`, eingebunden in `pico_level1.html`,
  `pico_level2.html`, `pico_level2a.html`, `pico_level3.html`, `pico_level4.html`:
  kompakte Abstände und Hinweise, zusätzliche Start-/Resetknöpfe oberhalb des Codes.
  Dekorative Editor-Überschriften entfernt. Diese Gestaltung für den späteren
  inhaltlichen Umbau von Level 2–4 beibehalten; deren Missionslogik bleibt vorerst alt.
- `assets/drone-mission.js`: optionale `beforeFinish`-/`onRunCancel`-Haken und
  individuelle Beschriftung zusätzlicher Startknöpfe. Bestehende Speicheradapter
  bleiben unverändert; kein Schemawechsel oder Eingriff in Konten/Backend.
- `tests/e2e/nullpunkt-level1.spec.mjs`: Alarmdauer, ein Tonaufruf je Entleerung,
  Abbruch/Neustart, obere Knöpfe und kompakter Editor geprüft. Pixelmuseum unverändert.

Prüfung: 210/210 Logiktests, 14/14 Browserprüfungen. 6999 ms noch gesperrt,
ab 7000 ms Fortsetzung; Chromium und WebKit/iPad, Handy und reale Fluganimation,
Lernstandserhalt und alte Folgelevels grün. Laptop-, Handy- und Alarmbilder visuell
geprüft. Kein Commit, Push oder Deployment; Handoff enthält Fortsetzungsstand.

## MAIN-07: Level 2 – Finden und aufladen

27.09.2026 lokal fertig, Branch `dev-login-save`. Der neue Flug beginnt bewusst
erneut am Zugang mit 10 % Startenergie: Die Lernenden planen die Route nach dem
gescheiterten Direktflug neu. Ziel ist zuerst die Energieflasche links unten bei
(-455, -85). Die Flasche enthält eine Energiezelle, die beim Aufnehmen automatisch
an den Akku angeschlossen wird. PICO ist weiterhin der Rechner, die Drohne namenlos.

Lernfolge: Route mit `fahre_zu`, tatsächliche Suche vor Ort mit `drohne.suche_hier()`,
Fund mit `print` ausgeben, nach der Suche in `ausruestung` aufnehmen. Erfundenes
Inventar ohne Suche, falscher Fundort, fehlende Ausgabe oder fehlende Aufnahme
erfüllen den Auftrag nicht. Nur eine Zelle verfügbar, kein wiederholtes Nachladen.
Bei leerem Akku ist ein neuer Anlauf nötig. Es wird kein Codeinhalt als Flug simuliert.

Die Anzeige lädt sichtbar in zwei Sekunden auf und hält den Endstand kurz fest,
bevor der Erfolgsdialog mit vier Goldmünzen erscheint. Weiter geht es direkt zu
Level 3. Die frühere Zwischenstation 2a ist nicht mehr Teil dieses Ablaufs.
Kompakte Anweisung, aufklappbare Hilfe, Start-/Resetknöpfe über und unter dem Code,
Akku links oben und gemeinsames SVG-Drohnensymbol bleiben erhalten.

Öffentliche Dateien für die spätere selektive Übernahme:

- `pico_level2.html`: neue Kommandozentrale, Lernauftrag, Startcode und Ziel Level 3.
- `assets/nullpunkt-level2-core.js`: Ort, Suchergebnis, Ausgabe und anschließende
  Aufnahme prüfen; Fund verfällt beim Entfernen, einmaliges Laden und Reset.
- `assets/nullpunkt-level2.js`, `assets/nullpunkt-level2.css`: Laufzeitkonfiguration,
  Ladesequenz, Hilfe, vier Münzen, Abbruch ohne verspätete Erfolgsmeldung.
- `assets/nullpunkt-drone.js`, `assets/nullpunkt-drone.css`: gemeinsame Darstellung
  und sieben Sekunden lange Akkuwarnung aus Level 1 herausgezogen. Ersetzt die
  frühere `assets/nullpunkt-level1.css`; Rotoren am Bildrand nicht abschneiden.
- `assets/nullpunkt-level1-core.js`: gemeinsame Startkalibrierung auf 180 Einheiten
  statt 145. Die rund 167 Einheiten entfernte Flasche ist erreichbar; der Direktflug
  zu PICO scheitert weiterhin. Ladezustand für Level 2 ergänzt.
- `assets/nullpunkt-level1.js`, `pico_level1.html`: gemeinsame Ansicht eingebunden;
  Level-1-Auftrag und Alarmdauer unverändert.
- `assets/drone-mission.js`: Python-Schlusszustand vor optionaler Animationspause
  synchronisieren, auch wenn eine weitere asynchrone Bewegung vor der Aufnahme lag.
- `assets/pico-mission.js`: altes 2a/3/4 übernimmt keinen neuen Nullpunkt-Code als
  Starter. Eigene gespeicherte Versuche und Abschlüsse gehen weiterhin vor.
- `assets/teacher-solutions.js`: neue Lösung `nullpunkt_level2`, alte Lösung bleibt.
- `tests/nullpunkt-level2-core.test.mjs`, `tests/e2e/nullpunkt-level2.spec.mjs`,
  Anpassungen in `tests/all.test.mjs`, `tests/runner.test.mjs`,
  `tests/e2e/nullpunkt-level1.spec.mjs`, `tests/e2e/pico-path.spec.mjs`.

Bestandsschutz: Level-ID `pico_level2` bleibt stabil. Eigene alte Versuche werden
unverändert geladen; bestehende Abschlüsse bleiben gültig. Beim Laden wird keine
erfundene Ladung abgespielt. „Startcode laden“ öffnet den neuen Starter. Keine neuen
direkten Speicherzugriffe, keine Backendänderung oder Migration. Fortschrittsgewichte
bleiben bis zum vollständigen Umbau unverändert; sichtbare Belohnung Level 2: vier Münzen.
Pixelmuseum unverändert. Level 3/4 sind noch der alte Pfad, ihr neuer Inhalt folgt.

Prüfung: 214/214 Logiktests und 22/22 Browserprüfungen grün (Chromium, WebKit/iPad).
Echte Animation, Aufnahme nach weiterer Bewegung, Ladestand, Ausgabeprüfung,
Scheinlösungen, Abbruch/Reset, Speicherung/Reload, alte Abschlüsse und Übergänge
geprüft. Laptop-, Lade- und Handyansicht visuell kontrolliert, kein horizontaler
Überlauf. Kein Commit, Push oder Deployment; aktueller Handoff oben in `LOGIN-HANDOFF.md`.

## MAIN-08: Level 2 – zwei Lernschritte und gezielte Zentralenhilfe

28.09.2026, lokal auf `dev-login-save`, ergänzt/ersetzt die Aufgabenhilfe aus MAIN-07.
Erster Auftrag: zur Flasche fliegen, Fund speichern und ausgeben. Nur diese beiden
Codebeispiele sind aufklappbar. Nach tatsächlichem Such-/Ausgabeerfolg erscheint
Schritt 2; der eigene Code bleibt erhalten. Noch keine Münzen, Freischaltung oder
Abschlussspeicherung. `ausruestung = []` steht nicht mehr im Starter.

Die Zentrale erklärt zunächst den Zusammenhang zwischen Variable, Fund und Liste.
Hinweis 2 zeigt die leere Liste und erklärt `append`; Hinweis 3 nennt erst nach
einem erfolgreichen Programmlauf mit gültiger Liste den vollständigen Aufnahmecode.
Akzeptierte Namen: ausruestung, AUSRÜSTUNG, Ausrüstung, Ausruestung, AUSRUESTUNG.
Ein HUD-Feld rechts neben dem Akku zeigt den tatsächlichen Namen und Listeninhalt.
Fehlender/falscher Name und eine spätere Leerzuweisung, die den Fund wieder entfernt,
erscheinen rot links neben „Schritt 2“. Die Liste darf zunächst weiter unten stehen;
entscheidend für die Aufnahme sind ausgeführte Liste, tatsächliches append und Fundort.

Skulpt 1.2 akzeptiert die Umlautnamen nicht direkt. Eine eng begrenzte Umsetzung
normalisiert nur die zwei erlaubten Umlaut-Bezeichner zur Ausführung; Kommentare,
Strings, Editor und gespeicherter Originalcode bleiben erhalten. Fehlermeldungen
übersetzen interne Namen zurück. Keine Herstellerdatei oder Speicherstruktur ändern.

Öffentliche Dateien: `pico_level2.html`, `assets/nullpunkt-level2.js/.css`,
`assets/nullpunkt-level2-core.js`, `assets/nullpunkt-python-names.js`,
`assets/drone-mission.js` (optionale Ausführungs-/Fehlerformatierung),
`tests/nullpunkt-level2-core.test.mjs`, `tests/e2e/nullpunkt-level2.spec.mjs`.
Lernschritt und Hinweisstufe bleiben seitenlokal. Nach Neuladen bleibt der Versuch
erhalten und die Suche kann erneut ausgeführt werden. Alte Abschlüsse bleiben gültig.

## MAIN-09: Level 3 – Anflug, Terminalkamera und Quantenregister Q-04

28.09.2026 lokal umgesetzt. Geladene Drohne startet an der Energieflasche (-455,-85),
Ziel ist das PICO-Terminal (220,15). Erst der tatsächliche Anflug schaltet zur
vorhandenen Kamera-Nahaufnahme um. Die vier Pfeile sind per Touch, Maus und Tastatur
umschaltbar. Auf kleinen Bildschirmen liegt die gut bedienbare Registerfläche unter
dem Kamerabild. Der frühere Symbolentwurf ist damit überholt.

„QUANTENREGISTER Q-04“, Werte ↑=+1/↓=−1, „PRÜFDATEN“, keine Aussage über physikalische
Messungen. Zufällige Varianten umfassen 14 unterschiedliche Zielkonfigurationen;
ausgeschlossen sind nur alle Pfeile hoch bzw. alle runter. Zwei Produkte, die
Gesamtsumme und eine einfache Zweier-Summe oder -Differenz bestimmen jeweils genau
eine Lösung. Alle erzeugbaren Varianten sind gegen alle 16 Eingaben geprüft.
Fehler zeigen ausschließlich die Zahl erfüllter Bedingungen. Nach zwei Fehlversuchen
kann Zentralenhilfe in drei Schritten angefordert werden. Neue Flüge erzeugen ein
neues Register. Vier Münzen und Abschluss erst nach richtigem Register, dann Level 4.

Öffentliche Dateien: `pico_level3.html`, `assets/nullpunkt-level3.js/.css`,
`assets/nullpunkt-register-core.js`, `assets/nullpunkt-level1-core.js`
(optionaler Startort/Ladezustand; bestehende Level-1/2-Standardwerte bleiben),
`assets/teacher-solutions.js`, `tests/nullpunkt-register-core.test.mjs`,
`tests/e2e/nullpunkt-level3.spec.mjs`, Anpassungen in `tests/all.test.mjs`,
`tests/runner.test.mjs`, `tests/e2e/nullpunkt-level2.spec.mjs`, `tests/e2e/pico-path.spec.mjs`.

Kompatibilitätsentscheidung: stabile ID `pico_level3`, historische Abschlussgutschrift
und eigener Code bleiben erhalten. Wiederherstellen zeigt „bereits geschafft“, erzeugt
aber weder einen Flug noch einen gelösten Registerzustand. Neue Abschlüsse werden
erst nach tatsächlichem Anflug und Registerprüfung über die vorhandene Schnittstelle
gespeichert, mit unverändertem Flugcode. Kein zweiter Speicher, keine Backendänderung,
keine Migration und keine neue Behauptung eines manipulationssicheren Prüfungsnachweises.
Ein nach dem Flug geänderter Code kann nicht über die Registertaste abgeschlossen werden.
Das noch alte Level 4 erbt den neuen Flugcode nicht. Sein fachlicher Umbau folgt separat.

Prüfung: 218/218 Logiktests, 31/31 Browserprüfungen grün. Nach abschließender
Tablet-Layoutkorrektur 7/7 Level-3-Prüfungen erneut grün, inklusive geometrischer
Begrenzung der Registerinhalte. Laptop, iPad und Handy visuell geprüft.
Keine aktiven Tests; lokale Vorschau läuft. Kein Commit, Push oder Release.

## MAIN-10: Flugbefehle, Prüfhaken und Analyse auf Anfrage

28.09.2026. Ersetzt die ältere Hilfelogik aus MAIN-09. Beim Öffnen, nach einer
Prüfung und nach Pfeiländerungen erscheint kein automatischer Hinweis. Oberhalb
der Kamera steht „Hilfe von der Zentrale anfordern“, nutzbar nach einem Test.
Die erste Anfrage enthält den allgemeinen Hinweis, Q1 bis Q4 durch die eigenen
Pfeilwerte zu ersetzen und nachzurechnen. Die Analyse zeigt ausschließlich
erfüllte Prüfzeilen mit den tatsächlich eingesetzten Zahlen, je eine Zeile mit
„Korrekt“. Darunter steht die Zahl der Kombinationen, die diese korrekten
Bedingungen noch zulassen. Keine vorgegebene Zielverteilung, keine nächste
Änderung und kein „Denkspur“. Jede erneute Analyse erfordert eine neue Prüfung;
sie bleibt auch nach drei Anfragen möglich. Hilfe und Prüfhaken veralten bei
einer Pfeiländerung sofort. Die Hilfe bleibt rein seitenlokal.

Jede erfüllte Prüfbedingung erhält einen grünen Haken. Bei vier Treffern bleiben
alle vier Haken genau 3000 ms stehen, bei gesperrter Eingabe. Erst danach zeigt
das Terminal UNLOCKED und speichert den Abschluss über die bestehende Schnittstelle.
Der Münzdialog folgt erst auf „Weiter zu Level 4“. Reset/Neustart brechen eine
ausstehende Freigabe ab; geänderter Flugcode kann damit nicht abgeschlossen werden.

Alle aktiven PICO-Starter und Lehrerbeispiele nutzen jetzt `fliege_zu`.
Gespeicherte eigene Funktionen und historische Prototypen werden nicht umgeschrieben.
Öffentliche Änderungen: `pico_level1/2/2a/3/4.html`, `assets/nullpunkt-level1.js`,
`assets/nullpunkt-level3.js/.css`, `assets/nullpunkt-register-core.js`,
`assets/teacher-solutions.js` sowie zugehörige Logik- und Browsertests.
Backend, Speicheradapter und Level-IDs bleiben unverändert. Level 4 enthält noch
den bisherigen Missionsablauf; der Sabotageumbau folgt separat.

Der Nutzer hat den lokalen Commit der bisherigen Missionsarbeit freigegeben.
MAIN-01 bis MAIN-10 bilden den öffentlich übertragbaren Missionsstand. Historische
Angaben „noch nicht committet“ oben beschreiben frühere Zwischenstände. Kein Push,
kein Release und keine Übernahme nach main. Commit-Zuordnung steht oben.

Abschlussprüfung: 219/219 Logiktests und 35/35 Browserprüfungen erfolgreich
(Chromium-Schullaptop, WebKit/iPad, Handyansicht). Geprüft sind fehlende automatische
Hinweise, eingesetzte Zahlen, korrekte Restmengen, Testsperre zwischen Anfragen,
einzelne Haken, genau drei Sekunden vor UNLOCKED, Reset, Altstände und Übergänge.
Laptop-, iPad- und Handy-Bilder visuell geprüft. Vorschau auf Port 4173 aktiv.
