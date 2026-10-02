# PICO – Kommandozentrale und Drohnenkamera

Stand: 02.10.2026. Arbeitsbranch: `dev-login-save`. Öffentliche Missionsgrafiken; keine Änderungen an Login, Backend oder Lernstand.

## Aktuelle Bildgrundlage

Die vom Nutzer bereitgestellten Bilder ersetzen die Bergpanorama-Entwürfe als
aktuelle Grundlage. PICO steht im Inneren der Kommandozentrale des Lords.
Raumübersicht V3 zeigt Finanzanzeigen, ein schwarzes Sofa und zwei Reihen
Goldbarren auf einer Palette rechts vorne. Imagegen verfeinerte Kanten,
Materialien und Spiegelungen bei gleicher Perspektive und Anordnung.
Terminal-Nahaufnahme V3 übernimmt diese Lichtstimmung und Ausstattung. Die drei
Haftnotizen zeigen schnelle Kugelschreiber-Handschrift: ₿ und einen Hash ohne
Nullenkette, US National Reserve und Shanghai Digital Vault / 上海数字金库 mit
fiktiven Nummern. Level 3/4 nutzen V3; separate Rauch-, Licht- und Displayebenen
bleiben erhalten. [Aktueller Prompt](PICO-TERMINAL-V3-PROMPT.md).
Die ältere Rendervorschau nutzt weiterhin V2 samt damaligen Vollbild-Ausfallstufen:
[Historische Prompts](PICO-TERMINAL-V2-PROMPTS.md).

| Datei | Herkunft | Format | Bytes |
| --- | --- | --- | --- |
| `assets/images/finales/pico-command-terminal-v3.webp` (aktuell) | Imagegen, schnelle Handschrift, ₿ ohne Nullenkette; verlustfreies WebP | 1672 × 941 | 1706670 |
| `assets/images/finales/pico-command-terminal-v2.webp` (historisch) | Imagegen, blaues Licht, schwarzes Sofa, Finanzanzeigen und drei Haftnotizen | 1672 × 941 | 1746724 |
| `assets/images/finales/pico-command-failure-v2-1.webp` (aktuell) | Imagegen, erste Rauchfahnen passend zu Terminal V2 | 1672 × 941 | 1741800 |
| `assets/images/finales/pico-command-failure-v2-2.webp` (aktuell) | Imagegen, zunehmender Ausfall passend zu Terminal V2 | 1672 × 941 | 1800882 |
| `assets/images/finales/pico-command-failure-v2-3.webp` (aktuell) | Imagegen, Endzustand passend zu Terminal V2 | 1672 × 941 | 1705362 |
| `assets/images/finales/pico-command-terminal-v1.webp` (historisch) | Nutzerbild `ChatGPT-Bild 27. Sept. 2026, 09_05_56.png` | 1672 × 941 | 377002 |
| `assets/images/finales/pico-command-lab-v3.webp` (aktuell) | Imagegen-Verfeinerung von `Zwei Goldbarrenreihen vor dem Quantencomputer.png` | 1672 × 941 | 1954566 |
| `assets/images/finales/pico-command-lab-v2.webp` (historisch) | Nutzerbild `ChatGPT-Bild 27. Sept. 2026, 14_57_17.png` | 1672 × 941 | 387970 |
| `assets/images/finales/pico-command-lab-v1.webp` (historisch) | Nutzerbild `ChatGPT-Bild 27. Sept. 2026, 09_03_02.png` | 1672 × 941 | 399962 |
| `assets/images/finales/pico-command-failure-1.webp` (historisch) | Imagegen, erste Rauchfahnen | 1672 × 941 | 333110 |
| `assets/images/finales/pico-command-failure-2.webp` (historisch) | Imagegen, Rauch und Störungen | 1672 × 941 | 376206 |
| `assets/images/finales/pico-command-failure-3.webp` (historisch) | Imagegen, Stillstand | 1672 × 941 | 339488 |

