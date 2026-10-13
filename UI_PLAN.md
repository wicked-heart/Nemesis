# NEMESIS: UI redesign + 3D Doom plan

Status: **Phases 1–7 done, then V2–V8** (2026-10-12, branch `ui-redesign`, not committed yet). The current
look: the club site's dot background (V3) and the full 3D Doom model by Nicolas_Laube (V5). Phase 6 is ready
and tested, waiting only for a Blender model (optional: the code-built Doom is complete on its own).
Doubts in section 9 were answered "go with the defaults".

### Progress log
- **Phase 1: design system (done).** `tailwind.config.js` remaps the palettes the screens already use
  (`emerald` → pure green, `cyan` → teal-green, `gray`/`zinc` → green-tinted iron) and adds `doom-*` tokens,
  fonts (Geist / JetBrains Mono / Cinzel) and softer corners. `src/index.css` restyles the shared classes:
  calm iron backdrop with a faint dot field (scanlines retired outside the lock screen), glass panels with a
  green top light, solid green pill buttons + dark glass secondary buttons, rounded inputs with a green focus
  ring. Buttons/inputs moved into Tailwind's components layer, so each element's own size classes work (this
  also fixed the Entry input icons overlapping the text). Decorative gold → green/steel in every screen;
  amber kept only for warnings / penalty pending / podium, red for penalties. Doom mask SVG, ember canvas,
  favicon and page title updated. Only colour values changed in the screen files (checked automatically
  line by line); no logic touched. Typecheck + build pass; lint errors are the same 25 that were there before.
- **Phase 2: every screen's layout (done, 2026-10-11).** Landing: full-screen hero (Doom emblem with
  ROUND 1 / ROUND 2 labels — the 3D slot for Phase 4), then "The trial", the 10 domains, the full rules as a
  section (same content as the Rules window, which still works), and a final "Enter the arena" call.
  Entry: form left, Doom right ("Doom is watching."). Game screen: HUD top bar (sticky on tablet/laptop only),
  big timer, slim 15-step clue rail, tab pills, large clue card, guess box; Round 2 card moved to a right-hand
  column on laptops (below the game on phones). Lock screen: same behaviour, cleaner panels, Cinzel title
  (it used a `font-cinzel` class that never existed). Completion: Doom's verdict, domain reveal, big stat cards.
  Round 2 card: stacked teammates joined by a glowing link, big combined score. Admin: sticky top bar, big KPI
  numbers, pill tabs, solid amber "Unlock" button, no moving embers (kept fast). Fixed: every Doom mask now
  uses its own gradient ids (a hidden mask earlier on the page made a visible one render dark).
  Checked with a script that compares each file with `main`: no handler, condition, data binding or form
  field was removed or changed. Typecheck + build pass; lint 23 errors, all old (2 old ones fixed, none new).
- **Phase 3: motion (done).** `FlowField.tsx`: the club site's live dot field (GPU shader) in green, behind
  Landing / Entry / Admin login / Completion (pauses when hidden, still frame for Reduce Motion, falls back to
  the CSS backdrop). `motion/Reveal.tsx`: headings rise word by word, sections fade up on scroll. Hero
  entrance, label signal lines, header "Enter Round 1" button after the hero. `index.html`: loading screen
  (mask outline draws itself) that only appears if loading takes over 0.7 s. **Fixed:** `overflow-x: hidden`
  on html+body silently broke every `position: sticky` (now `overflow-x: clip`).
- **Phase 4: 3D Doom on Landing (done).** `doom3d/`: code-built Doom (`doomModel.ts`: plated iron mask with
  eye slits and grille, hood, cloak, tunic, crossed gauntlets, medallions), studio lighting, scroll story in
  `DoomScene.tsx` (hero → mask blows apart into plates → 10 domain runes orbit → 15 clue plates light up →
  eyes turn red). Pinned stage + 4 story panels in `Landing.tsx` (`DoomStory.tsx` measures scroll).
  Intro: plates fly in and weld, sparks, eyes ignite. Follows the cursor. 3D code loads on demand (~232 KB gzip).
- **Phase 5: Doom on other screens (done).** Entry (`watch`: follows cursor, eyes flare as you type, flash on
  submit — read from page events, no form code touched), lock screen (`judge`: red eyes, leaning in; 3D code
  preloaded 4 s after the app opens), Completion (`win` / `lose`), Admin login (`mask`, head only).
  The game screen (Dashboard) has **no 3D** on purpose. Every spot falls back to the SVG mask.
