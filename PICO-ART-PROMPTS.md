# PICO – Renderings für Operation Nullpunkt

Erzeugt am 26.09.2026 mit dem eingebauten Imagegen-Werkzeug.
Bildphase: zwei Grundrenderings, nach Nutzerfeedback bis V4 überarbeitet.
Dieser Verlauf dokumentiert die früheren Bergpanorama-Entwürfe bis V4.
Aktuell seit 01.10.: verfeinerte Nutzer-Innenansicht mit zwei Reihen Goldbarren
als Raumübersicht V3 in Level 1 bis 3. Die Terminal-Nahaufnahme V2 in Level 3 und 4
übernimmt das blaue Licht, schwarze Sofa und die Finanzanzeigen. Drei Post-its
(Bitcoin, US National Reserve und Shanghai Digital Vault) erzählen die Ziele des
Lords; Hash und Kontonummern sind erfundene Requisiten. Drei passende Ausfallbilder
erhalten diese Ausstattung. Herkunft und Prompts: [PICO-CAMERA-PROMPTS.md](PICO-CAMERA-PROMPTS.md)
und [PICO-TERMINAL-V2-PROMPTS.md](PICO-TERMINAL-V2-PROMPTS.md).

Der aktuelle Effektumbau MAIN-15 trennt Rauch, rotes Rechnerlicht und Displaystörung:
Wertedrift → leichter Rauch → Lichtpuls → Töne → drei Zahlen-/Störungswechsel →
Megarauch → stärkeres Displayflackern → Display aus → zuletzt Barlichter aus.
Die rote Notbeleuchtung bleibt erhalten. Dieser Ablauf ist seit 02.10. lokal geprüft;
frühere Vorgaben zur gemeinsamen Vollbildüberblendung unten sind historisch.
Transparente Rauchebenen: [PICO-SMOKE-LAYERS-PROMPTS.md](PICO-SMOKE-LAYERS-PROMPTS.md).

## 1. Raumübersicht

- Ausgangsbild: `assets/images/finales/pico-rescue-station.webp`
- Projektdatei: `assets/images/finales/pico-quantum-lab.webp`
- Nur die Antenne rechts wurde durch PICO mit Wartungsterminal ersetzt.

### Verwendeter Prompt

Use case: precise-object-edit.
Asset type: production background for an educational spy game, wide 16:9 landscape.
Image 1 is the edit target: the existing blue mountain-base room. Preserve the original camera position, composition, aspect ratio, entire left elevator, mountains, panoramic window frames, ceiling, rocks, railing, floor grid and broad empty central navigation area exactly as closely as possible.
Primary request: Replace ONLY the tall radio beacon/antenna on the raised platform at the far right with PICO, the villain's quantum computer. Remove its antenna tip and all broadcast rings.
PICO is a compact but impressive vertically enclosed quantum machine, dark navy metal housing with cyan seam lighting, a protected tall glass inspection window containing recognizable stacked gold cryostat plates and fine cables. Attached toward the FRONT LEFT of the machine is a low physical maintenance console with a simple wide rectangular dark screen and a cyan rim, approachable by a small drone from the open floor. No letters, labels, symbols, interface text, or branding anywhere. The machine fits the footprint and placement of the old beacon on the existing right-hand platform. Its front access point stays near the old beacon's base. Do not expand it into the large central flight area.
Style: retain the reference's polished cinematic stylized 3D game render, blue evening lighting, warm amber elevator, clean readable forms, detailed restrained materials, same mountain-base architecture.
State: fully operational normal state, no smoke, no damage, no flames, no drone or people visible, no UI overlay. One single complete room image, no panels, no borders, no watermark.

## 2. Drohnenkamera am Terminal

- Referenz: das neu erzeugte Renderbild der Raumübersicht.
- Projektdatei: `assets/images/finales/pico-quantum-terminal.webp`
- Bildschirm bleibt leer für interaktive Elemente. Der Rechner bleibt daneben im Bild.

