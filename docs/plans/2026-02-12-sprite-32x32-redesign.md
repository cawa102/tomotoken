# 32×32 High-Resolution Sprite Redesign Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade all 8 archetype sprite files from ~24×24 to 32×32 pixel art with professional shading, dithering, and recognizable character details.

**Architecture:** Each archetype has a sprite file (`src/art/pixel/<name>.ts`) exporting an `ArchetypeSprites` object containing a palette and 5 growth stages. The pipeline (`resolve.ts`) parses lines, applies PRNG variants, centers in canvas, and returns a `PixelCanvas`. Constants and tests already updated (CANVAS_WIDTH=32, CANVAS_HEIGHT=16, pixel canvas 32×32). Only the 8 sprite data files need redesigning.

**Tech Stack:** TypeScript, vitest, half-block ANSI rendering (▀▄█), ANSI 256 colors via chalk

---

## Pre-requisites (Already Done)

The following changes are already in the working tree and all 91 tests pass:

- `src/config/constants.ts` — `CANVAS_WIDTH=32`, `CANVAS_HEIGHT=16`
- `test/art/body.test.ts` — params `32, 16`, expects 32×32 pixel canvas
- `test/art/renderer.test.ts` — params `32, 16`, expects 16 lines × 32 chars
- `test/art/pixel-render.test.ts` — 32×32 canvas test → 16 lines
- `test/art/pixel-resolve.test.ts` — target 32×32, offset calc updated

## Sprite System Reference

### File Structure

Each sprite file exports `<name>Sprites: ArchetypeSprites`:

```typescript
import type { ArchetypeSprites, SpriteDef } from "./types.js";

const EGG: SpriteDef = {
  lines: [/* each string same length, chars: '.'=transparent, '1'-'9'=palette, '?'=variant */],
  variants: [],           // SpriteVariant[] — pixel overrides selected by PRNG
  eyePositions: [],       // [row, col][] — relative to sprite (before centering)
  gesturePixels: [],      // [row, col][] — pixels that shift for idle animation
};

export const builderSprites: ArchetypeSprites = {
  palette: { colors: [0, ...9_ANSI_256_colors] },
  stages: [EGG, INFANT, CHILD, YOUTH, COMPLETE],
};
```

### Palette Convention (indices 0-9)

| Index | Role | Notes |
|-------|------|-------|
| 0 | transparent | Always 0 |
| 1 | outline / darkest | Outer edge only |
| 2 | body main color | Majority of body fill |
| 3 | body secondary | Shading / secondary areas |
| 4 | highlight | Light-hit surfaces |
| 5 | eye white | 255 for all archetypes |
| 6 | pupil | 16 (black) for most |
| 7 | mouth / facial | Detail |
| 8 | accent A | Archetype-specific (goggles, cloak, etc.) |
| 9 | accent B | Archetype-specific (wrench, staff, etc.) |

### resolve.ts Pipeline (DO NOT MODIFY)

1. `parseLines()` — '.' → 0, '1'-'9' → int, '?' → 0 initially
2. `applyVariants()` — picks random variant, fills '?' with 50% chance (accent 8 or 9), shifts accent colors ±6 in ANSI cube
3. `centerCanvas()` — centers sprite in 32×32 target canvas
4. Returns `{ pixelCanvas, animationHints, palette }`

### Rendering (DO NOT MODIFY)

`pixelsToHalfBlocks()` encodes 2 pixel rows → 1 text row using ▀▄█ characters. 32×32 pixels → 32 chars × 16 lines.

## Pixel Art Design Rules (Apply to ALL Sprites)

