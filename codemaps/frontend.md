# Frontend Codemap

> Freshness: 2026-02-22

## CLI UI (Ink 5 + React)

### Apps

| Component | File | Purpose |
|-----------|------|---------|
| `App` | `src/ui/app.tsx` | Stateless dispatcher: show, stats, collection, view, config |
| `WatchApp` | `src/ui/WatchApp.tsx` | Live mode: polling + encouragement + animation |
| `ZukanApp` | `src/ui/ZukanApp.tsx` | Interactive encyclopedia: gallery, timeline, stats tabs |

### Components

| Component | File | Purpose |
|-----------|------|---------|
| `PetView` | `PetView.tsx` | Pet display: stage info + 3D viewer link (no ASCII art) |
| `PetDetail` | `PetDetail.tsx` | Single pet detail with animation |
| `StatsPanel` | `StatsPanel.tsx` | Token stats, calibration |
| `CollectionList` | `CollectionList.tsx` | Completed pets list |
| `ProgressBar` | `ProgressBar.tsx` | ASCII progress indicator |
| `TraitDisplay` | `TraitDisplay.tsx` | 8-trait bar chart |
| `TabBar` | `TabBar.tsx` | Tab selector |
| `HelpBar` | `HelpBar.tsx` | Keyboard shortcuts |
| `GalleryTab` | `GalleryTab.tsx` | Pet gallery with animation |
| `TimelineTab` | `TimelineTab.tsx` | Completion timeline |
| `CollectionStatsTab` | `CollectionStatsTab.tsx` | Aggregate stats |

### Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useWatcher` | `useWatcher.ts` | Poll ingestion pipeline every 5s |
| `useEncouragement` | `useEncouragement.ts` | Manage encouragement message visibility |
| `useTabNavigation` | `useTabNavigation.ts` | Keyboard tab switching + gallery nav |
| `useAnimation` | `useAnimation.ts` | Frame-by-frame animation playback |

## 3D Viewer (Three.js, client-side)

Served from `src/viewer/public/`

### Scene & Rendering

| File | Purpose |
|------|---------|
| `js/app.js` | Main entry: WebSocket, state, animation loop, egg/character routing |
| `js/scene.js` | Camera, HemisphereLight, shadow setup |
| `js/postprocess.js` | EffectComposer: bloom, FXAA, color grading |
| `js/toon-utils.js` | Gradient map for MeshToonMaterial |
| `js/outline.js` | Toon outline post-processing |
| `js/easing.js` | Easing functions (cubicInOut, etc.) |

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

### Character Animation (stage 4)

| File | Purpose |
|------|---------|
| `js/animation.js` | Flag-based animation: sway, bob, rotate, wiggle, flap |
| `js/anim-mixer.js` | Three.js AnimationMixer for glTF skeletal clips |
| `js/morph-expression.js` | Morph target expressions (eye/mouth shapes) |
| `js/expression.js` | Expression selection by progress/time-of-day |

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