### Verwendeter Prompt

Use case: stylized-concept.
Asset type: second production background for the same educational spy game, 16:9 landscape.
Input Image 1 is the approved room and machine identity reference. Create ONE NEW CAMERA VIEW of this exact location, as seen by the small unnamed drone that has now flown to the maintenance console on the right-hand platform.
Primary request: a close, immersive first-person drone-camera view of PICO's maintenance terminal with the quantum machine clearly visible immediately behind and to its right.
Keep the exact PICO design: dark navy cylindrical enclosure, cyan-lit vertical rails and seams, glass front containing stacked gold cryostat plates and fine gold cabling, same base and attached console. Same blue mountain-base room, dusk mountain panorama and angular window framing recognizable in the remaining background. Maintain spatial continuity with reference, no invented new laboratory.
Composition: the maintenance console dominates the LOWER LEFT and CENTER foreground, with one large clean wide DARK rectangular display angled only slightly, almost directly facing the camera, occupying about 48 percent of image width and 35 percent of image height. The display surface must be entirely empty near-black, with a restrained cyan border, no drawn user interface: interactive puzzle graphics will be added by the game. The complete recognizable cryostat occupies the RIGHT half and upper right, its gold internals clearly visible. The player should be able to see later smoke emerging from this machine while still seeing the screen. Tight but breathable framing, no extreme wide-angle distortion.
Style: same polished cinematic stylized 3D game art, high-quality readable materials and restrained rich lighting, cool deep blue, cyan accents, warm gold mechanical details. Normal operational state, clean air, no damage or smoke yet.
Avoid: text, labels, digits, letters, branding, success messages, camera HUD, crosshairs, borders, watermark, drone body, hands, people, weapons. No split panels. One continuous 16:9 image.

## Vorgaben für die spätere Umsetzung

Rauch am Rechner und Rauschen auf dem Terminaldisplay zeigen die Zerstörung.
Keine eingeblendete Erfolgsmeldung wie „PICO offline. Quantenangriff gestoppt.“
im Kamerabild. Erst der Levelabschluss bestätigt den zerstörten Computer und
führt zum Helikopter. Pixelmuseum bleibt unverändert.

Die Original-PNGs bleiben außerdem unter dem Imagegen-Ausgabepfad erhalten.
Die WebP-Dateien im Projekt sind reine Formatkonvertierungen ohne Bildbeschnitt.

## Überarbeitung V2 – vorheriger Bildstand

Nutzerkorrektur: deutlich mehr Gold, Leuchten und Funkeln; PICO höher, nach oben
breiter und über den Bildrand fortgesetzt; gebogene reflektierende Schutzverglasung
mit horizontalen Unterteilungen; ein eingefasster Treppenabgang als räumliches
Hindernis; links eine eindeutig erkennbare Ladestation. Terminal frontal für
verschiebbare Rätselteile. Diese Überarbeitung wurde anschließend durch V3 abgelöst.

- Raum: `assets/images/finales/pico-quantum-lab-v2.webp`
- Terminal: `assets/images/finales/pico-quantum-terminal-v2.webp`
- V1 bleibt als Entwurfsstand erhalten; keine Missionsseite verwendet schon V2.
- Reine WebP-Konvertierung, Qualität 94, ohne Größenänderung oder Beschnitt.
- Das Terminal hat nun eine rechteckige, weitgehend unverzerrte dunkle Bildschirmfläche.
- Lichtreflexe liegen auf Gold und Schutzglas; die Bildschirmfläche bleibt frei.

### Raum V2 – verwendeter Prompt

Use case: precise-object-edit.
Asset type: cinematic production background for an educational science-fiction spy game. Single 16:9 landscape image.
Image 1 is the edit target, the first PICO room render. The user wants a much more spectacular, richly illuminated, substantial environment. Keep the recognizable mountain panorama at blue dusk, the overall elevated camera angle, angular window architecture, navy/cyan/amber palette and recognizable left-to-right gameplay layout, but substantially redesign the equipment as follows.

