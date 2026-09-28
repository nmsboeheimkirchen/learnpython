# PICO – Kommandozentrale und Drohnenkamera

Stand: 27.09.2026. Arbeitsbranch: `dev-login-save`. Öffentlicher Missionsentwurf; keine Änderungen an Login, Backend oder Lernstand.

## Aktuelle Bildgrundlage

Die vom Nutzer bereitgestellten Bilder ersetzen die Bergpanorama-Entwürfe als aktuelle Grundlage. PICO steht im Inneren der Kommandozentrale des Lords. Kartenwand, Sitzbereich und Zugang vermitteln einen weiterhin benutzten Raum. Die aktuelle Raumübersicht V2 aus dem Nutzerbild von 14:57 zeigt kühles blauweißes Licht an Zugang und Decke, mit roten Akzenten im Sitzbereich und goldenem PICO. Die Terminal-Nahaufnahme und die drei Ausfallstufen behalten ihren bestehenden Bildstand.

| Datei | Herkunft | Format | Bytes |
| --- | --- | --- | --- |
| `assets/images/finales/pico-command-terminal-v1.webp` | Nutzerbild `ChatGPT-Bild 27. Sept. 2026, 09_05_56.png` | 1672 × 941 | 377002 |
| `assets/images/finales/pico-command-lab-v2.webp` (aktuell) | Nutzerbild `ChatGPT-Bild 27. Sept. 2026, 14_57_17.png` | 1672 × 941 | 387970 |
| `assets/images/finales/pico-command-lab-v1.webp` (historisch) | Nutzerbild `ChatGPT-Bild 27. Sept. 2026, 09_03_02.png` | 1672 × 941 | 399962 |
| `assets/images/finales/pico-command-failure-1.webp` | Imagegen, erste Rauchfahnen | 1672 × 941 | 333110 |
| `assets/images/finales/pico-command-failure-2.webp` | Imagegen, Rauch und Störungen | 1672 × 941 | 376206 |
| `assets/images/finales/pico-command-failure-3.webp` | Imagegen, Stillstand | 1672 × 941 | 339488 |

Alle Bilder ohne Beschnitt als WebP mit Qualität 94 gespeichert. Frühere Entwürfe bleiben erhalten. Die Originaldateien in Downloads wurden nicht verändert. Die Energieflasche steht in der neuen Übersicht deutlich weiter links als in V4; der lokale Missionsstand vom 28.09. verwendet dafür (-455, -85). Raumübersicht und Terminal sind in Level 1 bis 3 eingebunden, die Ausfallstufen bleiben für Level 4 vorbereitet.

## Bewegte Vorschau

`prototypes/pico-drone-camera.html`, `.css`, `.js` bilden eine eigenständige Vorschau. Normalbetrieb und drei Ausfallzustände sind einzeln wählbar, über einen Schieberegler mischbar und als etwa 12,5 Sekunden langer Ablauf abspielbar. Gleichbleibender Bildausschnitt; geringfügige generative Abweichungen in Details sind möglich. Rauch ist Bestandteil der drei erzeugten Bilder und verändert sich beim Überblenden, keine separate Rauchsimulation.

Die Kameramarkierungen, Akkuanzeige (illustrative 82 %), Verbindungsanzeige und Stabilisierung liegen als native Oberfläche über dem Bild. Das rote Warnlicht pulsiert lokal mit einer Periode von 2,4 Sekunden. Terminalrauschen erhält eine schwache bewegte Zusatzebene. Bewegung und Kameraanzeigen sind abschaltbar; reduzierte Bewegung wird berücksichtigt. Keine Erfolgsmeldung auf dem Display oder im Kamerabild. In der finalen Mission gehört der Erfolgs-/Helikoptertext erst in den Levelabschluss.

Die vorhandene Rätsel-Layoutprobe `prototypes/pico-terminal-fit.html` verwendet ebenfalls die Terminal-Innenansicht. Die Kamera-Vorschau zeigt das Terminal nur zur Gestaltung; sie speichert keine Rätselabschlüsse. Level 1 und die Missionsauswahl verwenden inzwischen die Raumübersicht V2 (siehe MAIN-04/MAIN-05 in `MISSION-MAIN-PORT.md`). IDs, Fortschrittsgewichte, Pixelmuseum und Backend sind unverändert.

## Prüfung der Vorschau

Browserprüfung am 27.09.2026: Chromium bei 1366 × 768 und 390 × 844, WebKit bei 768 × 1024. Vier Bildzustände, Zwischenüberblendung, Bildladung, Anzeigenumschaltung, kein horizontaler Überlauf und mindestens 44 Pixel hohe Tasten erfolgreich geprüft. Zusätzlich vollständiger Ablauf, Lichtpuls, reduzierte Bewegung und Tastaturwahl geprüft. Keine Browserfehler. Die generierten Bilder wurden visuell geprüft.

## Herkunft der drei generierten Ausfallbilder

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
