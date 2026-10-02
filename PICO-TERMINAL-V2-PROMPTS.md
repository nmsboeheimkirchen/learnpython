# PICO-Terminal V2 – Post-its und passende Ausfallstufen

Stand: 01.10.2026. Eingebautes Imagegen-Werkzeug, Edit-Modus.
Lokaler öffentlicher Missionsstand auf `dev-login-save`, MAIN-14; kein Release.

## Ergebnis und Verwendung

Die neue Nahaufnahme übernimmt das blaue Licht, schwarze Sofa und die
Finanzbildschirme der Raumübersicht V3. Drei Haftnotizen am unteren Terminalrand
erzählen die Ziele des Lords: Bitcoin mit fiktivem Hash, US National Reserve mit
zwei erfundenen Kontonummern und Shanghai Digital Vault / 上海数字金库.
Die Bezeichnungen und Nummern sind Requisiten, keine echten Zugangsdaten.
Die Nutzfläche des Bildschirms bleibt für das interaktive Rätsel frei.

Alle vier Bilder haben **1672 × 941 Pixel** und wurden ohne Skalierung, Beschnitt,
zusätzliche Schärfung oder Farbänderung als **verlustfreies WebP** exportiert.
Die Ausgangs-PNGs und frühere Projektversionen bleiben erhalten.
Alle Ausfallbilder wurden direkt aus der neuen normalen Terminalaufnahme erzeugt.
Kamera, Monitor und Post-its wurden visuell abgeglichen; kleine generative
Detailunterschiede sind bei Überblendungen möglich.

| Zustand | Projektdatei | Bytes | PNG-Ausgabe |
| --- | --- | ---: | --- |
| Normal | `assets/images/finales/pico-command-terminal-v2.webp` | 1746724 | `exec-07aedb5f-b802-407b-9d30-f28b35f9f6ba.png` |
| Erste Rauchfahnen | `assets/images/finales/pico-command-failure-v2-1.webp` | 1741800 | `exec-0abbadf2-61d5-4635-b5f7-eb9b76f27022.png` |
| Zunehmender Ausfall | `assets/images/finales/pico-command-failure-v2-2.webp` | 1800882 | `exec-872a6771-bee3-42ff-9e7c-1e9f50577cff.png` |
| Endzustand | `assets/images/finales/pico-command-failure-v2-3.webp` | 1705362 | `exec-e5f03811-75f1-44c8-9947-4d8b7f4c6dd6.png` |

Die normale Nahaufnahme ist in `pico_level3.html`, `pico_level4.html`,
`prototypes/pico-drone-camera.html` und `prototypes/pico-terminal-fit.html` eingebunden.
Die drei vollständigen Ausfallbilder dienen nach dem anschließenden Nutzerwunsch
nur noch der älteren Rendervorschau `prototypes/pico-drone-camera.html`.
Die aktive Level-4-Mission verwendet stattdessen unabhängig gesteuerte transparente
Rauchebenen, rote SVG-Warnlichter und eine eigene Canvas-Displaystörung:
[Rauchebenen und Prompts](PICO-SMOKE-LAYERS-PROMPTS.md).
Die Registerfläche in Level 3 ist unten minimal verkürzt, damit keine UI-Kante auf
den Zetteln liegt. Im Ausfall bleiben die Notizen am Rahmen sichtbar; auf dem
Display erscheinen weder Statuswörter noch Siegertext.

## Vollständiger Prompt – Nahaufnahme

```text
Use case: precise-object-edit.
Asset type: production terminal close-up background for the Operation Nullpunkt game, exact wide 1672 x 941 composition.
Input image 1 is the EDIT TARGET: current frontal terminal close-up. Input image 2 is the supporting approved room reference, for material clarity, blue lighting, black sofa and financial screens only; do NOT take its wide camera angle.
Preserve image 1 camera, crop and every major geometry: large terminal at x165..1056 y347..717, its dark empty interactive display, pedestal, gold quantum computer at right and its curved reflecting glass. The display must remain fully empty for the actual game interface; no text or notes inside the black display area x190..1027 y373..692.
Primary edit: bring this close-up into the same crisp brilliant blue-and-gold command-room style as image 2. Replace room red ambient lights by cool cyan-blue, red lounge upholstery by black, use blue financial charts/world map and currency graphics on the REAR wall screens matching image 2. Enhance sharp clean metallic edges, intricate gold tubing, controlled brilliant gold highlights, convincing glass reflections and readable shadows. Keep the quantum computer and blank terminal perfectly registered to input 1.
Story props: add EXACTLY THREE realistic paper sticky notes, stuck along the LOWER physical bezel of the terminal and hanging down below it over the pedestal/background, NOT inside or over the usable display. All three fully visible. Approximate note bounds: first x210..438 y710..903; second x490..724 y710..903; third x780..1014 y710..903. Very slight natural tilt and curled corners, subtle soft contact shadows; pale yellow, pale cream, pale mint papers. Dark ink with sharp readable restrained handwriting/monospaced numerals. These are the villain's target reminders, not UI cards.
Use exactly the following note texts and line breaks, with no invented extra words:
LEFT NOTE:
Bitcoin
0000000000000000
7c9e4a6d2f80b135
a91c6e7d340fb258
6b1a20d5ef9348c7

CENTER NOTE:
US National
Reserve
AC 0427-6819
AC 1058-9032

RIGHT NOTE:
上海数字金库
Shanghai
Digital Vault
CNY 7308-2146

No people, no drone, no HUD, no new furniture, no smoke yet, no damage, no success text. No changed terminal shape or screen size, no crop, no blurry pseudo-text. One complete premium cinematic 3D render.
```