HIGHEST PRIORITY, PICO ON THE RIGHT: replace the small capped cylinder with a towering gold quantum computer that rises beyond the TOP EDGE of the image. Its upper tiers become progressively BROADER as they rise: large inverted-chandelier cryostat architecture, broad stacked golden rings and plates, dense fine gold wiring, polished gold and copper mechanisms. The uppermost wider structure continues out of frame. Awe-inspiring, elegant high technology, large enough to dominate the right half. Make it sparkle and glow: many small pinpoint gold status lights, brilliant jewel-like specular glints on metal edges, bright warm gold inner light, cyan highlights, sumptuous reflective materials, carefully controlled cinematic bloom. This is working precision equipment, no fire or destructive electrical sparks.

GLASS: between the viewer and the quantum machinery is a clearly visible CURVED transparent safety-glass wall wrapping around its front. It catches distinct reflections of blue windows, cyan lights and warm golden machinery. Divide the glass horizontally into three or four stacked curved bands using slim horizontal metal mullions. Reflections should make the protective curved glass unmistakable while keeping the gold machine visible. A maintenance terminal remains accessible OUTSIDE the glass on its front-left side, with a simple wide dark empty screen.

LEFT CHARGING STATION: transform the left glowing elevator-like recess into a convincing DRONE CHARGING BAY, visibly functional rather than a portal. A projecting low docking pad with metal contact rails, charging connectors/arms, two or three glowing battery modules seated in wall racks, thick neatly routed charging cables, amber and cyan indicator strips. The dock should extend slightly toward the foreground-left so it reads as the place where the drone obtains energy. No text, no drone.

FLOOR AND ROOM: the room was too empty. Add a clearly visible rectangular stairwell opening in the MIDDLE FOREGROUND: actual stairs descending below floor level, dark interior with a little amber utility light, low protective metal rails and illuminated rim. This gives the drone a meaningful obstacle to fly AROUND. Preserve readable navigable floor corridors on BOTH sides of it from the left charger toward the right terminal; do not block the whole route. Add a few integrated cooling/power cabinets along the rear wall below the windows and restrained routed floor conduits, coherently designed, no random clutter.

Style: premium cinematic stylized 3D game environment, far richer lighting/material polish than the reference, clear silhouettes and depth, blue mountain light contrasting with radiant gold machinery, tangible architectural details, coherent scale. Preserve a useful navigational overview.
No text, letters, numbers, logo, UI, people, visible drone, smoke, damage, split panels or watermark.

### Terminal V2 – verwendeter Prompt

Use case: compositing.
Asset type: production first-person drone-camera background for an interactive puzzle in a cinematic science-fiction game. Single wide 16:9 image.
Input Image 1: the NEW PICO room overview, definitive reference for the upgraded quantum computer, curved glass, lighting, materials and environment.
Input Image 2: the previous terminal close-up, edit/reference for the basic maintenance console design only. Its excessively angled screen must be corrected.

Create a new close camera view of the terminal from Image 1. Match its majestic gold quantum computer, now much taller with progressively wider upper cryostat tiers disappearing beyond the top of frame, dense intricate polished gold wires and rings, bright warm gold core lights and tiny sparkling specular highlights. In front of the machine preserve the unmistakable CURVED reflective protective glass from Image 1 with three/four HORIZONTAL dividing rails. Beautiful reflections of blue window frames and gold lights on that curved glass. Gold and cyan lighting should be substantially richer than in the old terminal image.