- **Phase 6: model swap (ready, tested).** `doom3d/config.ts` → `DOOM_MODEL_URL`. Parts matched by name;
  missing parts keep the code-built version; a missing/broken file falls back to the code-built Doom with a
  console warning. Tested by exporting the code-built Doom to .glb and loading it back. Guide: `DOOM_MODEL.md`.
- **Phase 7: testing (done, on fake data).** Logic guard vs `main` (all screens: nothing removed or changed;
  `src/lib`, `src/hooks`, `App.tsx`, `main.tsx`, `supabase/` untouched), typecheck, lint (no new problems),
  production build. Screens checked at laptop + phone size. No-WebGL fallback, Reduce Motion, slow-network
  loader (production build) all pass. Speed on Intel UHD integrated graphics: Landing 143 fps hero / 103 fps
  story (worst frame 14 ms); game screen 144 fps (no WebGL there). **Not done:** a full real round against a
  test Supabase project — play one before the event.
- **V2: real content, sculpted Doom, new background (done, 2026-10-12).** The owner said the UI and model
  were still basic and asked for the friend's exact content with only the UI changed.
  - **Content:** every screen shows exactly the original text again. Removed what Phases 2–5 had added
    ("The trial", the rules section, the final call, the header button, the 4 story panels, "Doom is watching.",
    the Entry tagline); page title and share image restored. Checked by script: no visible-text difference
    from `main` in any file.
  - **Doom (`doom3d/doomModel.ts`, `textures.ts`, `DoomScene.tsx`):** rebuilt by hand in code: sculpted
    faceplate (brow ridge, eye sockets, nose ridge, cheekbones, mouth grille, chin, seams, rivets), deep
    closed hood with lining and rim, capelet with round clasps and gems, long cloak, tunic, belt, sleeves,
    collar, gauntlets with fingers. Brushed-metal and cloth surface detail generated in code (no image files),
    dark studio lighting with green rim lights. Landing story: hero → mask forges from plates → clue plates →
    domain runes; his eyes turn red while the Rules window is open.
  - **Background (`backdrop/`, replaces `FlowField.tsx`):** wordless 3D scene: drifting green smoke,
    turning sigil rings, a network of nodes with pulses travelling along the links, embers and a hex floor;
    it leans with the cursor and scroll. A calmer version sits behind the game screen and admin.
  - **Game screen:** Doom watches from the right column above the Round 2 card (laptops); his head sits at
    the top on phones.
  - **Panels:** animated green energy edge on key cards, corner brackets, a soft light that follows the
    cursor, a light sweep across the NEMESIS title, fine film grain.
  - **Speed:** removed every background blur (very costly over moving 3D), smoke drawn at half size, no
    shadows, resolution lowers itself on slow machines. Intel UHD integrated: hero 77 fps, clue part 60,
    domains 57, game screen 85 fps, input delay 27 ms. 3D code ≈ 240 KB gzip, loaded after the page shows.
  - **Fixed:** the page background on `body` hid the 3D background (now on `html`); the game/admin top bars
    used `bg-doom-void/92`, an opacity step Tailwind 3 doesn't have, so they were see-through (now `/95`).
  - **Checked (fake data):** logic guard vs `main` (only visual swaps), typecheck, lint (23, all old), build,
    laptop + phone screens, admin console, no-WebGL fallback, Reduce Motion. Still to do: one real round on
    a test Supabase project.