```
1. SHADING: Use palette 1(dark)→2(main)→3(secondary)→4(highlight)
   - Left-upper light source: right/bottom edges get 1, left/top get 3/4

2. DITHERING: At color boundaries use checkerboard (2323 or 1212)
   - Creates smoother gradients between adjacent palette zones

3. OUTLINE: External boundary MUST be palette 1 (darkest)
   - Internal color transitions do NOT use outline color

4. EYES: Minimum 3×3 pixels per eye
   - Pattern: 5-6-5 (white-pupil-white) or 5-6-4 (white-pupil-highlight)

5. GROWTH: Sizes increase through stages within 32×32 canvas
   - Stage 0 (Egg):     ~12×14px  — oval, species color, shimmer
   - Stage 1 (Infant):  ~16×20px  — big head, tiny limbs, 3-head proportion
   - Stage 2 (Child):   ~22×26px  — species traits appear, no equipment
   - Stage 3 (Youth):   ~28×30px  — body differentiation, initial equipment
   - Stage 4 (Complete): 32×32px  — full equipment, full detail, dithering

6. ACCESSORIES: 15-25% of character area, recognizable by silhouette alone

7. LINE LENGTH: ALL lines in a stage MUST have the same character count

8. VARIANT PIXELS ('?'): Place on body edge or detail areas for PRNG variation

9. eyePositions: Coordinates of eye pixels (for blink animation)
10. gesturePixels: Coordinates of limbs/accessories (for idle animation)
```

---

## Tasks

- [ ] Task 1: Builder (Dwarf) — 32×32 Redesign

**Files:**
- Modify: `src/art/pixel/builder.ts`

**Archetype Identity:** Stocky dwarf — wide body, big beard, helmet, hammer, belt
**Body Proportion:** Wide and short (W16×H28 at complete, bottom 4 rows empty)

**Palette (keep unchanged):**
```
0=transparent, 1=outline dark orange(136), 2=body main orange(208),
3=secondary light orange(214), 4=highlight yellow(220), 5=eye white(255),
6=pupil black(16), 7=mouth pink(204), 8=beard brown(178), 9=belt/hat dark(130)
```

**Step 1: Write the sprite data**

Replace the entire file content with all 5 stages redesigned for 32×32:

```typescript
import type { ArchetypeSprites, SpriteDef } from "./types.js";

/**
 * Builder archetype: Dwarf — stocky, short, helmet, hammer, beard
 *
 * Palette:
 *   0 = transparent
 *   1 = outline/dark orange (136)
 *   2 = body main orange (208)
 *   3 = body secondary light orange (214)
 *   4 = highlight yellow (220)
 *   5 = eye white (255)
 *   6 = pupil black (16)
 *   7 = mouth/nose pink (204)
 *   8 = accent brown beard (178)
 *   9 = belt/hat dark (130)
 */

// Stage 0: Egg (~12x14px centered in canvas)
const EGG: SpriteDef = {
  lines: [
    "....1111....",
    "...133331...",
    "..13333331..",
    ".1333333331.",
    "133333333331",
    "133234333231",
    "133333333331",
    "133333433331",
    "133333333331",
    ".1333333331.",
    "..13333331..",
    "...133331...",
    "....1111....",
    "............",
  ],
  variants: [],
  eyePositions: [],
  gesturePixels: [],
};

// Stage 1: Infant (~16x20px — big head, stubby limbs, helmet bud)
const INFANT: SpriteDef = {
  lines: [
    "......1111......",
    ".....199991.....",
    "....19999991....",
    "....12222221....",
    "...1222222221...",
    "...1225562251...",
    "...1222772221...",
    "...1222222221...",
    "....12222221....",
    "....11222211....",
    ".....122221.....",
    ".....122221.....",
    ".....122221.....",
    ".....122221.....",
    ".....122221.....",
    "....1122.2211...",
    "....112...211...",
    "....11.....11...",
    "................",
    "................",
  ],
  variants: [
    { pixels: [{ x: 6, y: 6, value: 7 }] },
    { pixels: [{ x: 7, y: 6, value: 7 }] },
  ],
  eyePositions: [[5, 4], [5, 9]],
  gesturePixels: [[11, 4], [11, 9], [12, 4], [12, 9]],
};

// Stage 2: Child (~22x26px — dwarf features: sideburns, wider body)
const CHILD: SpriteDef = {
  lines: [
    ".......111111.......",
    "......19999991......",
    ".....1999999991.....",
    ".....1222222221.....",
    "....122222222221....",
    "....122556225562?...",
    "....122227722221....",
    "....122288882221....",
    "....122888888221....",
    ".....12888888221....",
    ".....11222222211....",
    "....112222222222?...",
    "...1222222222222?...",
    "...1222233222221....",
    "...1222233222221....",
    "...1222222222221....",
    "....122222222221....",
    "....112222222211....",
    "....1122..22211.....",
    "....112....2211.....",
    "....11......211.....",
    "...11........11.....",
    "......................",
    "......................",
    "......................",
    "......................",
  ],
  variants: [
    { pixels: [{ x: 8, y: 8, value: 8 }, { x: 9, y: 8, value: 8 }] },
    { pixels: [{ x: 7, y: 9, value: 8 }, { x: 8, y: 9, value: 8 }] },
  ],
  eyePositions: [[5, 5], [5, 12]],
  gesturePixels: [[12, 2], [12, 16], [13, 2], [13, 16]],
};

// Stage 3: Youth (~28x30px — beard growing, helmet, small hammer)
const YOUTH: SpriteDef = {
  lines: [
    "..........1111111...........",
    ".........199999991..........",
    "........19999999991.........",
    "........19944999991.........",
    "........122222222211........",
    ".......1222222222221........",
    "......12225562225562?.......",
    "......12222277222221........",
    "......12228882288221........",
    "......12288888888821........",
    ".......1228888888821........",
    ".......11228888882211.......",
    "........112222222211........",
    "......112222222222222?......",
    ".....1222222222222222?..44..",
    ".....1222223322222221..44..",
    ".....1222223322222221..4...",
    ".....1299999999999921.....",
    ".....1222222222222221.....",
    "......12222222222221......",
    "......12222222222221......",
    ".......1222221222221......",
    ".......1122221122221......",
    "......111111111111111.....",
    "......11.........1111.....",
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
  ],
  variants: [
    { pixels: [{ x: 9, y: 9, value: 8 }, { x: 10, y: 10, value: 8 }] },
    { pixels: [{ x: 11, y: 9, value: 8 }, { x: 12, y: 10, value: 8 }] },
  ],
  eyePositions: [[6, 6], [6, 14]],
  gesturePixels: [
    [13, 5], [13, 20], [14, 5], [14, 21],
    [14, 23], [15, 23], [14, 24], // hammer
  ],
};

// Stage 4: Complete (32×32 — full dwarf: helmet w/ rivets, braided beard, hammer, belt)
const COMPLETE: SpriteDef = {
  lines: [
    "...........999999999...........",
    "..........99449944999..........",
    ".........199999999991..........",
    ".........199999999991..........",
    "........12222222222221.........",
    ".......122222222222221.........",
    "......1222556222255621.........",
    "......1222256222256221.........",
    "......1222227722272221.........",
    "......1222888888888221.........",
    ".....122288888888882211........",
    ".....122288888888882211........",
    "......12228888888882211........",
    "......1122888888822211.........",
    ".......112222222222211.........",
    "......1122222222222222?........",
    ".....12222222222222222211..44..",
    ".....12222223322222222211.44..",
    ".....12222223322222222211.4...",
    ".....12299999999999999221.....",
    ".....12222222222222222221.....",
    ".....12222233222233222221.....",
    "......1222222222222222221.....",
    "......1222222222222222221.....",
    ".......12222221..12222221.....",
    ".......11222211..11222211.....",
    "......111111111..111111111....",
    "......11.............11111....",
    "................................",
    "................................",
    "................................",
    "................................",
  ],
  variants: [
    {
      pixels: [
        { x: 9, y: 10, value: 8 }, { x: 10, y: 11, value: 8 },
        { x: 14, y: 10, value: 8 }, { x: 15, y: 11, value: 8 },
      ],
    },
    {
      pixels: [
        { x: 10, y: 10, value: 3 }, { x: 11, y: 11, value: 3 },
        { x: 13, y: 10, value: 3 }, { x: 14, y: 11, value: 3 },
      ],
    },
  ],
  eyePositions: [[6, 7], [6, 15], [7, 7], [7, 15]],
  gesturePixels: [
    [16, 5], [16, 24], [17, 4], [17, 25],
    [16, 27], [17, 27], [16, 28], // hammer
  ],
};

export const builderSprites: ArchetypeSprites = {
  palette: {
    colors: [0, 136, 208, 214, 220, 255, 16, 204, 178, 130],
  },
  stages: [EGG, INFANT, CHILD, YOUTH, COMPLETE],
};
```

