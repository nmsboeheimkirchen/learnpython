# Hangartor: zwei Bildzustände

Stand: 2026-08-31.

- **Geschlossen / Missionsbeginn:** `helicopter-hangar-closed.webp`.
- **Offen / Fluchtweg frei:** `helicopter-hangar-final.webp` (vorhandenes Original, unverändert).
- Beide WebP-Bilder haben 1717 × 916 Pixel und dieselbe Bildaufteilung. Die offene Variante bleibt unter ihrem bisherigen Dateinamen erhalten, damit vorhandene Verweise nicht brechen.
- Die Landingpage und Stufe 2 verwenden zunächst den geschlossenen Zustand. Nach einer erfolgreichen JSON-Konfiguration wechselt Stufe 2 auf die offene Variante.
- Das Hangartor startet geschlossen und muss **geöffnet** werden. Es schließt nicht als Countdown.
- JSON-Eintrag: `daten["hangar"]["tor_offen"] = True`. Navigation und Rotor haben davon getrennte Online-Zustände in `daten["cockpit"]`.

## Erstellung

Die geschlossene Variante wurde mit dem integrierten **Imagegen** im Edit-Modus aus dem vorhandenen offenen Bild erzeugt. Anschließend wurde sie ohne inhaltliche Änderung als weboptimiertes WebP gespeichert. Das offene Original wurde nicht neu generiert oder überschrieben.

### Finaler Bildprompt

```text
Use case: precise-object-edit
Asset type: paired background state for an educational Python browser game, hangar CLOSED variant.
Input image 1: EDIT TARGET, the existing final open-hangar artwork. Preserve this exact composition.
Primary request: change ONLY the currently open large octagonal hangar doorway in the upper-right background, behind the parked blue helicopter, to a clearly FULLY CLOSED sci-fi industrial hangar gate. The gate must fill the entire existing doorway, with two substantial dark metallic sliding door panels meeting at a central vertical seam, subtle violet reflections, restrained cyan edge lighting, believable mechanical panel detailing. No view of the sky, mountains, or exterior through the closed gate. Preserve the exact octagonal doorway frame, its location and perspective.
Critical invariants: keep the existing helicopter completely unchanged including every rotor blade, cockpit, faceted cyan-blue fuselage, tail, landing skids, exact position, scale and direction. Keep the foreground cyan control terminal, cables, floor, landing-pad rings, cave walls, lights, haze, and dark negative space on the left unchanged. Do not move the camera or crop. Keep the same wide 1717:916 aspect ratio and framing. Only the background door area and its immediate physically necessary light reflections should change. Keep the original cinematic dark violet/cyan 3D rendering style. This will be paired with the original image as the OPEN state, so minimize all unrelated differences.
Avoid: additional aircraft, people, text, interface labels, logos, watermarks, new props, rotor motion, altered helicopter silhouette, redesigned scene.
```
