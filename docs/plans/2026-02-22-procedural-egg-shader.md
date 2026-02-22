# Procedural Shader Egg System

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace pre-baked GLB egg models with GLSL ShaderMaterial that generates unique fantasy patterns per petId, giving every pet a one-of-a-kind egg.

**Architecture:** Egg geometry built in JS (SphereGeometry → egg-shaped deformation, bottom at y=0). ShaderMaterial with custom GLSL renders patterns: seed-derived HSL colors, swirl bands with organic edges, diamond rune marks, fbm noise texture, stage-based cracks, stage 3 glow. Pure functions (`hashString`, `createEggGeometry`) are unit-testable; shader output is verified visually. `egg-loader.js` (GLB-based) is replaced by `procedural-egg.js` in `app.js`.

**Tech Stack:** Three.js ShaderMaterial, GLSL ES 1.0 (WebGL 1), Vitest

---

## Layout Reference — Shader Pattern Layers

```
Layer 1 (base):     Solid pastel color derived from petId hue
Layer 2 (bands):    2 wide horizontal bands with organic wavy edges (fbm offset)
Layer 3 (diamonds): Diamond/rune marks in a ring around the middle zone
Layer 4 (texture):  Subtle fbm noise overlay for organic feel
Layer 5 (cracks):   Stage 1+: fbm-based crack lines, intensity ↑ with stage
Layer 6 (glow):     Stage 3: warm golden emission from crack areas
Layer 7 (lighting): Simple Lambertian diffuse + hemisphere ambient + Blinn-Phong specular
```

Color derivation from seed:
- `hue = fract(seed * 0.618033)` (golden ratio spread)
- `baseColor  = hsl(hue, 0.12, 0.93)` — very light pastel
- `patternColor = hsl(hue + 0.42, 0.55, 0.42)` — deep contrasting
- `accentColor  = hsl(hue + 0.18, 0.6, 0.58)` — warm accent

---

- [x] Task 1: Create `procedural-egg.js` — pure functions only

**Files:**
- Create: `src/viewer/public/js/procedural-egg.js`

**Step 1: Write `hashString` and `createEggGeometry`**

Create `src/viewer/public/js/procedural-egg.js` with these two exported pure functions only (shader comes in Task 3):

```javascript
import * as THREE from "three";

/**
 * Hash a string to a float in [0, 1).
 * Deterministic: same string always returns same value.
 */
export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return (((hash >>> 0) % 10000) / 10000);
}

/**
 * Create egg-shaped geometry with bottom at y=0.
 * Deforms a UV sphere: wider belly at ~40%, tapers to top.
 * @param {number} segments - horizontal subdivisions (default 32)
 * @param {number} rings - vertical subdivisions (default 24)
 * @returns {THREE.BufferGeometry}
 */
export function createEggGeometry(segments = 32, rings = 24) {
  const geo = new THREE.SphereGeometry(0.5, segments, rings);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = y + 0.5; // 0 at bottom, 1 at top
    const profile = 0.85 + 0.35 * Math.sin(t * Math.PI) - 0.2 * t;
    pos.setX(i, x * profile);
    pos.setZ(i, z * profile);
    pos.setY(i, t * 1.3); // bottom at 0, stretched to 1.3 tall
  }
  geo.computeVertexNormals();
  return geo;
}
```

**Step 2: Commit**

```bash
git add src/viewer/public/js/procedural-egg.js
git commit -m "feat(viewer): add hashString and createEggGeometry for procedural egg"
```

---

- [x] Task 2: Write failing tests for pure functions

**Files:**
- Create: `test/viewer/procedural-egg.test.ts`

**Step 1: Write tests**