**Step 2: Run tests to verify**

Run: `npm test`
Expected: All 91 tests PASS (sprites are data; pipeline tests validate they center/render correctly)

**Step 3: Visual spot-check**

Run: `npm run build && node dist/bin/tomotoken.js show`
Expected: Dwarf character visible with helmet, beard, stocky proportions

**Step 4: Commit**

```bash
git add src/art/pixel/builder.ts
git commit -m "feat(art): redesign builder/dwarf sprites for 32×32 canvas"
```

---

- [ ] Task 2: Fixer (Goblin) — 32×32 Redesign

**Files:**
- Modify: `src/art/pixel/fixer.ts`

**Archetype Identity:** Goblin engineer — thin, wiry, big pointed ears, goggles, wrench
**Body Proportion:** Thin and wiry (W14×H30 at complete)

**Palette (keep unchanged):**
```
0=transparent, 1=outline dark red-brown(52), 2=body main red(196),
3=secondary(160), 4=highlight(124), 5=eye white(255),
6=pupil black(16), 7=mouth(204), 8=goggles(88), 9=wrench metal(247)
```

**Step 1: Write the sprite data**

Replace the entire file. Key design points:
- Ears: Large pointed triangles using palette 3, extending 4-5px beyond head width
- Goggles: Round lenses (palette 8) on forehead, with highlight reflection (palette 4)
- Wrench: Distinctive open-jaw shape in right hand (palette 9)
- Tool belt: Waist band with small shapes (palette 9)
- Body: Noticeably thinner than other archetypes
- Posture: Slightly hunched

Stage sizes: Egg 12×14, Infant 16×20, Child 22×26, Youth 28×30, Complete 32×32

**Step 2: Run tests** — `npm test` → all pass

**Step 3: Visual check** — `npm run build && node dist/bin/tomotoken.js show`

**Step 4: Commit**
```bash
git add src/art/pixel/fixer.ts
git commit -m "feat(art): redesign fixer/goblin sprites for 32×32 canvas"
```

---

- [ ] Task 3: Scholar (Wizard) — 32×32 Redesign

**Files:**
- Modify: `src/art/pixel/scholar.ts`

**Archetype Identity:** Wizard/Mage — pointy hat, flowing robes, book, staff
**Body Proportion:** Medium build (W16×H32 at complete)

**Palette (keep unchanged):**
```
0=transparent, 1=outline dark navy(33), 2=body main blue(39),
3=secondary(75), 4=highlight(111), 5=eye white(255),
6=pupil black(16), 7=mouth(204), 8=book cover(69), 9=hat star/trim(220)
```

**Step 1: Write the sprite data**

Key design points:
- Hat: Tall pointy with star/moon decorations (palette 9), visible brim
- Robes: Flowing with shading gradient (1→2→3), widening toward hem
- Book: Held open in left hand (palette 8), with page detail lines
- Staff: Optional wand in right hand with glowing tip (palette 9)
- Face: Visible below hat brim, eyes looking forward

Stage sizes: Egg 12×14, Infant 16×20, Child 22×26, Youth 28×30, Complete 32×32

**Step 2-4:** Same test/check/commit pattern.
```bash
git commit -m "feat(art): redesign scholar/wizard sprites for 32×32 canvas"
```