CRITICAL USABILITY REQUIREMENT: the maintenance terminal display is directly FACE-ON to the viewer. The drone hovers exactly on the perpendicular axis of the screen and the console's articulated screen has turned upright to face it. Make the actual SCREEN PLANE perfectly RECTANGULAR with horizontal parallel top/bottom edges and vertical parallel left/right edges. ZERO trapezoid, ZERO keystone perspective, ZERO lateral rotation, ZERO diagonal sloping edges. A modest physical bevel around the screen is fine, but the usable inner screen is one flat straight rectangle. The whole inner screen must be in frame.
COMPOSITION: put this substantial rectangular monitor in the LEFT AND CENTER foreground, approximately from 8% to 67% of image width and from 40% to 88% of image height. Its screen is a uniform very dark navy/near-black clean surface with no text, icons, glare, diagrams or gradients that would interfere with draggable puzzle tiles. Its restrained luminous cyan bezel can have thin warm-gold hardware accents. The machine is visible behind and to the RIGHT of the monitor, from its lower gold core up to wider upper tiers cropped by the image top. The monitor must not obscure the entire machine. Leave the top-left background showing the same blue dusk mountains and angular windows for continuity. Part of the maintenance pedestal may be visible beneath the monitor.

Style: richly lit high-quality stylized cinematic 3D game render, sumptuous reflective gold on the machine and curved glass, luxurious mechanical detail, coherent same-room architecture and scale. Strong screen readability. No smoke or damage yet. No visual success message, no labels, no letters, no numbers, no HUD, no drone or people, no weapons, no borders, no watermark. One continuous scene.

## Überarbeitung V3 – aktueller Bildstand

V3 ersetzt V2 als Grundlage: keine horizontalen Glasteilungen mehr, eine
kontinuierliche gebogene reflektierende Schutzscheibe, in der Nahaufnahme
klar erkennbare Fenster-/Lichtreflexionen. Diagonaler Licht- und Farbverlauf
von dunklem kühlem Vordergrund links unten zum hellen goldenen PICO rechts oben.
Ladestation, Geländer, Terminal und Nebenanlagen verwenden Graphit/Stahl und
weiße bzw. mintgrüne Lichter. Goldene Lichtquellen sind auf PICO konzentriert.
Die frontale freie Bildschirmfläche bleibt für das Rätsel erhalten.

- Raum: `assets/images/finales/pico-quantum-lab-v3.webp`
- Terminal: `assets/images/finales/pico-quantum-terminal-v3.webp`
- Mit eingebautem Imagegen editiert; WebP Qualität 94, ohne Beschnitt oder Größenänderung.
- Ältere Fassungen bleiben erhalten; noch keine Missionsseite umgestellt.

### Raum V3 – verwendeter Prompt

Use case: lighting-weather plus precise-object-edit.
Asset type: finished 16:9 game environment background, revised art direction.
Image 1 is the edit target. Preserve its exact camera angle, framing, room architecture, mountain windows, charging station position, stairwell opening and rails, terminal position, and the towering quantum computer growing wider above the frame.

Change these specific things:
1. REMOVE every external HORIZONTAL HOOP, divider, seam and metal rail crossing the protective GLASS around PICO. Replace the segmented safety glazing with ONE CONTINUOUS SEAMLESS CURVED clear glass shield. The shield must remain very visibly glass: physically coherent, broad softly curved reflections of the tall cool window frames, a few elongated white specular highlights and the gold machinery, faint cool edge tint, natural variation in reflected intensity. NO horizontal bands drawn across it. Keep the actual gold cryostat plates and hardware INSIDE the enclosure: those belong to the machine, not the glass.
2. Art-direct the LIGHTING much more dramatically. Use a controlled cinematic CHIAROSCURO and diagonal COLOR/LUMINANCE GRADIENT from DARK COOL LOWER LEFT to RADIANT WARM GOLD UPPER RIGHT. PICO alone is the luminous golden hero, with striking gold glints and warm glowing inner mechanisms against deeper shadow. Preserve intricate gold mechanical detail, avoid blown-out white blobs. Keep the machine tall and widening upward beyond the top edge.
3. REMOVE all amber/orange/gold artificial lights and gold materials OUTSIDE the quantum computer. The charger, battery modules, rails, stair treads, floor strips, auxiliary cabinets and terminal become graphite/steel with restrained COOL WHITE and pale MINT/GREEN indicator lighting. Far less bright than PICO. The left charging dock is clearly readable but sits in cool moody shadow, with white docking contacts and a few green charge indicators, not a rival glowing centerpiece.
4. Darken the blue mountain background and remove the orange sunset strip: cool indigo/violet twilight. Keep enough architectural and floor detail to navigate. Foreground-left and stairwell are the darkest area; illumination builds gently diagonally toward the right-hand computer. Warm reflected light is allowed only where it naturally spills from PICO onto the adjacent right-hand floor and glass. No warm light sources elsewhere.