Raumübersicht V3, Terminal V2 und seine drei Ausfallbilder sind verlustfreie
WebP-Exporte ohne Skalierung, Beschnitt oder nachträgliche Schärfung. Die früheren
Bilder wurden mit Qualität 94 gespeichert. Der Generator lieferte 1672 × 941,
also die ursprüngliche Auflösung trotz gewünschter 4K-Ausgabe. Frühere Entwürfe
und Originaldateien bleiben erhalten. Energieflasche (-455, -85), Anflug und
Terminalziel behalten ihre Koordinaten. Die Raumübersicht erscheint in Level 1
bis 3, beiden Startseiten und der Projektwahl. Der Helikoptertext steht außerhalb
der Kamera.

## Getrennte Liveeffekte in Level 4 – MAIN-15, lokal geprüft am 02.10.2026

Rauch, rotes Licht im Quantenrechner und Displaystörung werden unabhängig
gesteuert. Die bisherigen Vollbilder liefern die Bildgrundlage, bestimmen aber
nicht gemeinsam den Zustand des ganzen Raums. Die Barbeleuchtung bleibt bis zum
letzten Schritt an; rote Notbeleuchtung bleibt auch danach erhalten.

Die Folge lautet: Werte laufen auseinander, leichter Rauch legt sich darüber,
rotes Rechnerlicht beginnt zu pulsieren, Töne setzen ein. Erst danach unterbricht
das Störungsbild genau dreimal die Zahlenanzeige. Nach dem Megarauch wechseln
Zahlen und Störung stärker, dann fällt das Display aus. Zuletzt erlöschen die
Barlichter. Kein Siegertext auf dem Bildschirm oder im Kamerabild.
Abbruch beendet auch ausstehende Effekte und Töne. Die neue Folge ist umgesetzt
und in Chromium/WebKit geprüft; die ältere bewegte Bildvorschau unten
dokumentiert den bisherigen Gestaltungsstand.
Die separaten Rauchgrafiken `pico-smoke-light-v1.webp` und
`pico-smoke-heavy-v1.webp` haben echte Transparenz. Herkunft und Alpha-Nachweis:
[PICO-SMOKE-LAYERS-PROMPTS.md](PICO-SMOKE-LAYERS-PROMPTS.md). Für den Liveeffekt
`pico_level4.html` öffnen; `prototypes/pico-drone-camera.html` bleibt ausdrücklich
die ältere Vier-Vollbilder-Vorschau mit den neuen V2-Grafiken.

## Bewegte Vorschau

### Aktueller Missionsnachtrag MAIN-16 (02.10.2026)

Die finale Mission lässt die echte Kalibrierfunktion zwischen und während der
Displaystörungen weiterlaufen. Die größer beschriftete Kontrollsumme bleibt dabei
nahe null. Rauch erhält ein langsames Pulsieren seiner Deckkraft, unabhängig vom
weichen Einblenden. Drei Warnbalken blitzen vor dem Displayausfall gemeinsam auf
und überstrahlen den Raum; eine zusätzliche rote Tönung nimmt mit dem Rauch zu.
Die Balken liegen hinter dem Rauch, der globale Lichtschein davor; Display und
Störbild bleiben eigene Ebenen. Nach dem ersten Störbild beginnt zusätzlich ein
stärkerer rhythmischer Alarm, der mit dem Missionsende oder Abbruch verstummt.
Keine neuen Bitmap-Assets nötig: Umsetzung in `assets/nullpunkt-level4.js/.css`
und `pico_level4.html`. Der ältere Prototyp unten zeigt diesen Nachtrag nicht.

MAIN-17 ergänzt den Fehlerweg: tatsächliche abweichende Kalibrierwerte bleiben
zunächst sichtbar. Ein Warnbanner liegt quer über dem Terminal, danach bei
ignorierter Warnung eine Zugangssperre. Der normale Ausfallalarm verwendet jetzt
gleichbleibende tiefe 180-Hz-Impulse; Fehlererkennung hat einen kurzen hellen
Piepton, die Sperre einen langen tiefen Alarm. Alle Abläufe bleiben native
Browser-Ebenen, ohne neue Bildgrafik. Details und Tests: `MISSION-MAIN-PORT.md`.

### Raumübersicht V3 – verwendeter Prompt und Ausgabe