- **V3: club background + Doom mask only (done, 2026-10-12).** The owner didn't like V2: wanted the AI&DS Club
  site's background and **only the Doom mask** (reference photo: a grey, riveted, printed mask), no full
  figure, no story animation. Also reported a bug: a wrong guess didn't show the lock screen.
  - **Lock-screen bug: not in the app.** The client logic is byte-identical to GitHub `main` (`git diff main`
    on `src/lib`, `src/hooks`, `App.tsx`, `main.tsx`, `supabase/`: no changes; the screens' handlers and
    conditions are identical too). A fake server copying the SQL (`submit_guess`, `resolve_penalty`) shows
    the lock screen → "Pardon granted" → next clue in both the friend's original and this version (laptop
    and phone). The friend's **original** shows exactly the reported symptom (message, no lock screen, jumps
    to the next clue, can still type) when the server does not set `PENALTY_PENDING`, so the live
    database's `submit_guess` needs checking. The one colour-only edit in `src/lib/directiveRenderer.tsx`
    was reverted, so `src/lib` matches GitHub exactly.
  - **Background:** `backdrop/Backdrop.tsx` = the club's `flow-background.tsx` (same shaders, same motion,
    cursor glow, studio gradient with a clear middle on the Landing), in graphite with a hint of green.
    Removed: the 3D smoke/sigil/network/embers scene and the film grain.
  - **Mask:** `doom3d/maskModel.ts` (new): crown with centre ridge, forehead band with a rivet row, heavy
    V-shaped brow plates with rivets, framed rectangular eye slits glowing green from inside, pyramid nose,
    cheek plates, muzzle with a rivet arch over a vented mouth grille, big flat chin, jaw plates, side
    plates, all lined with rows of rivets (339). Matte painted-steel finish; mesh detail by device (about
    195k / 120k / 76k triangles). Removed: hood, cloak, tunic, belt, sleeves,
    gauntlets, plates forging, runes, clue plates, sparks, and the Landing scroll story (`DoomStory.tsx`).
  - **Landing:** the mask sits in the hero (`DoomHero.tsx`); the cards and the 10 domains are centred like
    the friend's layout (two cards side by side, a 5-column domain grid). Text unchanged.
  - **Speed:** 144 fps (screen max) on the Landing and the game screen, worst frame 7 ms (was 77 fps).
  - **Checked (fake data):** guard (no text changes, only visual swaps), typecheck, lint (23, all old),
    build, laptop + phone screens, wrong-guess lock flow (both versions). Not done: a real round on a test
    database.
- **V4: realistic mask model (done, 2026-10-12).** The owner found the code-built mask "childish" and asked
  for an accurate one, researched online. Searched Sketchfab, Printables, Cults3D, CGTrader, MakerWorld for
  free, properly licensed models; picked **"Doctor Doom's Mask" by Nicolas_Laube** (Sketchfab, CC BY 4.0,
  sculpted in Maya, textured in Substance Painter). The owner downloaded it (`public/models/doom.glb`);
  `public/models/doom-mask.glb` keeps only the mask (1.8 MB instead of 9.3). The code-built mask
  (`maskModel.ts` geometry, `textures.ts`) was removed; `maskModel.ts` now only fits the model. Credit line
  added to the Landing footer (owner approved; the licence requires it). Speed: still 144 fps.
  - **Lock-screen report:** the deployed site (nemesis-hazel.vercel.app) is byte-identical to a build of
    GitHub `main` and uses the same database; this version's logic is identical. The "no lock screen"
    behaviour came from the fake-data preview, whose mock never locked; the mock now locks like the real
    database (`?s=active`, `&reset=1` to start over). Real-database test: `npm run dev`.
  - **Checked (fake data):** every screen at laptop + phone size, guard (only text change = the credit
    line), typecheck, lint (23, all old), build.
- **V5: full Doom model + real-database lock test (done, 2026-10-12).** The owner wanted the whole
  downloaded model, not only the mask: `public/models/doom-full.glb` (mask, head, hood/cloak, clasps;
  4.1 MB, textures as JPEG). The model is fitted by height and width; the eye glow sits at the eyelids
  (in front of the head, inside the mask). Credit line now says "3D model … textures compressed".
  - **Penalty screen, tested on the real database** (owner approved one test player "UI TEST",
    RRN UITEST01, left locked): wrong guess → full-screen "SIGNAL SEVERED BY DOOM" in the new design, red
    eyes, "1 STRIKE RECORDED", "STATUS: LOCKED". Found on the way: a dev server started from another folder
    builds the page without Tailwind styles, so the lock screen is pushed to the bottom of the page;
    started inside the Nemesis folder it covers the screen as it should.
  - The fake-data preview now runs the whole journey like the real database (register → begin → wrong
    guess → lock → admin unlock) and shows a red "FAKE PREVIEW" label.
  - **Checked:** guard (only text change = the credit line), typecheck, lint (23, all old), build,
    144 fps on the Landing with the full model, laptop + phone screens.
