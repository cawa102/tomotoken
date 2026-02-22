# Current Tomotoken Art System Analysis

## Parametric Generation Pipeline

```
seed (SHA-256) → mulberry32 PRNG → deriveCreatureParams (25 params)
                                  → adjustParamsForProgress (growth gating)
                                  → generatePalette (10-slot ANSI 256)
                                  → generateSilhouette (width map)
                                  → rasterizeSilhouette (pixel canvas)
                                  → placeFeatures (eyes, ears, etc.)
                                  → applyPattern (stripes/spots/etc.)
                                  → placeItem (stage 5 only)
```

## CreatureParams (25 parameters)

| Parameter | Range | 3D Mapping |
|-----------|-------|------------|
| headRatio | 0.20-0.45 | Head sphere scale Y |
| bodyWidthRatio | 0.30-0.80 | Body ellipsoid scale X,Z |
| roundness | 0.0-1.0 | Subdivision/smoothing level |
| topHeavy | 0.0-1.0 | Body taper direction |
| eyeSize | 1-3 | Eye sphere scale |
| eyeSpacing | 0.3-0.7 | Eye X offset |
| hasEars | bool | Ear cone meshes |
| hasHorns | bool | Horn cone meshes |
| hasTail | bool | Tail bezier tube |
| hasWings | bool | Wing fan meshes |
| limbStage | 0-5 | Limb detail level |
| patternType | 0-5 | Texture/shader pattern |
| patternDensity | 0.0-1.0 | Pattern frequency |
| neckWidth | 0.3-0.8 | Neck cylinder radius |
| legLength | 0.1-0.3 | Leg cylinder height |
| armLength | 0.1-0.3 | Arm cylinder height |
| tailLength | 0.1-0.4 | Tail segment count |
| wingSize | 0.1-0.4 | Wing fan span |
| earSize | 0.1-0.3 | Ear cone height |
| hornSize | 0.1-0.3 | Horn cone height |
| bodyTaper | 0.0-1.0 | Body narrowing |
| asymmetry | 0.0-0.2 | Left/right variation |

## Animation System (2D)

4 frames per creature, 5 animation actions:
- `applyBlink` — squash eye pixels to line
- `applyArmSway` — shift arm pixels ±1 vertically
- `applyFootTap` — shift leg pixels ±1
- `applyGesture` — shift gesture pixels (body lean)
- `applyShimmer` — swap body pixels to highlight color

Action trigger probability: 0.3 per frame.

## Rendering

- Canvas: 32×16 text chars (32×32 pixels, half-block encoding)
- Colors: ANSI 256, 10-slot palette
- Output: `string[][]` (frames × lines of half-block characters)

## Growth Stages (LimbStage)

| Progress | Stage | Name | Features Unlocked |
|----------|-------|------|-------------------|
| <0.1 | 0 | Egg | Body only, no features |
| 0.1-0.3 | 1 | Infant | Stick limbs |
| 0.3-0.5 | 2 | Child | Jointed limbs, ears, tail |
| 0.5-0.7 | 3 | Youth | Endpoints, horns |
| 0.7-1.0 | 4 | Complete | All features, wings |
| 1.0 | 5 | Mastered | Item held |

## 3D Migration Requirements

### Reuse as-is
- `deriveCreatureParams()` — same 25 params feed 3D mesh generation
- `computeLimbStage()` — same growth stages
- `generatePalette()` + new `paletteToHexArray()` for hex RGB
- `generateSeed()` — same deterministic seed
- Full ingestion/progression/personality pipeline

### Replace
- Silhouette → 3D geometry primitives (spheres, cylinders, cones)
- Rasterize → Three.js mesh composition
- Features → 3D mesh placement
- Pattern → Procedural textures/shaders
- Pixel render → Three.js WebGL render
- Half-block output → Canvas render
- Animation actions → Bone/transform animations

### New
- Bone skeleton for limb animation
- 3D-specific animations (breathing, ear twitch, tail wag, wing flap)
- Camera, lighting, ground plane
- Growth transition animations