Premium polished cinematic stylized 3D spy-game render. Subtle atmospheric depth, clean air with no smoke or damage yet. Strong visual focus on the gold quantum computer, tasteful high contrast, restrained bloom.
No text, labels, numbers, logos, HUD, people, visible drone, additional objects, borders or watermark. One single image.

### Terminal V3 – verwendeter Prompt

Use case: lighting-weather plus precise-object-edit.
Asset type: finished 16:9 drone-camera view for an interactive game puzzle.
Input Image 1 is the EDIT TARGET: the frontal PICO terminal close-up. Preserve exactly its frontal rectangular screen, the screen's position and size, its clean blank dark usable surface, pedestal, camera framing and machine geometry.
Input Image 2 is the updated wide room view: use this as the definitive LIGHTING, COLOR and seamless GLASS reference.

Make these focused revisions to Image 1:
- Remove ALL the external horizontal hoop rails and panel divisions across the curved protective glass. It must become ONE seamless continuous curved glass shield with no horizontal bars or banding. Keep the actual INTERNAL gold cryostat rings and plates.
- CRITICAL: make the protective GLASS visibly REFLECTIVE in this close-up. Add distinct, realistic broad curved reflections of the mountain window frames and cool white light strips, plus long soft silver-blue highlight shapes along the curvature. Let a few faint reflected blue mountain silhouettes and ghosted warm machine lights skim across the surface. Slight Fresnel reflectivity toward its curved sides. These should feel like real glass reflections with depth, not metal dividers, not sharp horizontal lines. Some reflections gently overlap the machine so it is clearly seen THROUGH glass, while the intricately detailed gold hardware remains legible. Do not put reflections on the dark terminal display.
- Strong cinematic chiaroscuro: a DIAGONAL transition from very dark cool graphite/indigo LOWER LEFT toward luminous warm GOLD UPPER RIGHT. The gold computer is the only warm luminous subject. It has intensely glowing warm inner filaments, tiny gold specular glints and clearly defined sparkling polished mechanisms, with carefully controlled bloom.
- All orange/gold lighting on the MONITOR casing, pedestal, auxiliary room equipment and floor-edge fixtures becomes restrained cool WHITE or pale MINT/GREEN light. Their metal is graphite and steel, no gold embellishments. Screen border thinner-looking and subtler, pale cool mint-white, not an intense neon cyan rectangle competing with the computer.
- Deepen shadows on the foreground monitor body and left-hand room; keep the usable rectangular dark screen distinctly outlined and fully visible. Preserve completely horizontal top/bottom and vertical left/right screen edges, no perspective skew.
- Blue mountains and windows in the upper left become moody dim indigo twilight, remove the orange sunset glow. Warm floor/glass reflections near the right machine may remain because they originate at PICO.

Rich premium cinematic stylized 3D, beautiful physically coherent glass reflections, sophisticated dramatic light hierarchy, consistent with Image 2. No smoke or damage yet. No words, symbols, icons, numbers, UI, people, visible drone, extra props, borders or watermark.

## Überarbeitung V4 – Energieflasche und futuristisches Terminal (aktueller Stand)