Eingebautes Imagegen-Werkzeug, Edit-Modus; Quelle: vom Nutzer bereitgestelltes
`Zwei Goldbarrenreihen vor dem Quantencomputer.png`. Generierte PNG-Ausgabe:
`exec-2e6a06bd-23d2-4381-8442-46be6e32f955.png`. Projektdatei siehe Tabelle.
Komposition und Flugziele visuell mit der Quelle verglichen; keine neue Kameraperspektive.

```text
Use case: lighting-weather / fidelity-preserving render refinement.
Asset type: 16:9 background artwork for the Operation Nullpunkt educational game.
Input image 1 is the EDIT TARGET, not a loose reference.
Primary request: Refine this exact command-room image into a brilliant, exceptionally crisp high-detail premium 3D render. Keep the image composition and every object position unchanged. Produce a wide 16:9 image, ideally 3840x2160.
Preserve: the camera viewpoint, exact framing, geometry and proportions; blue-lit doorway on the far left, tiny green charging bottle with white lightning symbol near the far-left lower third, black sofa and financial world-map screens in the rear center, glass-railed stairwell in the foreground center, towering gold quantum computer PICO on the right in its reflective curved glass enclosure, its small dark terminal, and exactly the existing two rows of gold bars on a wooden pallet cropped in the lower-right foreground. These positions are gameplay coordinates; do not move, resize or add anything.
Change only rendering quality, clarity, fine detail and light/material definition: clean sharp edges, convincing polished gold metal, legible individual cables and tubes, crisp glass reflections, subtle detailed dark steel, controlled luminous cool-blue accents, warm gold glow with preserved highlight detail. Rich contrast with slightly more readable shadows, no flat washed-out look, no excessive bloom or clipped glowing gold. Maintain the dramatic blue-to-gold contrast.
Avoid: blurred or smeared textures, painterly smoothing, halos, oversharpening artifacts, new elements, any new text/UI/HUD, changed screen contents, changed architecture, extra gold-bar rows, crop or aspect-ratio changes, redesign. This is a faithful refinement of the supplied picture.
```

### Bisheriger Kameraablauf in der eigenständigen Vorschau

`prototypes/pico-drone-camera.html`, `.css`, `.js` bilden eine eigenständige Vorschau. Normalbetrieb und drei Ausfallzustände sind einzeln wählbar, über einen Schieberegler mischbar und als etwa 12,5 Sekunden langer Ablauf abspielbar. Gleichbleibender Bildausschnitt; geringfügige generative Abweichungen in Details sind möglich. Rauch ist Bestandteil der drei erzeugten Bilder und verändert sich beim Überblenden, keine separate Rauchsimulation.

Die Kameramarkierungen, Akkuanzeige (illustrative 82 %), Verbindungsanzeige und Stabilisierung liegen als native Oberfläche über dem Bild. Das rote Warnlicht pulsiert lokal mit einer Periode von 2,4 Sekunden. Terminalrauschen erhält eine schwache bewegte Zusatzebene. Bewegung und Kameraanzeigen sind abschaltbar; reduzierte Bewegung wird berücksichtigt. Keine Erfolgsmeldung auf dem Display oder im Kamerabild. In der finalen Mission gehört der Erfolgs-/Helikoptertext erst in den Levelabschluss.

Die vorhandene Rätsel-Layoutprobe `prototypes/pico-terminal-fit.html` verwendet
ebenfalls die Terminal-Innenansicht V2. Die Kamera-Vorschau zeigt das Terminal
nur zur Gestaltung; sie speichert keine Rätselabschlüsse. Raumübersicht V3:
MAIN-13; Terminal V2 und Ausfallbilder: MAIN-14; Kalibrierfinale: MAIN-12 und
aktuell MAIN-16 in `MISSION-MAIN-PORT.md`. IDs, Fortschrittsgewichte, Pixelmuseum
und Backend sind unverändert.

## Prüfung der Vorschau