- **V6: no more cartoon mask + cinematic hero (done, 2026-10-12).** The owner found the SVG mask shown while
  the 3D loads "childish". Now: still images of the real 3D Doom (rendered from the model, see-through) show
  while it loads and on devices without 3D, with a thin scan of light sweeping over his outline
  (`doom3d/DoomPoster.tsx`, red-eyed for the lock screen, dimmed for a loss); small icons (game/admin
  headers, round-start card, Entry) use a crop of his face (`DoomFace.tsx`); the first loading screen
  (`index.html`) shows his face in a spinning green ring. Landing hero: a bigger Doom on a lit stage (beam
  from above, floor glow), his base dissolving into the NEMESIS title like a film poster; the title fades in
  sharp (no blur). No text, logic or flow changes (checked: guard, logic files vs `main`, lock flow test).
- **V7: no lag between pages, lock-screen background, lit stage (done, 2026-10-12).** The owner felt the 3D
  lag when going from the Landing to the Entry page. Measured at laptop size: frames of 180, 97 and 188 ms.
  Cause: every page built its own 3D scene and its own background canvas (graphics context, shaders,
  textures). Now one 3D scene (`doom3d/stage.ts`, `StageRoot.tsx`) and one background canvas are built once
  and move between pages; the first build compiles shaders in the background and uploads textures one per
  frame. Result: Landing → Entry has no frame over 20 ms (slowest 14 ms); entering the lock screen ~56 ms
  at worst (its glitch effects). Each move replays Doom's short entrance.
  - **Lock screen background:** the dot background as a corrupted signal (red dots, rows tearing sideways,
    a rolling scan band, flicker), under the friend's CRT layers.
  - **Doom on a lit stage** on Entry, game screen, results and the lock screen (beam, aura, floor glow;
    red on the lock screen, dimmed after a loss).
- **V8: depth and feedback, load test, Vercel check, password text removed (done, 2026-10-12).**
  - **Depth** on the Landing hero (`motion/Depth.tsx`): Doom's stage, the title and the panel drift by
    different amounts with the cursor and the hero sinks back as you scroll (CSS translate/scale only).
  - **Clue decrypt:** each new clue is revealed top-down behind a scan line (`.clue-decrypt`, keyed by clue).
  - **Victory rings** pulse out from behind Doom on a win (`.doom-stage.is-win`).
  - **Magnetic buttons** lean a few pixels to the cursor; **signal line** runs along the top bars;
    **domain tiles** get a scan of light on hover. All off for Reduce Motion / touch where it matters.
  - **Load test:** 60 players at once on the real database, 0 errors (details in CLAUDE.md).
  - **Production build** served locally like Vercel: every file loads, no console errors, 145 fps.
  - **Admin password:** plain text removed from the SQL files (still bcrypt in the database).
- **V9: lock-screen background fills the screen, no copy/paste for players (done, 2026-10-13).**
  - **Lock screen background:** the red dots only covered the top. Two causes: (1) the corrupted signal
    used the stage's "fade out in the middle" (centred low), so the lower middle was black; it now fills the
    whole screen. (2) The screen's shake animation (`doom-screen-jitter`) makes its `fixed` layers scroll
    with the content, so on a short laptop screen the bottom had no background after scrolling. The content
    now scrolls in its own inner box and the background layers stay pinned to the screen.
  - **No copy / paste on player screens** (`NoCopy.tsx`, mounted on Landing, Entry, the game screen and
    results; not on the admin screens): blocks copy, cut, paste (keys, right-click, phone long-press and
    keyboard clipboard bar), dragging text, text selection, Ctrl+A/S/P, and printing shows a blank page.
    Typing in the guess box still works. It cannot stop screenshots or phone photos.
  - **Wheel of Doom (admin) restyled as Doom's armour** (`WheelOfDoom.tsx`, drawing only): plates alternate
    green cloak (knitted cloth, stitched hem) and brushed iron (engraved panel, rivets); a forged iron rim with
    engraved notches and rivets; copper studs like his cloak clasps; Doom's face in the hub with "DOOM" /
    "VERDICT" engraved round it; a steel pointer with a copper collar and an eye jewel. While spinning and on
    the verdict his eyes, the jewel and the glow turn red; the chosen plate is outlined in red and the others
    dim; the verdict name lands like a stamp. The friend's penalty list, sounds, spin maths and result code
    are byte-identical. Fairness checked: 18 million simulated spins with the same maths land on each penalty
    16.67% of the time. The studs sit at plate centres so the pointer flicks exactly when the tick sounds (the
    tick fires as each plate centre passes). Each frame copies pre-drawn layers pixel for pixel; the plates
    are drawn directly at rest so the names stay sharp.

---

## 0. The one rule: UI only

The game logic works. We will **not touch** any of it.