- Modus: eingebautes Imagegen, gezielte Bearbeitung bestehender V3-Renderings.
- Terminal: dünne durchgehende Glasfläche mit feiner weiß-mintgrüner Kante und schlankem Träger; frontale breite Interaktionsfläche erhalten.
- Raum: grüne Energieflasche mit weißem Blitz links im unteren Drittel; kleines Terminal passend zur Nahaufnahme aktualisiert.
- Flaschenfuß im fertigen Rendering ungefähr bei Pixel (204, 629), nicht exakt am im Prompt gewünschten (174, 627). Bei Einbindung den tatsächlichen Fundpunkt ausrichten; alte Spielkoordinaten nicht unverändert übernehmen.
- Bilddateien: `assets/images/finales/pico-quantum-lab-v4.webp` (1672 × 941, 295584 Bytes) und `assets/images/finales/pico-quantum-terminal-v4.webp` (1672 × 941, 311470 Bytes). WebP-Konvertierung ohne Beschnitt, Qualität 94.
- V1–V3 bleiben als frühere Entwürfe erhalten. V4 ist die aktuelle Basis; noch keine Einbindung in produktive Missionen.

### Layoutprobe

`prototypes/pico-terminal-fit.html` zeigt vier Module und vier Zielplätze als echte bedienbare Oberfläche auf dem Terminal. Eigenständiger Entwurf ohne Speicherung. Die Ansicht braucht Platz über die Inhaltsbreite statt des bisherigen geteilten Codeeditor-Layouts; Hinweise stehen außerhalb des Displays. Unter 701 Pixel Viewportbreite wechselt die Bedienfläche in einen separaten Bereich unter das Bild. Eine Höhenbegrenzung der Szene für die endgültige Missionsansicht ist noch abzustimmen; in der Laptop-Probe stehen die Hinweise unterhalb des ersten sichtbaren Bereichs.

Geprüft per Playwright am 26.09.2026: Laptop 1366 × 768 (Chromium), Tablet 768 × 1024 (WebKit), schmale Tabletbreite 701 × 900 (Chromium), Handy 390 × 844 (Chromium). Alle Ziele innerhalb der Bedienfläche, kein horizontaler Überlauf, richtige und falsche Reihenfolge sowie Tastaturabschluss geprüft; zusätzlich Ziehen auf dem Laptop. Bedienziele mindestens 64 / 44 / 44 / 48 Pixel. Screenshots auf Laptop und Tablet visuell geprüft.

### Terminal V4 – verwendeter Prompt

Use case: precise-object-edit.
Asset type: 16:9 game background with a front-facing interactive puzzle terminal.
Image 1 is the EDIT TARGET. Change ONLY the terminal's physical enclosure, bezel and supporting pedestal in the left/center foreground. Everything behind it must remain unchanged: the gold quantum machine at right, its seamless reflective curved glass, visible window reflections, mountains, camera perspective, and the dramatic lighting from dark cool lower-left toward warm gold upper-right.

The user finds the current terminal case too retro and industrial. Replace its thick segmented armor, chunky chamfered corners, exposed fasteners, layered metal plates and bulky pedestal with a clearly futuristic elegant interface:
- One continuous thin edge-to-edge dark glass display slab with beautifully precise shallow softly rounded corners.
- A very slim seamless graphite/pearl-ceramic edge and an extremely fine pale mint-white light line.
- A subtle transparent polished glass edge, high-end futuristic materials, understated physical thickness.
- Minimal sculptural support: a clean narrow swept support/levitation-style docking spine below the display, not a bulky old equipment cabinet.
- No mechanical buttons, screws, rivets, knobs, vent grills or decorative armor on the display enclosure.
- No gold/amber lights or gold trim on the terminal.
It should look like an advanced integrated control surface from a sophisticated future, not a rugged 1980s monitor, not a laptop.