Create `test/viewer/procedural-egg.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  hashString,
  createEggGeometry,
} from "../../src/viewer/public/js/procedural-egg.js";

describe("hashString", () => {
  it("returns a number in [0, 1)", () => {
    const h = hashString("abc-123");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(1);
  });

  it("is deterministic — same input gives same output", () => {
    expect(hashString("pet-xyz")).toBe(hashString("pet-xyz"));
  });

  it("produces different values for different inputs", () => {
    expect(hashString("pet-a")).not.toBe(hashString("pet-b"));
  });

  it("handles empty string", () => {
    const h = hashString("");
    expect(h).toBe(0);
  });
});

describe("createEggGeometry", () => {
  it("returns a BufferGeometry", () => {
    const geo = createEggGeometry();
    expect(geo).toBeInstanceOf(THREE.BufferGeometry);
    geo.dispose();
  });

  it("has position, normal, and uv attributes", () => {
    const geo = createEggGeometry();
    expect(geo.attributes.position).toBeDefined();
    expect(geo.attributes.normal).toBeDefined();
    expect(geo.attributes.uv).toBeDefined();
    geo.dispose();
  });

  it("bottom vertex is at y ≈ 0", () => {
    const geo = createEggGeometry();
    const pos = geo.attributes.position;
    let minY = Infinity;
    for (let i = 0; i < pos.count; i++) {
      minY = Math.min(minY, pos.getY(i));
    }
    expect(minY).toBeCloseTo(0, 1);
    geo.dispose();
  });

  it("top vertex is at y ≈ 1.3", () => {
    const geo = createEggGeometry();
    const pos = geo.attributes.position;
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      maxY = Math.max(maxY, pos.getY(i));
    }
    expect(maxY).toBeCloseTo(1.3, 1);
    geo.dispose();
  });

  it("is wider in the middle than at the top", () => {
    const geo = createEggGeometry();
    const pos = geo.attributes.position;
    let maxRadiusMid = 0;
    let maxRadiusTop = 0;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const r = Math.sqrt(pos.getX(i) ** 2 + pos.getZ(i) ** 2);
      if (y > 0.4 && y < 0.7) maxRadiusMid = Math.max(maxRadiusMid, r);
      if (y > 1.1) maxRadiusTop = Math.max(maxRadiusTop, r);
    }
    expect(maxRadiusMid).toBeGreaterThan(maxRadiusTop);
    geo.dispose();
  });
});
```

**Step 2: Run test to verify it passes**

Run: `npx vitest run test/viewer/procedural-egg.test.ts`
Expected: PASS (9 tests) — pure functions already exist from Task 1.

**Step 3: Commit**

```bash
git add test/viewer/procedural-egg.test.ts
git commit -m "test(viewer): add unit tests for procedural egg pure functions"
```

---

- [x] Task 3: Add GLSL shader and `createProceduralEgg` factory

**Files:**
- Modify: `src/viewer/public/js/procedural-egg.js`

**Step 1: Add vertex shader, fragment shader, and factory function**

Append to `procedural-egg.js` after the existing functions:

```javascript
// --- GLSL Shaders ---

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float seed;
  uniform float stage;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  // --- Noise utilities ---
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
    return v;
  }

  // --- HSL to RGB ---
  vec3 hsl2rgb(float h, float s, float l) {
    vec3 rgb = clamp(
      abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0,
      0.0, 1.0
    );
    return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
  }

  void main() {
    // --- Derive colors from seed ---
    float hue = fract(seed * 0.618033);
    vec3 baseColor    = hsl2rgb(hue,                0.12, 0.93);
    vec3 patternColor = hsl2rgb(fract(hue + 0.42),  0.55, 0.42);
    vec3 accentColor  = hsl2rgb(fract(hue + 0.18),  0.60, 0.58);

    vec3 color = baseColor;

    // --- Layer 1: Swirl bands with organic edges ---
    float wave = fbm(vec2(vUv.x * 10.0 + seed * 5.0, vUv.y * 3.0)) * 0.06;
    float band1 = smoothstep(0.18 + wave, 0.24 + wave, vUv.y)
                * smoothstep(0.36 - wave, 0.30 - wave, vUv.y);
    float band2 = smoothstep(0.60 + wave, 0.66 + wave, vUv.y)
                * smoothstep(0.78 - wave, 0.72 - wave, vUv.y);
    color = mix(color, patternColor, max(band1, band2));

    // --- Layer 2: Diamond / rune marks in middle zone ---
    float numX = 6.0 + floor(seed * 4.0);
    float dx = fract(vUv.x * numX + seed * 2.0) - 0.5;
    float dy = fract(vUv.y * 5.0 + fract(seed * 3.7)) - 0.5;
    float diamond = 1.0 - smoothstep(0.12, 0.18, abs(dx) + abs(dy));
    float midZone = smoothstep(0.36, 0.44, vUv.y) * smoothstep(0.60, 0.52, vUv.y);
    color = mix(color, accentColor, diamond * midZone * 0.85);

    // --- Layer 3: Subtle organic texture ---
    float tex = fbm(vec2(vUv.x * 8.0 + seed, vUv.y * 6.0));
    color *= 0.92 + tex * 0.12;

    // --- Layer 4: Cracks (stage 1+) ---
    if (stage >= 1.0) {
      float cn = fbm(vUv * 18.0 + vec2(seed * 11.0, seed * 7.0));
      float thr = 0.82 - min(stage, 3.0) * 0.08;
      float crack = smoothstep(thr, thr + 0.015, cn);
      float branch = smoothstep(thr - 0.02, thr, cn) - crack;
      vec3 crackColor = vec3(0.75, 0.60, 0.35);
      color = mix(color, crackColor, crack * 0.9 + branch * 0.35);
    }

    // --- Layer 5: Glow (stage 3) ---
    if (stage >= 3.0) {
      float gn = fbm(vUv * 12.0 + vec2(seed * 9.0, seed * 5.0));
      float glow = smoothstep(0.55, 0.65, gn);
      color = mix(color, vec3(1.0, 0.92, 0.55), glow * 0.6);
    }

    // --- Lighting (Lambertian + hemisphere ambient + specular) ---
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
    float diff = max(dot(vNormal, lightDir), 0.0);
    float ambientMix = vNormal.y * 0.5 + 0.5;
    vec3 ambient = mix(vec3(0.55, 0.55, 0.65), vec3(1.0, 1.0, 0.97), ambientMix) * 0.55;
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(vNormal, halfDir), 0.0), 40.0);
    color = color * (ambient + diff * 0.55) + vec3(1.0) * spec * 0.18;

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Create a procedural fantasy egg with unique patterns.
 * Synchronous — no asset loading needed.
 *
 * @param {number} stage - growth stage 0-3
 * @param {string} petId - unique pet identifier (drives pattern seed)
 * @returns {THREE.Group} group with .userData.isEgg = true
 */
export function createProceduralEgg(stage, petId) {
  const seed = hashString(petId || "default");
  const geometry = createEggGeometry();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      seed: { value: seed },
      stage: { value: Math.min(Math.max(stage, 0), 3) },
    },
    vertexShader,
    fragmentShader,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;

  const group = new THREE.Group();
  group.name = "creature";
  group.userData.isEgg = true;
  group.add(mesh);
  return group;
}
```

**Step 2: Add a factory test**

Append to `test/viewer/procedural-egg.test.ts`:

```typescript
import { createProceduralEgg } from "../../src/viewer/public/js/procedural-egg.js";

describe("createProceduralEgg", () => {
  it("returns a Group with isEgg flag", () => {
    const group = createProceduralEgg(0, "pet-abc");
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.userData.isEgg).toBe(true);
    expect(group.name).toBe("creature");
  });

  it("contains a Mesh child with ShaderMaterial", () => {
    const group = createProceduralEgg(2, "pet-xyz");
    const mesh = group.children[0];
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.material).toBeInstanceOf(THREE.ShaderMaterial);
  });

  it("passes seed and stage as uniforms", () => {
    const group = createProceduralEgg(3, "pet-test");
    const mat = group.children[0].material;
    expect(mat.uniforms.seed.value).toBeGreaterThan(0);
    expect(mat.uniforms.stage.value).toBe(3);
  });

  it("clamps stage to 0-3 range", () => {
    const gNeg = createProceduralEgg(-1, "a");
    expect(gNeg.children[0].material.uniforms.stage.value).toBe(0);
    const gHigh = createProceduralEgg(5, "b");
    expect(gHigh.children[0].material.uniforms.stage.value).toBe(3);
  });

  it("different petIds produce different seeds", () => {
    const g1 = createProceduralEgg(0, "pet-alpha");
    const g2 = createProceduralEgg(0, "pet-beta");
    const s1 = g1.children[0].material.uniforms.seed.value;
    const s2 = g2.children[0].material.uniforms.seed.value;
    expect(s1).not.toBe(s2);
  });
});
```