| Never changed | Why |
|---|---|
| `src/lib/api.ts`, `supabase.ts`, `types.ts`, `sound.ts` | data + server calls |
| `src/hooks/useLockStatus.ts` | lock/unlock + realtime |
| `supabase/**` | database |
| `src/App.tsx` routing logic (views, hash, session restore) | flow between screens |
| Inside components: every `useState`, `useEffect`, handler (`onClick`, `onSubmit`...), API call, `if`/condition, timer, keyboard trap | game behaviour |

**What we change:** JSX layout, `className`s, `index.css`, `index.html` (fonts/title/meta), and **new** visual-only
components (3D Doom, dot background, reveal animations).

**How we prove it:** every changed line is checked in `git diff` (only markup/style), `npm run typecheck` and
`npm run build` pass, and the full game is played end to end on a **test** Supabase project (not the live event
database): register → begin → reveal clue → wrong guess → lock screen → admin unlock → next clue → correct
guess → completion; plus timeout, Round 2 card, and every admin tab.

All work happens on a new branch `ui-redesign`, so the working version stays safe on `main`.

---

## 1. The new look: "Emerald Sovereign"

Same thinking as our club website: **calm, premium, one hero.** Today the app is busy everywhere
(scanlines, grid, glow on everything, gold + cyan + green). The new look is dark and clean, and
**the green Doom is the brightest thing on the screen**, like the blue brain on the club site.

### Colours
| Token | Colour | Used for |
|---|---|---|
| `void` | `#040605` | page background |
| `iron` | `#0b100d` | panels |
| `iron-2` | `#121a15` | raised cards, inputs |
| `line` | `rgba(170,255,200,0.08)` | borders |
| `text` | `#e7efe9` | main text |
| `muted` | `#8a9a90` | secondary text |
| `emerald` | `#22c55e` | the ONE accent: buttons, active states, highlights |
| `emerald-glow` | `#4ade80` | eye glow, focus rings, light effects |
| `cloak` | `#0f3d24` | deep green surfaces, gradients |
| `steel` | `#c9d1d6` | Doom's mask, metal details |
| `danger` | `#ef4444` | only for penalties / last minute (keeps its meaning) |
| `amber` | `#f59e0b` | only for warnings (5-min timer) |

Gold and cyan are removed as decoration. Green is the team colour, everywhere.

### Fonts (free, Google Fonts)
| Use | Font |
|---|---|
| Big titles ("NEMESIS", screen titles) | **Cinzel** (regal, kept) |
| Body text, buttons | **Geist** (same as the club site) |
| Numbers, timer, labels, codes | **JetBrains Mono** (kept) |

Orbitron is dropped (it looks dated next to Cinzel).

### Shared pieces (restyled once, used on every screen)
- **Panel**: dark iron card, thin green-tinted border, soft inner light at the top edge.
- **Button**: solid emerald pill (primary), outline pill (secondary). Light sweep on hover, press scale.
- **Input**: large, dark, green focus ring, label above in mono caps.
- **Badge/pill**: mono caps, small dot that pulses for "live" states.
- **Timer pill**: green → amber (5:00) → red pulse (1:00), same rules as now, new style.

---

## 2. Animations borrowed from our club website

| Club site effect | Nemesis version |
|---|---|
| Moving grey dot background (WebGL shader) | **Moving green dot field**: dark dots with a slow liquid of green light; brightest near Doom; reacts to the mouse. Replaces `ArcaneCanvas` embers + `cyber-grid` + `scanlines`. |
| 3D brain + scroll story | **3D Doom + scroll story** on the Landing page (section 4). |
| Word mask reveal on headings | Titles rise word by word ("NEMESIS", "Find the Flag", screen titles). |
| Sections fade/rise into view | Cards, domain grid, rules reveal on scroll. |
| INTELLIGENCE / DATA labels with a line + signal pulse | Labels beside Doom: **"ROUND 01 · FIND THE FLAG"** and **"ROUND 02 · SYNDICATE"**, with a line drawing out from Doom and a green pulse running along it. |
| Header Join button appears after the hero | **"Enter Round 1"** button appears in the header after scrolling past the hero. |
| Loading screen only on slow network | Doom's mask outline draws itself in green, only if loading is slow. |
| Reduce-motion support, cheap mode on weak phones | Same. |

The glitch / CRT effects stay **only on the Signal Lost screen**, where they mean something.

---