## Vollständiger Prompt – Ausfallstufe 3

```text
Use case: lighting-weather.
Asset type: final damage keyframe for an educational spy game; exact 1672 x 941 composition, this image will crossfade over its input.
Input image 1 is the EDIT TARGET: approved NEW terminal close-up with blue room light, black sofa, rear financial screens, 3 handwritten sticky notes.
STRICT CONTINUITY: preserve every silhouette and all spatial positions. Terminal screen x165..1056 y347..717; identical bezel, pedestal, cryostat rings, cables, curved reflective glass. Keep the black sofa BLACK, same rear financial-screen contents underneath dimming. All THREE sticky notes must remain IDENTICAL at the same locations and with the same exact writing: Bitcoin and four hash lines; US National Reserve with AC 0427-6819 and AC 1058-9032; 上海数字金库 / Shanghai / Digital Vault / CNY 7308-2146. Do NOT move, lose, recolor, rewrite or add notes. They must still be readable, lightly lit by reflected emergency light. Preserve paper shape and curled corners.
Change ONLY atmosphere, lighting and machine operational state.
STAGE 3 — FINAL AFTERMATH: The fictional damaged calibration/cooling system has disabled PICO. Absolutely NO active gold glow remains. Gold hardware is now dark bronze reflecting only dim red emergency light. Heavy layered volumetric grey smoke emerges from existing lower machinery and rises through the right side, masking more than half the core while leaving the original machine silhouette. Subtle soot on existing lower fixtures and fine cables, no changed geometry. More severe than early smoke: convincing dead machine and ruined internal electronics, no huge physical collapse.
ALL WHITE PRACTICAL LIGHTS are off: terminal bezel and pedestal strip, machine base panels, curved base/floor-step strips, foreground fittings. Their former diffusers look dull grey unlit. ALL BLUE practical lights and rear financial screens have shut off too; black reflective displays, same rectangular frames. Add red emergency illumination originating from EXISTING side-wall light strips, with convincing local red reflections in curved glass, smoke and floor. No red sofa, no uniform red overlay; retain dark shadows and a little weak cool reflected fill.
The large foreground screen now shows dim monochrome TV STATIC with fine horizontal interference bands, no readable UI and ABSOLUTELY NO SUCCESS TEXT. Text is allowed ONLY on the three preserved handwritten sticky notes.
No flames, explosion, flying debris, broken glass, people, drone, new hardware, badges, captions or watermark. Preserve camera, perspective, framing, screen rectangle and foreground note clarity. A single sharp premium cinematic 3D render.
```

## Produktionsprotokoll – Ausfallstufen 1 und 2


Built-in image_gen edit mode. Both plates are generated directly from assets/images/finales/pico-command-terminal-v2.webp; no chained edit and no old failure plate is used as input. Base inspected with view_image before generation. Target: 1672 x 941, lossless WebP.

## Stage 1 prompt

```text
Use case: lighting-weather.
Asset type: registered animation plate for a local educational game, PICO quantum computer command room.
Input image: the one supplied image is the EDIT TARGET and the sole visual source. Work directly from it, preserving its composition.
Output one landscape frame, same framing and 1672 x 941 canvas/aspect ratio as reference, maximum crisp high-detail rendering.
CRITICAL REGISTRATION: do not move the camera, zoom, crop, change perspective, resize or reposition any object. The monitor occupies original-image coordinates x165..1056 and y347..717; keep its exterior silhouette, bezel, stand, and its inner display edges exactly aligned to the reference. Keep every pipe, step, wall, glass reflection, machine part, sofa, table and screen at the same coordinates. Do not redraw the geometry.
The three handwritten sticky notes attached along the bottom of the monitor remain EXACTLY unchanged: same position, size, paper folds, color, handwriting, and all the original text/number strings. Keep them fully visible and readable. No new words or UI elements. Black sofa stays BLACK, gold computer stays gold/brass, existing financial charts/world map remain their original content unless specifically told to darken their screens. No red sofa.
Preserve high sharpness, material highlights and curved glass reflections. Only modify smoke, emitted lighting, specified extinguished lamps and display content as specified below.
Avoid flames, explosion, flying debris, melted new objects, people, extra devices, changed architecture, new lamps, changed monitor/notes, blanket blur, camera shake, fog across the whole frame.
FAILURE STAGE 1 / early warning only:
Add the first two or three very thin, wispy pale grey smoke tendrils rising from the LOWER machine core/base on the right. Smoke covers at most 10–15 percent of the gold apparatus, and at least 85 percent remains clearly visible. Keep the upper machine clear and luminous. Preserve the original rich gold brightness almost completely. Turn off only one or two small white cooling lamps near the base. Introduce a restrained red emergency glow only from the existing vertical side lighting strips, while most existing cool-blue ceiling and room light remains blue and on. No dramatic red wash yet. The monitor display remains completely blank and dark exactly as in the original. Financial wall screens stay on. This is only the beginning of cooling trouble.
```

