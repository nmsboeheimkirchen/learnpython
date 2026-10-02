# PICO – Transparente Rauchebenen

Stand: 01.10.2026. Mit dem eingebauten Imagegen-Werkzeug erzeugt, als getrennte
Rauchebenen in `pico_level4.html` verwendet. Warnlicht entsteht unabhängig als SVG,
Displayrauschen als eigenes Canvas; weder Licht noch Bildschirm sind in die
Rauchbilder eingebrannt. Originale und verworfene Versuche bleiben erhalten.

Die endgültige starke Ebene ist 1671 × 941 Pixel groß, ein Pixel schmaler als
die Grundaufnahme. Sie wurde auf Dateiebene nicht verändert; im Browser wird
sie mit `object-fit:fill` auf die gemeinsame Kamerafläche gelegt (0,06 % Differenz
in der Breite). Die leichte Ebene hat genau 1672 × 941 Pixel. Monitor und Zettel
liegen als eigene unveränderte Vordergrundmaske vor dem Rauch.


Mode: built-in image_gen; transparent_background: true for all four calls.
Skill: C:/Users/Cy-X/.codex/skills/.system/imagegen/SKILL.md
Reference: assets/images/finales/pico-command-terminal-v2.webp (inspected before generation).
Purpose: two independent smoke overlays; no lighting, screen disturbance, objects or scene baked into them.

## Final assets and selected sources
- Light: assets/images/finales/pico-smoke-light-v1.webp
  - Source: C:/Users/Cy-X/.codex/generated_images/01a0f946-c373-7a80-8f6c-3a4b0842283a/exec-522f8016-cb8d-46b2-9687-4b472bcbd9a4.png
  - 1672 × 941, RGBA, lossless WebP, 105384 bytes.
  - Alpha 0 pixels: 1503886; partial-alpha pixels: 69466; opaque-alpha pixels: 0; alpha max: 248.
  - Visible bounds (alpha >= 8): x=1127..1486, y=398..737.
  - Exact nonzero bounds: x=966..1496, y=291..940; includes sparse alpha<8 residual specks.
  - Entire frame mean alpha: 5.5302/255. Post-it area x<980,y>=670 has 0 pixels with alpha >=8.
- Heavy: assets/images/finales/pico-smoke-heavy-v1.webp
  - Source: C:/Users/Cy-X/.codex/generated_images/01a0f946-c373-7a80-8f6c-3a4b0842283a/exec-569c2672-2dce-40ed-8832-306f9776403c.png
  - **1671 × 941**, RGBA, lossless WebP, 575010 bytes.
  - Generation returned 1 px less width than requested. Preserved unchanged; no resampling, cropping or silent geometry correction.
  - Alpha 0 pixels: 1083710; partial-alpha pixels: 488701; opaque-alpha pixels: 0; alpha max: 254.
  - Visible bounds (alpha >= 8): x=1009..1670, y=0..843.
  - Exact nonzero bounds: x=129..1670, y=0..915; includes sparse alpha<8 residual specks.
  - Entire frame mean alpha: 72.2784/255. Post-it area x<980,y>=670 has 0 pixels with alpha >=8.
  - Smoke at upper left fringe x1009 overlaps only the area above the terminal; no smoke extends over the display values or post-its.

Export: sharp(source).webp({lossless:true, effort:6}); preserved generated alpha, no image editing.
Decoded comparison to the selected PNGs: 0 alpha differences, 0 RGB differences at every nontransparent pixel for both exports. Some image viewers display colored artifacts in fully transparent RGB; these are not visible pixels (alpha=0). Integration should composite using alpha normally.
Validation: loaded both final WebPs with view_image. Only neutral grey smoke visible, no pasted checkerboard or opaque backdrop. Alpha statistics computed from decoded raw RGBA. Output dimensions and caveat reported to integrating agent.
For final opacity, retain runtime control; early smoke should stay subtle and may fade in below full opacity.

## Initial light prompt
Use case: compositing
Asset type: isolated transparent smoke overlay for a layered cinematic 3D game scene.
Reference image 1: geometry/camera/position reference ONLY. It must NOT appear in the output.
Primary request: render ONLY a small amount of delicate pale grey and white translucent smoke/vapor, no other objects, on a genuinely transparent RGBA canvas. This is an onset-of-failure smoke overlay composited over the reference quantum computer.
Canvas and framing: 1672 x 941 pixels, exact same full reference framing with no crop, no zoom, no reframing. Keep the left 65% of the canvas EMPTY/fully transparent. Smoke originates near the quantum core base at reference pixel x=1330,y=685 and curls gently upward, localized within x=1160..1550 and y=330..735. Fine wisps rising on the right of the empty canvas; small soft curls, sparse and airy. At least 85 percent of the computer will remain clearly visible through and around the smoke when composited.
Style: premium photorealistic volumetric 3D smoke, detailed fine fluid turbulence, soft edges and natural subtle density variation, neutral pale grey and offwhite, subtle ambient shadow within wisps. Natural true partial alpha throughout the vapor, fading smoothly into alpha zero.
Absolute constraints: the ONLY visible pixels are isolated wisps of smoke. DO NOT render the reference scene, machinery, gold metal, glass cylinder, room, terminal, screen, sticky notes, post-its, lettering, furniture, floor, lights, glow, fire, sparks, red colors, borders or shadows on a background. No baked-in red light because warning lights are a separate animation layer. No black or white solid background. No checkerboard painted into the image. Everything outside the smoke must have alpha zero. The large blank area at left is intentional and must remain transparent.