## 3. Where the 3D Doom appears

| Screen | 3D Doom? | What he does |
|---|---|---|
| **Landing** | ✅ **Main stage, full size** | Scroll story (section 4). The star of the app. |
| **Entry** (name + RRN) | ✅ Medium, beside the form | Stands in the background, head turns to follow the cursor; eyes glow brighter when you type; on submit, eyes flash. |
| **Dashboard** (playing) | ❌ No 3D | A 15-minute timed round needs speed and focus, and lab PCs may be weak. A small restyled SVG mask stays in the header. |
| **Signal Lost** (wrong guess) | ✅ Full screen, dramatic | Doom leans in close, eyes burn **red**, cloak sways, glitch around him. On pardon, eyes return to green and he steps back. |
| **Completion** | ✅ Medium | **Won:** he raises his head, green light burst, emerald sparks. **Failed/timeout:** he turns away, light dims. |
| **Admin login** | ✅ Small, mask only | Mask turning slowly, eyes follow the cursor. |
| **Admin console** | ❌ No 3D | Work tool: fast, clean, readable. Small SVG mask in the top bar. |

The 3D model **loads once** and is reused (cached). It only downloads on screens that use it.
If the computer can't run 3D, the improved SVG mask shows instead, so the game always works.

---

## 4. The Landing page, top to bottom

```
┌──────────────────────────────────────────────┐
│ NEMESIS            [Admin]  [Enter Round 1]* │  * appears after the hero
├──────────────────────────────────────────────┤
│  ROUND 01 ─────┐      ┌────── ROUND 02       │
│  FIND THE FLAG │  👤  │ SYNDICATE            │  ← 3D Doom (hooded, arms crossed)
│                └ DOOM ┘                      │     on a green dot field
│                N E M E S I S                 │  ← word reveal, Cinzel
│        "None shall rival Doom..."            │  ← rotating quotes (same logic)
│     [ Enter Round 1 ]  [ Rules & Protocol ]  │  ← same buttons, same handlers
└──────────────────────────────────────────────┘
        ↓ scroll: Doom stays pinned, text panels scroll over him
 Act 1  "Forged in iron."      Mask assembles from flying iron plates, eyes ignite green
 Act 2  "Ten domains."         10 glowing green runes orbit him, one per domain (the 10-domain grid)
 Act 3  "Fifteen clues."       15 small plates float in a line, lighting up one by one (clues + scoring tiers)
 Act 4  "One chance per clue." Eyes turn red, red pulse (the penalty protocol warning)
 Act 5  "Enter the arena."     Back to calm green, big Enter button
        ↓
 Rules (the same content as today's modal, now also a section) · footer
```

The **Rules modal stays** exactly as it works today (only restyled).

---

## 5. How we will make the 3D Doom

The picture you shared is the reference for the **look** (hood, iron mask, green cloak, armoured
gauntlets, arms crossed, belt). We **don't put that picture on the site** and don't trace it:
it's Marvel's artwork. We make **our own Doom-inspired model** in our green style.

### Step 1: v1 built in code (free, fast, no download)
Built directly in three.js so we can design the whole UI and animations right away:
- **Mask**: shaped metal face (lathe + extruded shapes from our SVG mask), brow ridge, nose, mouth grille, rivets. Steel material (metal 1, roughness 0.35).
- **Hood**: half-shell around the head, dark green cloth (rough, with sheen).
- **Eyes**: two glowing slits, light up / change colour.
- **Shoulders + cloak**: simple draped shapes, gentle wind sway in the shader.
- **Gauntlets** (arms crossed): rounded cylinders with ridges.

Good enough to look great at hero size with lighting, and it lets us finish everything else.

### Step 2: the real model (Blender, free)
Someone on the team (or me guiding step by step) builds a proper model in **Blender**:
- **Bust first** (head, hood, shoulders, crossed arms): 80% of the effect, much less work than a full body.
- Name the parts: `Mask`, `EyeL`, `EyeR`, `Hood`, `Cloak`, `GauntletL`, `GauntletR`, `Belt`.
- Cut the mask into ~40 plates (for the "forged" intro): `Plate_01`...`Plate_40`.
- Export `.glb`, compress (Draco + WebP textures) to **under 2 MB**, put it in `public/models/doom.glb`.
- The code then swaps v1 for the real model; **all animations keep working** because they use the part names.

AI image-to-3D tools (Meshy, Tripo...) exist, but they cost credits and would copy Marvel's design
from the picture, so **not without your OK**.