Browserprüfung am 27.09.2026: Chromium bei 1366 × 768 und 390 × 844, WebKit bei 768 × 1024. Vier Bildzustände, Zwischenüberblendung, Bildladung, Anzeigenumschaltung, kein horizontaler Überlauf und mindestens 44 Pixel hohe Tasten erfolgreich geprüft. Zusätzlich vollständiger Ablauf, Lichtpuls, reduzierte Bewegung und Tastaturwahl geprüft. Keine Browserfehler. Die generierten Bilder wurden visuell geprüft.

Bildnachtrag am 01.10.2026: vier gezielte Terminal-/Kalibrierchecks mit den neuen
V2-Bildern in Chromium und WebKit erfolgreich. Die neue getrennte Effektfolge
MAIN-15 ist damit noch nicht geprüft. Nachlauf am 02.10.2026: 19/19 Level-4-
Browserchecks für getrennte Ebenen, Reihenfolge, dreimaligen Zahlen-/Rauschwechsel,
schwarzes Display, danach Bar-Ausfall, verbleibendes Rot, Audio-Abbruch und
reduzierte Bewegung; zusätzlich 2/2 Level-3-Übergangs-/Layoutprüfungen erfolgreich.
Laptop-/Tablet-Endbilder visuell kontrolliert; keine harten rechteckigen
Abdunklungsgrenzen nach Umstellung auf die nativen SVG-Masken.

## Historische Herkunft der ersten drei generierten Ausfallbilder (V1)

Modus: eingebautes Imagegen-Werkzeug, keine CLI und kein eigener API-Schlüssel. Am Vorabend wurde ein Versuch auf Grundlage des alten Bergpanoramas vom Nutzungslimit abgewiesen; daraus entstand kein Bild. Am 27.09. war die Generierung wieder verfügbar. Alle drei endgültigen Zustände wurden jeweils direkt aus demselben vom Nutzer gelieferten Terminalbild erzeugt, um Perspektivänderungen klein zu halten.

- Stufe 1: `exec-343ba958-e068-4d5f-8373-66486eebf7a4.png`
- Stufe 2: `exec-51fa67d3-22a8-4995-ac93-fdd9f7ff955b.png`
- Stufe 3: `exec-b14decd9-0034-495d-9f34-7ccd9fe9abf6.png`

### Prompt Stufe 1

Use case: lighting-weather.
Asset type: fixed-camera game animation keyframe, wide landscape 1672 x 941.
Image 1 is the EDIT TARGET, supplied by the user: PICO's maintenance terminal inside the villain's command center.
STRICT CONTINUITY: these frames will CROSSFADE. Preserve camera, framing, zoom, perspective, every silhouette and structural edge. Monitor at exactly x165..1056 and y347..717; same pedestal, gold machine plate positions, curved reflective seamless glass, world-map screen wall and red lounge. Keep all architecture exactly registered. Do not redesign, zoom or add any objects.
Change only smoke, atmosphere, lighting and operational state. Premium cinematic stylized 3D, gold computer remains identifiable. No visible drone or people, HUD, symbols, text, labels, captions, success messages, montage or borders. One entire image.

STAGE 1 — EARLY COOLING FAILURE:
PICO is still golden and operating. A few narrow wisps of pale vapor escape from existing cooling assemblies around its lower-right base and curl upwards. This is the early stage, keep at least 85% of the gold machine unobscured, glass reflections clearly visible. No huge cloud yet.
Existing room red lights remain, a slightly stronger RED EMERGENCY GLOW comes from the existing vertical strip at far right and reflects in the protective glass and floor. Only a few white practical lights on PICO's base are now unlit; most including the terminal rim remain on. Computer's gold radiance dims just slightly. Terminal screen remains completely dark and blank for a real interface overlay. Wall map displays still blue and functional.
No fire, sparks, explosion, broken glass or melting structure. Barely changed fixed scene with a clear first vapor warning.

### Prompt Stufe 2

Use case: lighting-weather.
Asset type: fixed-camera game animation keyframe, wide landscape 1672 x 941.
Image 1 is the EDIT TARGET, supplied by the user: PICO's maintenance terminal inside the villain's command center.
STRICT CONTINUITY: these frames will CROSSFADE. Preserve camera, framing, zoom, perspective, every silhouette and structural edge. Monitor at exactly x165..1056 and y347..717; same pedestal, gold machine plate positions, curved reflective seamless glass, world-map screen wall and red lounge. Keep all architecture exactly registered. Do not redesign, zoom or add any objects.
Change only smoke, atmosphere, lighting and operational state. Premium cinematic stylized 3D, gold computer remains identifiable. No visible drone or people, HUD, symbols, text, labels, captions, success messages, montage or borders. One entire image.