CRITICAL: Preserve or slightly INCREASE the current usable inner screen area and preserve its unusually WIDE aspect ratio. The screen is perfectly FRONT-ON: horizontal parallel top and bottom, vertical parallel sides, zero perspective/trapezoid distortion. Approximate inner-screen bounds in this 1672x941 composition: x=220 to 1020, y=380 to 710. The usable screen stays completely dark, blank and matte enough for overlaying four draggable game tiles. No reflections over this interaction area. Keep its whole surface visible. The gold machine remains visible beside and behind it, unobscured. Thin frame should give more breathing room, not shrink the screen.

Maintain the exact luminous glass reflections on the protective enclosure of the computer, cinematic visual hierarchy and polished stylized 3D quality of the reference.
No text, graphics, numbers, logo, UI, people, drone, smoke, damage, watermark or image borders. One complete image.

### Raumübersicht V4 – verwendeter Prompt

Use case: precise-object-edit.
Asset type: 16:9 gameplay navigation background.
Image 1 is the EDIT TARGET: the latest PICO laboratory overview.
Image 2 is the new futuristic close-up terminal design reference; use it only to update the small terminal near PICO consistently.
Preserve the camera, framing, mountain windows, stairwell, railings, charger at rear-left, tall gold computer, seamless reflective curved protective glass, and existing diagonal chiaroscuro from dark cool lower-left to bright golden upper-right.

Requested edit 1 — ENERGY BOTTLE:
Add ONE small clearly visible portable rechargeable energy canister standing on the open floor at the FAR LEFT, LOWER THIRD, near the existing game target coordinates.
Precise placement in the original 1672 by 941 composition: center of its small base at approximately pixel (174,627), equivalently 10.4% from the LEFT and 66.7% from the TOP. This corresponds to the gameplay point x=-380,y=-90 in a 960x540 centered coordinate system. The floor contact point should be there; the bottle extends upright above it. Do not put it inside the rear charging alcove, in the middle, on the stairs, or behind the foreground railing.
Design: an elegant bottle-shaped futuristic ENERGY CELL about 95 pixels tall and 48 pixels wide at this scale, transparent emerald-green body containing luminous green charge, compact graphite end caps and a small practical connector on top. A clean highly recognizable bright WHITE LIGHTNING-BOLT symbol is visible on its front. It is an energy battery, not a drink. A tiny low docking foot keeps it upright. Soft localized green reflection on the floor. Distinct enough to discover in the game, but much less bright than the large gold computer. No words or digits on the bottle.

Requested edit 2 — SMALL TERMINAL:
Update only the small terminal in front-left of PICO to match Image 2: thin seamless dark glass slab, softly rounded corners, very fine white/mint perimeter, narrow clean sculptural support, no chunky riveted armor or retro casing. Keep its existing small size and position in this wide overview. Empty dark display.

No other changes. No extra objects, words, labels, arrows, coordinate marks, UI, people, visible drone, smoke, damage, borders or watermark. Keep all non-PICO artificial lighting cool white or mint, gold confined to PICO and its nearby reflections.

### Raumübersicht V4 – anschließende Positionskorrektur

Use case: precise-object-edit.
Image 1 is the edit target. Make exactly ONE small positional correction and preserve every other pixel/element as closely as possible.
Move the single small green rechargeable energy bottle with its white lightning symbol and its tiny floor reflection LEFT by approximately 100 pixels and UP by approximately 17 pixels within this 1672 x 941 image.
Its CURRENT base center is approximately (273,644). Its REQUIRED NEW base center is (174,627), about 10.4% of image width from the left edge and 66.7% of image height from the top. Put it on the visible floor just inside/behind the left foreground railing, well below the rear charging dock. Keep it fully visible and upright, not on the railing. Preserve the bottle's exact design, scale, green glow and white lightning bolt. There must be only ONE bottle; restore ordinary floor where it originally stood.
Do not change lighting, computer, glass reflections, terminal, staircase, charger, mountains, architecture, framing or image dimensions. No added text or overlays.