### Step 3: how he moves (same system as our club brain)
| Effect | How |
|---|---|
| Intro: forged | Mask plates fly in from all sides, spin, and click together; sparks fly (instanced particles) |
| Eyes ignite | Glow from 0 → full with a small flicker; light spills onto the mask |
| Breathing / idle | Very slow rise and fall, cloak sway |
| Follows you | Head turns a little toward the mouse / finger |
| Scroll story | Keyframed "poses" per act (turn, zoom, runes, plates, eye colour), smoothed |
| Lighting | Studio lights: cold white key light, **green rim light behind him**, soft floor glow |
| Glow | Faked with additive light planes (no heavy post-processing, so laptops stay fast) |

### New packages (free, needed for 3D)
`three`, `@react-three/fiber@8`, `@react-three/drei@9` (versions 8/9 because this app uses React 18).
3D code is **lazy-loaded**, so screens without 3D don't download it.

---

## 6. Every screen: what changes

| Screen | New design |
|---|---|
| **Landing** | Section 4. |
| **Entry** | Split screen: form on a dark panel on the left, 3D Doom on the right (on phones: Doom small on top). Big inputs, green focus, "Enter the arena" button. Same fields, same submit. |
| **Dashboard** | Clean game HUD. Top bar: player, **big timer pill**, score. Main: one large **clue card** in the centre (clue number in Cinzel, text large and readable, typewriter reveal on new clue). The 15 clue steps become a sleek progress rail. Guess box under the clue, full width. Tabs (Current / Archive / History) restyled as a segmented control. Round 2 card restyled. Same buttons, same logic, same tabs. |
| **Signal Lost** | Keeps all its behaviour and its 3 boxes. Full-screen 3D Doom with red eyes behind the content, glitch effects kept and cleaned up, strike counter big and clear. |
| **Completion** | 3D Doom verdict at top, result title with word reveal, stats as big number cards (score, time, clue, guesses), Round 2 card, exit button. |
| **Round 2 card** | Two operative cards linked by a glowing green line, combined score big in the middle, "classified" directive with the same hover/tap privacy reveal. |
| **Admin login** | Centred panel, small 3D mask, password input. |
| **Admin console** | Same features. Cleaner: KPI cards with big numbers, tables with sticky headers, row highlight, status chips (green normal / pulsing amber penalty), and a clearer "Unlock" button. No 3D, no moving background (fast). |

---

## 7. Speed and safety during the event

- No 3D and no heavy effects while a contestant is playing (Dashboard), only on the other screens.
- 3D pauses when hidden; lower quality on weak computers; plain SVG if WebGL is missing or crashes.
- Respects "Reduce motion".
- Tested on a phone and on a slow laptop (Chrome throttling) before the event.

---

## 8. Build order

| Phase | What | Result you can see |
|---|---|---|
| 1 | Branch, `npm install`, colours/fonts/buttons/panels/inputs in `index.css` | Whole app already looks new |
| 2 | Restyle all screens (section 6), no 3D yet | Every screen redesigned |
| 3 | Green dot background, word reveals, scroll reveals | Moving, alive pages |
| 4 | 3D Doom v1 (code-built) on Landing + scroll story | The "wow" landing |
| 5 | Doom on Entry, Signal Lost, Completion, Admin login | 3D moments everywhere |
| 6 | Swap in the Blender model when ready | Final character |
| 7 | Full game test on a test database, phone + slow-laptop test, typecheck, build | Ready for the event |

---

## 9. Doubts (suggested default in bold) — answered: use the defaults

1. **When is the event?** That decides whether we do the Blender model now or ship v1 first. **Ship v1 first, Blender model after.**
2. **Who builds the Blender model?** **Someone on the team, with me giving step-by-step instructions.**
3. **Full body or bust?** **Bust with crossed arms** (head, hood, shoulders, gauntlets).
4. **Remove gold completely?** **Yes, green only** (amber stays only for the 5-minute warning, red only for penalties).
5. **Rules on Landing:** **keep the modal AND show the rules as a scroll section.**
6. **Work on a branch** `ui-redesign` and you merge after testing? **Yes.**
7. **Test database:** is there a separate Supabase project for testing? **If not, I'll test only the screens and you play the full flow once.**
8. **Page title:** "Dr Doom AI Flag Hunt" → **"NEMESIS · Find the Flag"**?