---

- [ ] Task 4: Guardian (Knight) — 32×32 Redesign

**Files:**
- Modify: `src/art/pixel/guardian.ts`

**Archetype Identity:** Knight — full plate armor, plumed helmet, shield, cape
**Body Proportion:** Tall and sturdy (W16×H32 at complete)

**Palette (keep unchanged):**
```
0=transparent, 1=outline darkest green(24), 2=body main green(30),
3=secondary(66), 4=highlight(102), 5=eye white(255),
6=pupil black(16), 7=visor slit(138), 8=shield emblem(220), 9=plume/cape(196)
```

**Step 1: Write the sprite data**

Key design points:
- Helmet: With visor slit (palette 7) and tall plume (palette 9) on top
- Armor: Full plate with chest emblem, shaded 1→2→3→4 gradient
- Shield: Large, held in left hand (palette 8) with emblem cross pattern
- Cape: Flowing behind body (palette 9), visible at sides
- Stance: Wide, planted, warrior posture

Stage sizes: Egg 12×14, Infant 16×20, Child 22×26, Youth 28×30, Complete 32×32

**Step 2-4:** Same pattern.
```bash
git commit -m "feat(art): redesign guardian/knight sprites for 32×32 canvas"
```

---

- [ ] Task 5: Refiner (Elf) — 32×32 Redesign

**Files:**
- Modify: `src/art/pixel/refiner.ts`

**Archetype Identity:** Elf — tall, slender, long pointed ears, flowing cloak, staff
**Body Proportion:** Tall and slender (W12×H32 at complete, narrowest archetype)

**Palette (keep unchanged):**
```
0=transparent, 1=outline dark purple(141), 2=body main purple-blue(177),
3=secondary light(213), 4=highlight(147), 5=eye white(255),
6=pupil black(16), 7=mouth(204), 8=cloak edge(183), 9=staff gold(220)
```

**Step 1: Write the sprite data**

Key design points:
- Ears: Long pointed, extending 4-5px beyond head (palette 4 tips)
- Cloak: Flowing edges on both sides (palette 8), wider toward bottom
- Staff: Held in one hand, palette 9 gold, gem/orb at top
- Hair: Flowing strands visible at later stages
- Posture: Upright, graceful, tallest body in the set

Stage sizes: Egg 12×14, Infant 16×20, Child 22×26, Youth 28×30, Complete 32×32

**Step 2-4:** Same pattern.
```bash
git commit -m "feat(art): redesign refiner/elf sprites for 32×32 canvas"
```

---

- [ ] Task 6: Scribe (Halfling) — 32×32 Redesign

**Files:**
- Modify: `src/art/pixel/scribe.ts`

**Archetype Identity:** Halfling — short, round, glasses, quill pen, scroll
**Body Proportion:** Short and pudgy (W18×H26 at complete, widest relative to height)

**Palette (keep unchanged):**
```
0=transparent, 1=outline dark tan(42), 2=body main tan(114),
3=secondary(150), 4=highlight/hair(186), 5=eye white(255),
6=pupil black(16), 7=mouth(204), 8=glasses frame(78), 9=quill/scroll(220)
```

**Step 1: Write the sprite data**

Key design points:
- Glasses: Round frames (palette 8) encircling eyes from stage 2
- Hair: Curly crown (palette 4), prominent from stage 1
- Quill: Feathered pen in right hand (palette 9), feather details
- Scroll: Unrolled beside body (palette 9), with line patterns
- Body: Notably rounder/wider than all other archetypes (pudgy)
- Height: Shortest archetype (bottom 6+ rows empty at complete)

Stage sizes: Egg 12×14, Infant 16×20, Child 22×26, Youth 28×28, Complete 32×32 (6 rows empty bottom)

**Step 2-4:** Same pattern.
```bash
git commit -m "feat(art): redesign scribe/halfling sprites for 32×32 canvas"
```

---