Initial output: C:/Users/Cy-X/.codex/generated_images/01a0f946-c373-7a80-8f6c-3a4b0842283a/exec-4332dc98-7c6e-4fd9-925e-efa5ebd062e2.png
Rejected: smoke too tall; true RGBA and 1672×941.

## Selected light correction prompt
Use case: precise-object-edit
Edit target: the attached isolated transparent smoke layer. Change ONLY smoke placement and density, preserving the 1672×941 canvas with true alpha. Reference proportions are important because this is a game overlay.

The existing smoke is much too tall. Replace it with a SMALL cluster of delicate thin grey-white vapor wisps floating at the LOWER RIGHT. The only smoke should be contained within the rectangle from x=1170,y=420 to x=1510,y=730 on the 1672×941 canvas. Its base is near x=1340,y=695. Its top MUST stop near y=420, so the ENTIRE top 40 percent of the image is empty transparent space. The ENTIRE left 68 percent is also transparent. The entire bottom 20 percent is empty transparent space. Smoke looks like a small tentative cooling vent emission, very faint, tiny subtle curls, airy wispy and largely see-through, occupying less than 6 percent of total image area. NOT a tall plume. NO smoke above y=400. Small horizontal curls, NOT a large vertical column.

No crop, zoom or reframing. Output only that little lower-right smoke wisp cluster on genuine full transparency. No objects, no machinery, no shadows outside vapor, no backgrounds, no checkerboard, no glow/light/fire/sparks, no color other than neutral grey/off-white smoke. Transparent edges should be fine and natural. Keep exactly 1672×941 pixels.

## Initial heavy prompt
Use case: compositing
Asset type: isolated transparent dense smoke overlay for a layered cinematic 3D game scene.
Reference image 1: geometry/camera/position reference ONLY. It must NOT appear in the output.
Primary request: render ONLY heavy volumetric neutral-grey smoke, no other objects, on a genuinely transparent RGBA canvas. This is the final dense core-failure smoke overlay composited over the quantum computer in the reference.
Canvas and framing: 1672 x 941 pixels, same full reference framing with no crop, no zoom, no reframing. The left 64% of the canvas must be completely empty/transparent. Smoke originates at the quantum core base at reference pixel x=1330,y=685 and billows upward and right. Dense sculpted turbulent grey smoke clouds occupy ONLY x=1080..1672, y=0..800. Rounded billowing plume at the base rises and becomes larger towards the top and right, some cloud naturally cropped by the upper and right edges. Preserve transparent bottom from y=820 onward and entirely transparent left area x<1070. No smoke over the terminal or the three sticky notes at left.
Style: premium photorealistic 3D fluid-simulation smoke, dense grey interior volume with softer wispy outer turbulence, deep but neutral grey shading, offwhite highlights, very fine soft alpha edges. Smoke looks substantial, like machine cooling failure, not fog spread evenly over the room.
Absolute constraints: the ONLY visible pixels are smoke. DO NOT render the reference scene, machinery, gold metal, glass, room, terminal, screen, sticky notes, letters, furniture, floor, lighting equipment, glow, fire, sparks, red/orange colors, borders or background shadows. No baked-in red light because warning lights are a separate animation layer. No black/white solid background. No checkerboard painted into the image. Everything outside the smoke must have alpha zero and the wispy edges must have real partial alpha.

Initial output: C:/Users/Cy-X/.codex/generated_images/01a0f946-c373-7a80-8f6c-3a4b0842283a/exec-7b5e1780-c919-4fd3-8926-74d823e2dd2e.png
Rejected: smoke extended farther left and down; true RGBA and 1672×941.

## Selected heavy correction prompt
Use case: precise-object-edit
Edit target: isolated transparent smoke layer attached. Change ONLY the horizontal containment and bottom edge of the smoke, keep the beautifully detailed 3D smoke style and 1672×941 true RGBA canvas.
Primary request: constrain this grey volumetric smoke plume to the RIGHTMOST THIRD of the canvas. It currently extends too far left and down. All visible smoke must be strictly RIGHT of x=1080 on the 1672 pixel canvas. No wisps left of this boundary. The bottommost wisps must finish at y=790, leaving the entire bottom 150 pixels transparent. The plume originates around x=1370,y=720, expands upwards and to the right until it leaves the top and right edge of the canvas. The dense plume must not spread left onto a terminal that will be underneath the empty transparent left area. Keep the right 35 percent filled with dramatic thick rolling grey smoke volume, soft realistically turbulent partial-alpha perimeter. The left two thirds must be entirely alpha=0. No crop, no zoom, do not change canvas size, simply regenerate the smoke correctly positioned at far right within x=1080..1672 and y=0..800.
Output ONLY smoke, no background, no room or machine, no terminal or objects, no text, no fire/sparks/color lighting. Keep it neutral grey with soft shading. No checkerboard; genuine transparent alpha background. The empty space is intentional and must remain empty.