STAGE 2 — FAILURE SPREADS:
Cooling has failed and the machine's lower assemblies are smoking. Several rolling, layered plumes of grey-white smoke rise from the base up the right half of the enclosure, with darker grey wisps among them. Smoke masks roughly 35–45% of the hardware, while the original machine outline and large gold plates remain readable behind it. Dim the gold machine's luminous filaments to about half their original brilliance; gold material still catches ambient red highlights.
More existing WHITE light strips have gone OFF: base rings, right-hand fittings, some floor steps, and the monitor support. Keep only a few surviving white segments and a dim terminal perimeter. Wall maps at upper left have partially failed: some small monitors dark, largest map still faintly blue.
Existing RED wall/emergency strips now dominate the side lighting and reflect intensely in curved glass, smoke and floor. Use localized emergency red, not a uniform red filter over everything.
The frontal terminal screen starts displaying dim fine grey static and a few horizontal interference bands with ABSOLUTELY NO LETTERS OR WORDS. Its position, border and support must not move.
The mood is an escalating electrical/cooling crisis, with no flames, explosion, flying parts, shattered glass, or new objects. Render one precise intermediate frame between initial wisps and final shutdown.

### Prompt Stufe 3

Use case: lighting-weather.
Asset type: fixed-camera game animation keyframe, wide landscape 1672 x 941.
Image 1 is the EDIT TARGET, supplied by the user: PICO's maintenance terminal inside the villain's command center.
STRICT CONTINUITY: these frames will CROSSFADE. Preserve camera, framing, zoom, perspective, every silhouette and structural edge. Monitor at exactly x165..1056 and y347..717; same pedestal, gold machine plate positions, curved reflective seamless glass, world-map screen wall and red lounge. Keep all architecture exactly registered. Do not redesign, zoom or add any objects.
Change only smoke, atmosphere, lighting and operational state. Premium cinematic stylized 3D, gold computer remains identifiable. No visible drone or people, HUD, symbols, text, labels, captions, success messages, montage or borders. One entire image.

STAGE 3 — MACHINE DISABLED, FINAL AFTERMATH:
The fictional sabotage has destroyed internal control/cooling electronics. PICO has lost all active gold inner radiance. Its recognizable gold metal is now DARK BRONZE with only subdued reflections from emergency red light. Some thin interior wires are scorched and sagging, slight soot on the lower assemblies, but keep all major structures, rings, support units and glass boundaries EXACTLY in position. No melted enormous rings, no structural collapse.
Heavy, beautifully volumetric layered smoke billows from existing lower assemblies through the right side and upper enclosure, catching muted deep RED emergency light. Pale grey smoke at its illuminated edges, denser dark grey inside, enough to obscure more than half of the computer but leave its silhouette recognizable. More smoke than stage 2, not a uniformly fogged camera and not an opaque grey wall. Foreground terminal stays visible.
ALL WHITE/MINT PRACTICAL LIGHTS ARE COMPLETELY OFF: terminal rim and pedestal strip, base fixture panels, curved base step strips, right foreground fixtures. Those light diffusers look like unlit dull dark grey material, absolutely no little white glowing segments remaining.
All blue world-map wall displays are now black/unlit with faint dark reflections. Existing red room/emergency strips remain lit, red reflections on glass and floor remain but the whole scene is considerably darker. Keep the red lounge subtly visible.
The monitor screen is dim grey TV STATIC with irregular horizontal interference, not a blank black screen, and ABSOLUTELY NO TEXT OR SUCCESS MESSAGE. No words anywhere in the scene.
No flames, explosion, flying debris, broken glass or dead drone. The drama is smoke, dead machinery, failed white lighting, red emergency illumination and the noisy screen. Exactly the same camera view as the operational input.