- [ ] Task 7: Architect (Golem) — 32×32 Redesign

**Files:**
- Modify: `src/art/pixel/architect.ts`

**Archetype Identity:** Golem — massive, angular, stone-textured, blueprint
**Body Proportion:** Largest archetype (W20×H32 at complete, fills full canvas)

**Palette (keep unchanged):**
```
0=transparent, 1=outline dark gold(148), 2=body main gold(226),
3=secondary(220), 4=highlight(184), 5=eye white(255),
6=pupil black(16), 7=mouth(190), 8=stone cracks(148), 9=blueprint blue(39)
```

**Step 1: Write the sprite data**

Key design points:
- Body: Massive and boxy, square shoulders, fills most of canvas
- Texture: Stone crack lines (palette 8) scattered across body — key differentiator
- Shape: Angular/boxy, visible joint segments at shoulders, elbows, knees
- Blueprint: Held in one hand (palette 9), with line details
- Eyes: Can have glowing appearance (palette 6)
- Proportions: Widest at shoulders, thick legs, heavy stance

Stage sizes: Egg 14×14, Infant 18×22, Child 24×28, Youth 30×32, Complete 32×32 (full)

**Step 2-4:** Same pattern.
```bash
git commit -m "feat(art): redesign architect/golem sprites for 32×32 canvas"
```

---

- [ ] Task 8: Operator (Cyborg) — 32×32 Redesign

**Files:**
- Modify: `src/art/pixel/operator.ts`

**Archetype Identity:** Cyborg — angular, antenna, mechanical arm, visor
**Body Proportion:** Medium angular (W14×H30 at complete)

**Palette (keep unchanged):**
```
0=transparent, 1=outline dark gray(241), 2=body main light gray(247),
3=secondary(250), 4=highlight white(253), 5=eye white(255),
6=visor blue(39), 7=jaw(244), 8=mechanical parts(33), 9=energy glow(196)
```

**Step 1: Write the sprite data**

Key design points:
- Antenna: On top of head, palette 9 tip glow, grows through stages
- Visor: Blue band (palette 6) across eyes — LED appearance, unique eye style
- Mechanical arm: Right arm is mechanical (palette 8), visible gears and joints
- Armor: Angular plating, geometric patterns on body
- Energy lines: Accent marks (palette 9) on body panels
- Asymmetry: Left side organic, right side mechanical

Stage sizes: Egg 12×14, Infant 16×20, Child 22×26, Youth 28×30, Complete 32×32

**Step 2-4:** Same pattern.
```bash
git commit -m "feat(art): redesign operator/cyborg sprites for 32×32 canvas"
```

---

- [ ] Task 9: Final Verification

**Step 1: Run full test suite**

Run: `npm run typecheck && npm test`
Expected: 0 type errors, 91+ tests pass

**Step 2: Build and test all archetypes**

Run: `npm run build && node dist/bin/tomotoken.js show`
Expected: Character renders with visible pixel art

**Step 3: Verification checklist**

Visually confirm for each archetype:
- [ ] Recognizable silhouette (who is it?)
- [ ] Face parts visible (eyes 3×3+, mouth)
- [ ] Accessories identifiable (weapon, hat, shield, etc.)
- [ ] Body shading present (1→2→3→4 gradient)
- [ ] Body type differences clear (wide dwarf vs. thin elf vs. massive golem)
- [ ] 5 growth stages show progressive detail increase
- [ ] Different seeds produce color/detail variation

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(art): complete 32×32 high-resolution sprite redesign for all 8 archetypes"
```

---

## Parallelization Note

Tasks 1-8 are fully independent — each modifies a separate sprite file. They can be executed in parallel using `team-dev` or run sequentially. Task 9 depends on all previous tasks completing.

## Test Commands Quick Reference

```bash
npm run typecheck          # Type errors → 0
npm test                   # All 91+ tests pass
npm run build              # Build succeeds
node dist/bin/tomotoken.js show   # Visual verification
```