**Step 3: Run tests**

Run: `npx vitest run test/viewer/procedural-egg.test.ts`
Expected: PASS (14 tests)

**Step 4: Commit**

```bash
git add src/viewer/public/js/procedural-egg.js test/viewer/procedural-egg.test.ts
git commit -m "feat(viewer): add GLSL shader and createProceduralEgg factory"
```

---

- [x] Task 4: Wire `app.js` to use procedural egg

**Files:**
- Modify: `src/viewer/public/js/app.js:7,148-156`

**Step 1: Replace import**

In `app.js` line 7, change:

```javascript
// BEFORE
import { loadEggModel } from "./egg-loader.js";
// AFTER
import { createProceduralEgg } from "./procedural-egg.js";
```

**Step 2: Replace egg creation block**

In `app.js`, replace lines 148-156 (the `stage < 4` branch):

```javascript
// BEFORE
    if (stage < 4) {
      // Egg stages 0-3: load egg model
      const eggGltf = await loadEggModel(stage);
      if (eggGltf) {
        const group = eggGltf.scene;
        group.name = "creature";
        group.userData.isEgg = true;
        result = { group, parts: {}, mixer: null };
      }
    }
```

```javascript
// AFTER
    if (stage < 4) {
      const group = createProceduralEgg(stage, petId);
      result = { group, parts: {}, mixer: null };
    }
```

**Step 3: Run all viewer tests**

Run: `npx vitest run test/viewer/`
Expected: All tests PASS. (`egg-loader.test.ts` still passes since the module is unchanged, just no longer imported by `app.js`.)

**Step 4: Commit**

```bash
git add src/viewer/public/js/app.js
git commit -m "feat(viewer): wire procedural egg into app.js, remove GLB dependency"
```

---

- [x] Task 5: Visual verification and full test suite

**Files:**
- No new files. Possibly CSS/shader tweaks.

**Step 1: Start viewer**

Run: `npm run dev:viewer`
Open: http://localhost:3456

**Step 2: Visual checklist**

- [ ] Egg has visible pastel base color (NOT black or dark)
- [ ] Two wide horizontal bands wrap around the egg in a contrasting color
- [ ] Band edges are wavy/organic (not perfectly straight)
- [ ] Diamond rune marks visible in middle zone in accent color
- [ ] Pattern is unique — reload with different petId data and pattern changes
- [ ] Egg sits ON TOP of the ground disc (not clipping through)
- [ ] Egg wobble animation still works
- [ ] Specular highlight visible when rotating camera
- [ ] No console errors

**Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

**Step 4: Commit (if any tweaks were made)**

```bash
git add -A
git commit -m "feat(viewer): procedural shader egg with unique per-pet fantasy patterns"
```

---

## Files Changed Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/viewer/public/js/procedural-egg.js` | Create | Egg geometry + GLSL shader + factory |
| `test/viewer/procedural-egg.test.ts` | Create | 14 tests for pure functions + factory |
| `src/viewer/public/js/app.js` | Modify | Swap `loadEggModel` → `createProceduralEgg` |

## Files NOT Changed (kept as-is)

| File | Reason |
|------|--------|
| `src/viewer/public/js/egg-loader.js` | Kept for potential fallback; just no longer imported |
| `src/viewer/public/js/egg-wobble.js` | Wobble controller works on any Group — no changes needed |
| `src/viewer/public/models/eggs/*.glb` | Kept on disk but unused; can be deleted later |
| `test/viewer/egg-loader.test.ts` | Tests still pass — module is intact |