## Stage 2 prompt

```text
Use case: lighting-weather.
Asset type: registered animation plate for a local educational game, PICO quantum computer command room.
Input image: the one supplied image is the EDIT TARGET and the sole visual source. Work directly from it, preserving its composition.
Output one landscape frame, same framing and 1672 x 941 canvas/aspect ratio as reference, maximum crisp high-detail rendering.
CRITICAL REGISTRATION: do not move the camera, zoom, crop, change perspective, resize or reposition any object. The monitor occupies original-image coordinates x165..1056 and y347..717; keep its exterior silhouette, bezel, stand, and its inner display edges exactly aligned to the reference. Keep every pipe, step, wall, glass reflection, machine part, sofa, table and screen at the same coordinates. Do not redraw the geometry.
The three handwritten sticky notes attached along the bottom of the monitor remain EXACTLY unchanged: same position, size, paper folds, color, handwriting, and all the original text/number strings. Keep them fully visible and readable. No new words or UI elements. Black sofa stays BLACK, gold computer stays gold/brass, existing financial charts/world map remain their original content unless specifically told to darken their screens. No red sofa.
Preserve high sharpness, material highlights and curved glass reflections. Only modify smoke, emitted lighting, specified extinguished lamps and display content as specified below.
Avoid flames, explosion, flying debris, melted new objects, people, extra devices, changed architecture, new lamps, changed monitor/notes, blanket blur, camera shake, fog across the whole frame.
FAILURE STAGE 2 / developing cooling failure:
Create increasing pale grey-white smoke rising from the lower and middle computer apparatus on the right, with natural layered wisps and denser plumes. Smoke partially obscures 35–45 percent of the machine while its cylindrical silhouette and many gold details remain visible. Reduce the gold core light to roughly half the original brightness. Switch off several more white cooling lamps, leaving only a few functioning. Darken two or three of the small blue financial wall screens but leave the large central world-map screen faintly visible. Red emergency illumination from the EXISTING side light strips is stronger and reflected subtly on the floor and glass; preserve some blue ceiling light for continuity. The sofa remains BLACK. The monitor's original blank display now has fine low-contrast grey television static/noise across the inner display area only, without any words, labels, warning text or symbols. Keep all three sticky notes and their original writing clearly visible and unchanged. This is intermediate failure, with no flames and no explosion.
```

## Outputs

Both stages generated and inspected. The source and both outputs have exactly 1672 x 941 pixels. Visual review: monitor silhouette and inner display edges align with the base; all three notes remain in the same visible locations with their handwritten labels and numbers preserved. Black sofa, financial wall screens and machine geometry retained. Stage 1 has thin localized smoke and a mostly bright gold core, with a blank monitor. Stage 2 adds denser localized smoke, dimmed gold, several dark wall screens and fine monitor static, with stronger red emergency light. No flames, explosion or new objects. No functional tests were needed for these image-only outputs.


### Generated files

```json
[
  {
    "source": "C:/Users/Cy-X/.codex/generated_images/01a0f82b-f3a2-7923-a6df-47a80ca22349/exec-0abbadf2-61d5-4635-b5f7-eb9b76f27022.png",
    "sourceWidth": 1672,
    "sourceHeight": 941,
    "destination": "assets/images/finales/pico-command-failure-v2-1.webp",
    "width": 1672,
    "height": 941,
    "bytes": 1741800
  },
  {
    "source": "C:/Users/Cy-X/.codex/generated_images/01a0f82b-f3a2-7923-a6df-47a80ca22349/exec-872a6771-bee3-42ff-9e7c-1e9f50577cff.png",
    "sourceWidth": 1672,
    "sourceHeight": 941,
    "destination": "assets/images/finales/pico-command-failure-v2-2.webp",
    "width": 1672,
    "height": 941,
    "bytes": 1800882
  }
]
```

Converted with bundled sharp to lossless WebP, 1672 x 941; no additional sharpness filter, color grading, geometry edits, or cropping applied. Generated PNG originals retained.
