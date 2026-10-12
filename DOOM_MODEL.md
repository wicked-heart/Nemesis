# DOOM_MODEL.md: the 3D Doom model

The 3D Doom on every screen is **"Doctor Doom's Mask" by Nicolas_Laube**
(https://sketchfab.com/3d-models/doctor-dooms-mask-8db5464072f341a994ad1c729d9080f7): the iron mask,
the head under it, the green hood/cloak and the copper clasps on a chain. Licence: **CC BY 4.0** (free to
use, also commercially, as long as the author is credited). The credit is the small grey line in the
Landing footer — **keep it** while this model is used.

## Files

| File | What it is |
|---|---|
| `public/models/doom.glb` | The original download from Sketchfab (9.3 MB). **Not used by the site**; it can be deleted (it is only kept as the source, and it gets uploaded with every deploy while it is there). |
| `public/models/doom-full.glb` | What the site loads (4.1 MB): the same 19 parts, with the PNG textures re-saved as JPEG. |
| `public/models/doom-poster.webp`, `doom-poster-red.webp` | Still images of the 3D Doom (green / red eyes, see-through background), rendered from the model. Shown while the 3D loads and on devices without 3D (`doom3d/DoomPoster.tsx`). |
| `public/models/doom-face.webp` | A crop of Doom's face for small icons (`DoomFace.tsx`) and the first loading screen (`index.html`). |

If the model changes, render new stills too (ask Claude: "render new Doom posters from the model").

The slimmed file was made by a small script that repacks the model and re-saves its textures (nothing
else changed). To redo it, ask Claude: "slim the Doom glb, keep all parts".

## How the site uses it

- `src/components/doom3d/config.ts` → `DOOM_MODEL_URL` (the file the site loads).
- `src/components/doom3d/maskModel.ts` → `prepareMask()`: centres and scales the model and finds the eyes
  (from the mask part named `eyelids_low`).
- `src/components/doom3d/DoomScene.tsx` → dark studio lighting, the green (or red) glow in the eyes, and
  the motion (rises in, floats, turns to the cursor). It fits the model by height and width, so it is never
  cut off on narrow boxes.
- If the file is missing or broken, every screen shows the flat SVG mask instead (nothing breaks).

## Using a different model

1. Export / download a **.glb** facing **+Z** with **Y up**.
2. Put it in `public/models/` and set `DOOM_MODEL_URL` in `config.ts`.
3. If it has no part named `eyelids_low`, the eye glow uses default positions: ask Claude to point it at
   the right part.
4. Check its licence and add the credit the licence asks for.
