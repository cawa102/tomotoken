# Frontend Codemap

> Freshness: 2026-02-22 21:45

## Pages

| Page | URL | File | Purpose |
|------|-----|------|---------|
| Main | `/` | `index.html` | 3D pet viewer (egg stages + hatched character) |
| Collection | `/collection` | `collection.html` | Gallery — card grid of completed pets |

Navigation: floating circular buttons (top-left) linking between pages.

## 3D Viewer — Main Page (`src/viewer/public/`)

### Scene & Rendering

| File | Purpose |
|------|---------|
| `js/app.js` | Main entry: WebSocket, state, animation loop, egg/character routing, snapshot capture |
| `js/scene.js` | Camera, HemisphereLight, shadow setup |
| `js/postprocess.js` | EffectComposer: bloom, FXAA, color grading |
| `js/toon-utils.js` | Gradient map for MeshToonMaterial |
| `js/outline.js` | Toon outline post-processing |
| `js/easing.js` | Easing functions (cubicInOut, etc.) |
| `js/radar-chart.js` | Canvas 2D radar chart for personality traits (8-axis, max-normalized, smart label alignment) |

### Creature Loading

| File | Purpose |
|------|---------|
| `js/creature.js` | `buildFromDesign()` (LLM parts), `buildFromModel()` (glTF), `disposeCreature()` |
| `js/model-loader.js` | GLTFLoader with `SAFE_ARCHETYPE_RE` path validation |
| `js/palette-apply.js` | Apply hex palette to `cr_*` named meshes (clones materials) |

### Egg System (stages 0-3)

| File | Purpose |
|------|---------|
| `js/egg-loader.js` | `loadEggModel(stage)` — loads `egg-stage-{0-3}.glb` |
| `js/egg-wobble.js` | `EggWobbleController` — progress-based wobble frequency/amplitude |
| `js/hatch-transition.js` | `showLoading`, `hideLoading`, `playFlash`, `bounceIn` |
| `js/procedural-egg.js` | Procedural egg geometry generation |

### Character Animation (stage 4)

| File | Purpose |
|------|---------|
| `js/animation.js` | Flag-based animation: sway, bob, rotate, wiggle, flap |
| `js/anim-mixer.js` | Three.js AnimationMixer for glTF skeletal clips |
| `js/morph-expression.js` | Morph target expressions (eye/mouth shapes) |
| `js/expression.js` | Expression selection by progress/time-of-day |

### Shared Rendering Module

| File | Purpose |
|------|---------|
| `js/viewer-core.js` | `createPetViewer(container, renderData)` — self-contained Three.js viewer for reuse in collection modal. Returns `{ dispose() }` for cleanup. |

### Snapshot Capture (in app.js)

Tracks `currentPetId`. On pet completion (petId changes):
`requestAnimationFrame` → `composer.render()` → `canvas.toBlob("image/png")` → `POST /api/snapshot/:petId`

### Assets

| Path | Contents |
|------|----------|
| `models/eggs/egg-stage-{0-3}.glb` | 4 egg models with cr_body_shell, cr_accent_spot*, cr_detail_crack* |
| `models/{archetype}.glb` | Character models per archetype |

### Data Contract

`PetRenderData` JSON via WebSocket (push every 5s) or REST `/api/pet`

### Animation Loop Routing (app.js)

```
currentGroup.userData.isEgg?
  → EggWobbleController.updateProgress()
currentGroup.userData.isGltfModel?
  → AnimationMixer.update() + applyMorphExpression()
currentDesign?
  → applyAnimations() + applyExpression()
```

## Collection Page (`collection.html` + `js/collection.js` + `css/collection.css`)

### Layout

- Header: title + pet count
- Card grid: `auto-fill, minmax(240px, 1fr)` responsive layout
- Empty state: message when no completed pets
- Modal overlay: backdrop + close button + 3D viewer + info panel
- Floating nav button: home icon → `/`

### Client Logic (collection.js)

| Function | Purpose |
|----------|---------|
| `loadCollection()` | `fetch("/api/collection")` |
| `createCard(pet)` | DOM card: snapshot thumbnail, archetype, subtype, date, tokens |
| `renderGrid(data)` | Populate grid, show empty state if needed |
| `openModal(petId)` | Fetch detail + render data, initialize 3D viewer in modal |
| `closeModal()` | Dispose viewer, clear modal content |
| `initModalViewer(petId)` | Creates Three.js viewer via `viewer-core.js` |

### Modal 3D Viewer

Uses `viewer-core.js` (`createPetViewer`) to render completed pets.
Fetches `GET /api/collection/:petId/render` for PetRenderData.
Properly disposes renderer/composer/creature on close.

### Styles (collection.css)

- Body: `padding: 32px 28px 40px`, monospace font family
- Cards: white bg, `border-radius: 14px`, `padding: 18px`, hover lift + shadow
- Grid: `gap: 24px`, `max-width: 1200px`, `auto-fill minmax(240px, 1fr)`
- Modal: centered, max 600px, `padding: 28px`, backdrop blur
- Trait badges: `padding: 4px 10px`, primary (blue) + secondary (gray)
- Floating button: 48px circle, semi-transparent black, z-index 1000

### Main Page Layout (index.html)

- Radar container: `bottom: 76px; left: 16px`, frosted glass background (`rgba(255,255,255,0.3)` + `blur(8px)`), `border-radius: 16px`
- Radar canvas: 600x600 internal / 280x280 CSS (2.14x DPR)
- Bottom bar: `padding: 14px 28px 18px`, `rgba(255,255,255,0.65)` + `blur(10px)`
- Archetype label: `12px`, `letter-spacing: 0.8px`, blue (#3a7bd5)
- Exp bar: `5px` height, gradient `#4facfe → #00d2ff`

### Radar Chart (radar-chart.js)

- Canvas 2D, 8-axis spider chart
- Max-value normalization: dominant trait always reaches outer ring
- Smart label alignment: `textAlign` / `textBaseline` adjusted per angle to prevent edge clipping
- Chart radius: `size * 0.24`, label offset: `radius + 30`
- Fonts: active `bold 22px`, inactive `18px` monospace
- Grid opacity: 0.25, axis opacity: 0.15, polygon fill: 0.18
