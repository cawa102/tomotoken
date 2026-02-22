# Professional 3D Viewer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 3Dビューアのキャラクターレンダリングをプロのゲーム/3Dアニメ品質に引き上げる。Toon Shading、アウトライン、ポストプロセッシング、高品質ライティングを段階的に導入する。

**Architecture:** ビューアは `src/viewer/public/` 配下のクライアントサイド vanilla JS（ES modules + three.js v0.170.0 CDN）。5つのフェーズで段階的に改善: (1) Toon Shading + ジオメトリ品質 (2) Inverted Hull アウトライン (3) EffectComposer ポストプロセス (4) ライティング & シャドウ強化 (5) 仕上げ演出。各フェーズ完了時にブラウザで視覚確認するチェックポイントを設ける。サーバーサイド・他ドメインへの変更なし。

**Tech Stack:** three.js 0.170.0, MeshToonMaterial, ShaderMaterial (GLSL), EffectComposer + UnrealBloomPass + FXAA, vitest (テスト)

**What's Already Built:** 3Dビューア一式 — `scene.js`(シーン・ライト), `creature.js`(ジオメトリ・マテリアル, 2パス: LLM Design + Legacy PRNG), `animation.js`(2系統アニメーション), `expression.js`(表情), `app.js`(レンダーループ + WebSocket)。現在は `MeshStandardMaterial` + `PCFSoftShadow 1024x1024` + ポストプロセスなし。

**Testing strategy:** three.js のデータクラス（Material, Mesh, Group, DataTexture等）は Node で動作する。`three` を devDependency に追加し、ユーティリティ関数とジオメトリ/マテリアル生成を vitest でテスト。レンダリング統合（EffectComposer, WebGLRenderer依存）はブラウザで手動確認。

---

## Phase 0: Test Infrastructure

- [-] Task 0: three.js devDependency 追加

**Files:**
- Modify: `package.json`

three.js を devDependency に追加。ブラウザでは CDN から読み込むが、vitest でのテストに node_modules 版が必要。

**Step 1: Install three.js**

Run:
```bash
npm install --save-dev three@0.170.0
```

Expected: `package.json` の `devDependencies` に `"three": "^0.170.0"` が追加される

**Step 2: Verify import works in Node**

Run:
```bash
node -e "import('three').then(t => console.log('THREE loaded, version:', t.REVISION))"
```

Expected: `THREE loaded, version: 170` のような出力

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add three.js as devDependency for viewer tests"
```

---

## Phase 1: Toon Shading + Geometry Quality

- [-] Task 1: Toon gradient map utility — テスト作成

**Files:**
- Create: `test/viewer/toon-utils.test.ts`

`createGradientMap` は MeshToonMaterial の `gradientMap` プロパティに使う DataTexture を生成する。
段階数（steps）を指定すると、0→255 を均等に分割した Uint8Array を持つ DataTexture を返す。

**Step 1: Write the failing test**

```typescript
// test/viewer/toon-utils.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";

// Importing vanilla JS module from viewer public dir
import { createGradientMap, createToonMaterial } from "../../src/viewer/public/js/toon-utils.js";

describe("createGradientMap", () => {
  it("returns a DataTexture with correct dimensions for 3 steps", () => {
    const texture = createGradientMap(3);
    expect(texture).toBeInstanceOf(THREE.DataTexture);
    expect(texture.image.width).toBe(3);
    expect(texture.image.height).toBe(1);
  });

  it("generates correct gradient values for 3 steps", () => {
    const texture = createGradientMap(3);
    const data = texture.image.data;
    // 3 steps: [0, 128, 255] (0/2*255=0, 1/2*255=128, 2/2*255=255)
    expect(data[0]).toBe(0);
    expect(data[1]).toBe(128);
    expect(data[2]).toBe(255);
  });

  it("generates 2-step gradient (default toon look)", () => {
    const texture = createGradientMap(2);
    const data = texture.image.data;
    expect(data[0]).toBe(0);
    expect(data[1]).toBe(255);
  });

  it("defaults to 3 steps when no argument given", () => {
    const texture = createGradientMap();
    expect(texture.image.width).toBe(3);
  });

  it("marks texture as needsUpdate", () => {
    const texture = createGradientMap(3);
    expect(texture.needsUpdate).toBe(true);
  });
});

describe("createToonMaterial", () => {
  it("returns a MeshToonMaterial", () => {
    const mat = createToonMaterial({ color: 0xff0000 });
    expect(mat).toBeInstanceOf(THREE.MeshToonMaterial);
  });

  it("sets the specified color", () => {
    const mat = createToonMaterial({ color: 0xff0000 });
    expect(mat.color.getHex()).toBe(0xff0000);
  });

  it("uses provided gradientMap", () => {
    const gm = createGradientMap(4);
    const mat = createToonMaterial({ color: 0x00ff00, gradientMap: gm });
    expect(mat.gradientMap).toBe(gm);
  });

  it("creates default 3-step gradientMap when none provided", () => {
    const mat = createToonMaterial({ color: 0x0000ff });
    expect(mat.gradientMap).toBeDefined();
    expect(mat.gradientMap.image.width).toBe(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/viewer/toon-utils.test.ts`

Expected: FAIL — `Cannot find module '../../src/viewer/public/js/toon-utils.js'` (file doesn't exist yet)

---

- [-] Task 2: Toon gradient map utility — 実装

**Files:**
- Create: `src/viewer/public/js/toon-utils.js`

**Step 1: Write minimal implementation**

```javascript
// src/viewer/public/js/toon-utils.js
import * as THREE from "three";

/**
 * Create a gradient map DataTexture for MeshToonMaterial.
 * Controls the number of shading steps in cel-shading.
 *
 * @param {number} steps - Number of shading steps (2-5). Default 3.
 * @returns {THREE.DataTexture}
 */
export function createGradientMap(steps = 3) {
  const colors = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) {
    colors[i] = Math.round((i / (steps - 1)) * 255);
  }
  const texture = new THREE.DataTexture(colors, steps, 1, THREE.RedFormat);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Create a MeshToonMaterial with consistent toon settings.
 *
 * @param {Object} opts
 * @param {number|THREE.Color} opts.color - Diffuse color
 * @param {THREE.DataTexture} [opts.gradientMap] - Custom gradient map (default: 3-step)
 * @returns {THREE.MeshToonMaterial}
 */
export function createToonMaterial({ color, gradientMap }) {
  return new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: gradientMap || createGradientMap(3),
  });
}
```

**Step 2: Run test to verify it passes**

Run: `npx vitest run test/viewer/toon-utils.test.ts`

Expected: All 7 tests PASS

**Step 3: Commit**

```bash
git add src/viewer/public/js/toon-utils.js test/viewer/toon-utils.test.ts
git commit -m "feat(viewer): add toon gradient map utility with tests"
```

---

- [-] Task 3: creature.js — MeshToonMaterial に切り替え（テスト）

**Files:**
- Create: `test/viewer/creature-materials.test.ts`

creature.js の `buildLegacyCreature` が返すクリーチャーの全マテリアルが MeshToonMaterial であることを検証。

**Step 1: Write the failing test**

```typescript
// test/viewer/creature-materials.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { buildLegacyCreature } from "../../src/viewer/public/js/creature.js";

// Minimal CreatureParams for testing (stage 1+ body with all features)
const TEST_PARAMS = {
  headRatio: 0.5,
  bodyWidthRatio: 0.5,
  roundness: 0.5,
  topHeavy: 0.5,
  eyeSize: 2,
  eyeSpacing: 0.5,
  hasEars: true,
  hasHorns: true,
  hasTail: true,
  hasWings: true,
  limbStage: 4,
  patternType: 1,
  patternDensity: 0.5,
  neckWidth: 0.5,
  legLength: 0.3,
  armLength: 0.3,
  tailLength: 0.4,
  wingSize: 0.5,
  earSize: 0.3,
  hornSize: 0.3,
  bodyTaper: 0.3,
  asymmetry: 0.1,
};

const TEST_PALETTE = [
  "#1a1a2e", "#222244", "#4488aa", "#55aacc",
  "#88ccee", "#ffffff", "#111111", "#ff6644",
];

describe("creature materials after toon migration", () => {
  it("buildLegacyCreature stage 4 uses only MeshToonMaterial (except eye highlights)", () => {
    const { group } = buildLegacyCreature(TEST_PARAMS, TEST_PALETTE, 4);
    const materials: THREE.Material[] = [];
    group.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          materials.push(...mesh.material);
        } else {
          materials.push(mesh.material);
        }
      }
    });

    // All materials should be MeshToonMaterial (no MeshStandardMaterial)
    const standardMats = materials.filter((m) => m.type === "MeshStandardMaterial");
    expect(standardMats).toHaveLength(0);

    const toonMats = materials.filter((m) => m.type === "MeshToonMaterial");
    expect(toonMats.length).toBeGreaterThan(0);
  });

  it("egg (stage 0) also uses MeshToonMaterial", () => {
    const { group } = buildLegacyCreature(TEST_PARAMS, TEST_PALETTE, 0);
    const materials: THREE.Material[] = [];
    group.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        materials.push(
          ...(Array.isArray(mesh.material) ? mesh.material : [mesh.material]),
        );
      }
    });
    const standardMats = materials.filter((m) => m.type === "MeshStandardMaterial");
    expect(standardMats).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/viewer/creature-materials.test.ts`

Expected: FAIL — materials are still `MeshStandardMaterial`

---

- [-] Task 4: creature.js — MeshToonMaterial に切り替え（実装）

**Files:**
- Modify: `src/viewer/public/js/creature.js:1-5` (import追加)
- Modify: `src/viewer/public/js/creature.js:46-51` (buildPart 内のマテリアル)
- Modify: `src/viewer/public/js/creature.js:121-161` (buildLegacyCreature 内の全マテリアル)
- Modify: `src/viewer/public/js/creature.js:164` (egg stage のマテリアル)

**Step 1: Add import at top of creature.js**

```javascript
// Line 1: Add import
import { createGradientMap } from "./toon-utils.js";
```

**Step 2: Replace material in `buildPart` function (LLM Design path)**

```javascript
// Before (line 46-51):
const mat = new THREE.MeshStandardMaterial({
  color: new THREE.Color(color),
  roughness: material.roughness,
  metalness: material.metalness,
  flatShading: material.flatShading,
});

// After:
const gradientMap = createGradientMap(3);
const mat = new THREE.MeshToonMaterial({
  color: new THREE.Color(color),
  gradientMap,
});
```

**Step 3: Replace all materials in `buildLegacyCreature` function (Legacy path)**

```javascript
// Before (line 121-161): 7x MeshStandardMaterial

// After: Replace the entire material block with:
const gradientMap = createGradientMap(3);
const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap });

const bodyMat = toon(bodyColor);
const bodySecMat = toon(bodySecondary);
const outlineMat = toon(outlineColor);
const highlightMat = toon(highlightColor);
const eyeWhiteMat = toon(eyeWhite);
const pupilMat = toon(pupilColor);
const accentMat = toon(accentColor);
```

Also update the egg stage (stage 0) to use toon materials — the egg uses `bodyMat` and `bodySecMat` which are now already toon.

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/viewer/creature-materials.test.ts`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/viewer/public/js/creature.js test/viewer/creature-materials.test.ts
git commit -m "feat(viewer): switch all materials to MeshToonMaterial for cel-shading"
```

---

- [-] Task 5: creature.js — ジオメトリセグメント数引き上げ（テスト + 実装）

**Files:**
- Create: `test/viewer/creature-geometry.test.ts`
- Modify: `src/viewer/public/js/creature.js:6` (定数)
- Modify: `src/viewer/public/js/creature.js:8-37` (createGeometry)
- Modify: `src/viewer/public/js/creature.js` (createEye, createLimb等の個別セグメント数)

**Step 1: Write the failing test**

```typescript
// test/viewer/creature-geometry.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { buildLegacyCreature } from "../../src/viewer/public/js/creature.js";

const TEST_PARAMS = {
  headRatio: 0.5, bodyWidthRatio: 0.5, roundness: 0.5, topHeavy: 0.5,
  eyeSize: 2, eyeSpacing: 0.5,
  hasEars: false, hasHorns: false, hasTail: false, hasWings: false,
  limbStage: 0, patternType: 0, patternDensity: 0,
  neckWidth: 0.5, legLength: 0.3, armLength: 0.3,
  tailLength: 0.4, wingSize: 0.5, earSize: 0.3, hornSize: 0.3,
  bodyTaper: 0.3, asymmetry: 0.1,
};

const TEST_PALETTE = [
  "#1a1a2e", "#222244", "#4488aa", "#55aacc",
  "#88ccee", "#ffffff", "#111111", "#ff6644",
];

describe("creature geometry quality", () => {
  it("body sphere has at least 16 radial segments", () => {
    // Stage 1 creature with minimal features
    const { parts } = buildLegacyCreature(TEST_PARAMS, TEST_PALETTE, 1);
    const body = parts.body as THREE.Mesh;
    const geo = body.geometry as THREE.SphereGeometry;
    // SphereGeometry stores params in .parameters
    // widthSegments is the number of horizontal segments
    const params = geo.parameters;
    expect(params.widthSegments).toBeGreaterThanOrEqual(16);
  });

  it("head sphere has at least 16 radial segments", () => {
    const { parts } = buildLegacyCreature(TEST_PARAMS, TEST_PALETTE, 1);
    const head = parts.head as THREE.Mesh;
    const geo = head.geometry as THREE.SphereGeometry;
    expect(geo.parameters.widthSegments).toBeGreaterThanOrEqual(16);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/viewer/creature-geometry.test.ts`

Expected: FAIL — current segments are 6-16 based on roundness, but the test expects at least 16. With roundness=0.5, `subdivW = floor(6 + 0.5*10) = 11` which is < 16.

**Step 3: Update segment constants in creature.js**

```javascript
// Before (line 6):
const LOW_POLY_SEGMENTS = 8;

// After:
const TOON_SEGMENTS = 24;
```

Replace all `LOW_POLY_SEGMENTS` references with `TOON_SEGMENTS` in `createGeometry`.

Update legacy body geometry subdivision calculation:

```javascript
// Before (line 197-198):
const subdivW = Math.floor(6 + roundness * 10); // 6-16
const subdivH = Math.floor(4 + roundness * 8);  // 4-12

// After:
const subdivW = Math.max(20, Math.floor(16 + roundness * 12)); // 20-28
const subdivH = Math.max(14, Math.floor(10 + roundness * 10)); // 14-20
```

Update helper functions' hardcoded segments:

```javascript
// createEye: SphereGeometry segments 8→16, 6→12
// createLimb: CylinderGeometry segments 5→12, SphereGeometry 6→12
// createTail: CylinderGeometry segments 5→12
// createWings: no change (ShapeGeometry, no radial segments)
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/viewer/creature-geometry.test.ts`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/viewer/public/js/creature.js test/viewer/creature-geometry.test.ts
git commit -m "feat(viewer): increase geometry segments for smoother toon silhouettes"
```

**CHECKPOINT:** `npm run dev:viewer` でビューアを起動し、ブラウザで Toon Shading の効果を確認。
段階的な陰影と滑らかなシルエットが見えるはず。

---

## Phase 2: Outline Effect

- [-] Task 6: Inverted Hull アウトライン — テスト作成

**Files:**
- Create: `test/viewer/outline.test.ts`

Inverted Hull 法: メッシュのジオメトリを共有しつつ、法線方向に膨張した BackSide マテリアルで描画。

**Step 1: Write the failing test**

```typescript
// test/viewer/outline.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { addOutlines } from "../../src/viewer/public/js/outline.js";

function createTestGroup(): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 8, 6);
  const mat = new THREE.MeshToonMaterial({ color: 0xff0000 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "body";
  group.add(mesh);

  const childGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const childMat = new THREE.MeshToonMaterial({ color: 0x00ff00 });
  const childMesh = new THREE.Mesh(childGeo, childMat);
  childMesh.name = "head";
  group.add(childMesh);

  return group;
}

describe("addOutlines", () => {
  it("adds outline meshes for each mesh in the group", () => {
    const group = createTestGroup();
    const meshCountBefore = countMeshes(group);
    addOutlines(group);
    const meshCountAfter = countMeshes(group);
    // Each original mesh gets one outline sibling
    expect(meshCountAfter).toBe(meshCountBefore * 2);
  });

  it("outline meshes are marked with userData.isOutline", () => {
    const group = createTestGroup();
    addOutlines(group);
    const outlines: THREE.Mesh[] = [];
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.userData.isOutline) {
        outlines.push(child as THREE.Mesh);
      }
    });
    expect(outlines.length).toBe(2); // body_outline + head_outline
  });

  it("outline meshes use BackSide rendering", () => {
    const group = createTestGroup();
    addOutlines(group);
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.userData.isOutline) {
        const mesh = child as THREE.Mesh;
        expect(mesh.material.side).toBe(THREE.BackSide);
      }
    });
  });

  it("outline meshes do not cast shadows", () => {
    const group = createTestGroup();
    addOutlines(group);
    group.traverse((child) => {
      if (child.userData.isOutline) {
        expect(child.castShadow).toBe(false);
      }
    });
  });

  it("outline names follow pattern: {original}_outline", () => {
    const group = createTestGroup();
    addOutlines(group);
    const names: string[] = [];
    group.traverse((child) => {
      if (child.userData.isOutline) {
        names.push(child.name);
      }
    });
    expect(names).toContain("body_outline");
    expect(names).toContain("head_outline");
  });

  it("respects custom color and thickness options", () => {
    const group = createTestGroup();
    addOutlines(group, { color: 0xff0000, thickness: 0.05 });
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.userData.isOutline) {
        const mat = (child as THREE.Mesh).material as THREE.ShaderMaterial;
        expect(mat.uniforms.outlineThickness.value).toBe(0.05);
        expect(mat.uniforms.outlineColor.value.getHex()).toBe(0xff0000);
      }
    });
  });
});

function countMeshes(obj: THREE.Object3D): number {
  let count = 0;
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) count++;
  });
  return count;
}
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/viewer/outline.test.ts`

Expected: FAIL — `Cannot find module '../../src/viewer/public/js/outline.js'`

---

- [-] Task 7: Inverted Hull アウトライン — 実装

**Files:**
- Create: `src/viewer/public/js/outline.js`

**Step 1: Write minimal implementation**

```javascript
// src/viewer/public/js/outline.js
import * as THREE from "three";

const DEFAULT_THICKNESS = 0.03;
const DEFAULT_COLOR = 0x111122;

/**
 * Create a backface-only ShaderMaterial for outlines.
 * Uses vertex shader to push vertices along normals.
 *
 * @param {number} color - Outline color hex
 * @param {number} thickness - How far to push along normals
 * @returns {THREE.ShaderMaterial}
 */
function createOutlineMaterial(color, thickness) {
  return new THREE.ShaderMaterial({
    uniforms: {
      outlineColor: { value: new THREE.Color(color) },
      outlineThickness: { value: thickness },
    },
    vertexShader: `
      uniform float outlineThickness;
      void main() {
        vec3 pos = position + normal * outlineThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 outlineColor;
      void main() {
        gl_FragColor = vec4(outlineColor, 1.0);
      }
    `,
    side: THREE.BackSide,
  });
}

/**
 * Add outline meshes to every mesh in a creature group.
 * Uses Inverted Hull method: clone geometry, render BackSide, push along normals.
 *
 * @param {THREE.Group} group - Creature group to add outlines to
 * @param {Object} [options]
 * @param {number} [options.color=0x111122] - Outline color
 * @param {number} [options.thickness=0.03] - Outline thickness
 */
export function addOutlines(group, options = {}) {
  const { color = DEFAULT_COLOR, thickness = DEFAULT_THICKNESS } = options;
  const outlineMat = createOutlineMaterial(color, thickness);

  // Collect meshes first to avoid mutating while traversing
  const meshesToOutline = [];
  group.traverse((child) => {
    if (child.isMesh && child.geometry) {
      meshesToOutline.push(child);
    }
  });

  for (const mesh of meshesToOutline) {
    const outlineMesh = new THREE.Mesh(mesh.geometry, outlineMat);
    outlineMesh.name = `${mesh.name}_outline`;
    outlineMesh.position.copy(mesh.position);
    outlineMesh.rotation.copy(mesh.rotation);
    outlineMesh.scale.copy(mesh.scale);
    outlineMesh.castShadow = false;
    outlineMesh.receiveShadow = false;
    outlineMesh.userData.isOutline = true;

    if (mesh.parent) {
      mesh.parent.add(outlineMesh);
    }
  }
}
```

**Step 2: Run test to verify it passes**

Run: `npx vitest run test/viewer/outline.test.ts`

Expected: All 6 tests PASS

**Step 3: Commit**

```bash
git add src/viewer/public/js/outline.js test/viewer/outline.test.ts
git commit -m "feat(viewer): add inverted hull outline system with tests"
```

---

- [-] Task 8: creature.js + animation.js にアウトライン統合

**Files:**
- Modify: `src/viewer/public/js/creature.js` (import追加, buildFromDesign末尾, buildLegacyCreature末尾)
- Modify: `src/viewer/public/js/animation.js` (traverse内にoutline除外)

**Step 1: Add outline import and calls in creature.js**

```javascript
// creature.js top: add import
import { addOutlines } from "./outline.js";

// buildFromDesign — 末尾の return { group, parts }; の直前に追加:
addOutlines(group);

// buildLegacyCreature — stage > 0 パスの末尾 return { group, parts }; の直前に追加:
addOutlines(group, { thickness: 0.025 });
// Egg stage (stage === 0) にもアウトライン適用:
// return { group, parts: { egg } }; の直前に追加:
addOutlines(group, { thickness: 0.02 });
```

**Step 2: Add outline skip in animation.js traverse**

```javascript
// animation.js — applyAnimations 内の traverse コールバック先頭:
group.traverse((child) => {
  if (child.userData?.isOutline) return; // ← 追加
  // ... existing animation logic
```

**Step 3: Run existing tests to verify no regressions**

Run: `npx vitest run test/viewer/`

Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/viewer/public/js/creature.js src/viewer/public/js/animation.js
git commit -m "feat(viewer): integrate outlines into creature builders and animations"
```

**CHECKPOINT:** ブラウザでビューアを確認。キャラクターに黒い輪郭線が表示されるはず。太さ・色は options で調整可能。

---

## Phase 3: Post-Processing Pipeline

- [-] Task 9: postprocess.js 作成

**Files:**
- Create: `src/viewer/public/js/postprocess.js`

EffectComposer は WebGLRenderer に依存するため Node でのユニットテストは不可。
ブラウザで手動確認する。

**Step 1: Create postprocess.js**

```javascript
// src/viewer/public/js/postprocess.js
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/**
 * Create an EffectComposer with the post-processing pipeline.
 *
 * Pipeline: RenderPass → UnrealBloomPass → FXAA → OutputPass
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @returns {{ composer: EffectComposer, resize: (w: number, h: number) => void }}
 */
export function createPostProcessing(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());

  const renderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: 4,
  });

  const composer = new EffectComposer(renderer, renderTarget);

  // 1. Base scene render
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 2. Bloom — subtle glow on eye highlights and emissive accents
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    0.3,   // strength: subtle, not overwhelming
    0.4,   // radius
    0.85,  // threshold: only bright areas bloom
  );
  composer.addPass(bloomPass);

  // 3. FXAA — fast approximate anti-aliasing
  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.uniforms["resolution"].value.set(1 / size.x, 1 / size.y);
  composer.addPass(fxaaPass);

  // 4. Output — correct color space conversion
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  /**
   * Update composer and pass sizes on window resize.
   * @param {number} width
   * @param {number} height
   */
  function resize(width, height) {
    composer.setSize(width, height);
    fxaaPass.uniforms["resolution"].value.set(1 / width, 1 / height);
  }

  return { composer, resize };
}
```

**Step 2: Commit**

```bash
git add src/viewer/public/js/postprocess.js
git commit -m "feat(viewer): add post-processing pipeline with bloom and FXAA"
```

---

- [-] Task 10: app.js にComposer統合

**Files:**
- Modify: `src/viewer/public/js/app.js:1-5` (import追加)
- Modify: `src/viewer/public/js/app.js:19` (Composer初期化)
- Modify: `src/viewer/public/js/app.js:146` (render→composer.render)

**Step 1: Add import**

```javascript
// app.js line 1 area — add import:
import { createPostProcessing } from "./postprocess.js";
```

**Step 2: Initialize composer after scene creation**

```javascript
// After line 19 (const { scene, camera, renderer } = createScene(container);):
const { composer, resize: resizeComposer } = createPostProcessing(renderer, scene, camera);

// Add resize listener for composer:
window.addEventListener("resize", () => {
  resizeComposer(container.clientWidth, container.clientHeight);
});
```

**Step 3: Replace renderer.render with composer.render**

```javascript
// Before (line 146):
renderer.render(scene, camera);

// After:
composer.render();
```

**Step 4: Visual test in browser**

Run: `npm run dev:viewer`

Open browser. Expected: Scene renders with subtle bloom on bright areas and smoother edges from FXAA.

**Step 5: Commit**

```bash
git add src/viewer/public/js/app.js
git commit -m "feat(viewer): integrate EffectComposer into render loop"
```

**CHECKPOINT:** ブラウザで Bloom の発光効果と FXAA のアンチエイリアスを確認。

---

## Phase 4: Lighting & Shadow Upgrade

- [-] Task 11: scene.js ライティング改修

**Files:**
- Modify: `src/viewer/public/js/scene.js`

**Step 1: Add toon-utils import**

```javascript
// scene.js top:
import { createGradientMap } from "./toon-utils.js";
```

**Step 2: Replace AmbientLight with HemisphereLight**

```javascript
// Before (line 28-29):
const ambient = new THREE.AmbientLight(0x404060, 0.6);
scene.add(ambient);

// After:
const hemiLight = new THREE.HemisphereLight(0xffeeff, 0x8888cc, 0.8);
hemiLight.position.set(0, 10, 0);
scene.add(hemiLight);
```

**Step 3: Upgrade shadow map quality**

```javascript
// Before (line 35):
keyLight.shadow.mapSize.set(1024, 1024);

// After:
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -0.005;
keyLight.shadow.normalBias = 0.02;
```

**Step 4: Strengthen rim light**

```javascript
// Before (line 50):
const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);

// After:
const rimLight = new THREE.DirectionalLight(0xaaccff, 0.5);
```

**Step 5: Switch ground to ToonMaterial**

```javascript
// Before (line 56-60):
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x252540,
  roughness: 0.9,
  metalness: 0.1,
});

// After:
const groundMat = new THREE.MeshToonMaterial({
  color: 0x252540,
  gradientMap: createGradientMap(2),
});
```

**Step 6: Commit**

```bash
git add src/viewer/public/js/scene.js
git commit -m "feat(viewer): upgrade lighting with HemisphereLight and shadow quality"
```

---

- [-] Task 12: scene.js 背景グラデーション

**Files:**
- Modify: `src/viewer/public/js/scene.js`

フラットカラーの `scene.background` をグラデーション平面に置換。
three.js は `Scene.background` に直接グラデーションを設定できないため、
NDC座標系の plane + ShaderMaterial で実装する。

**Step 1: Replace scene.background with gradient plane**

```javascript
// Before (line 9):
scene.background = new THREE.Color(0x1a1a2e);

// After — remove that line, add gradient plane:
const bgGeo = new THREE.PlaneGeometry(2, 2);
const bgMat = new THREE.ShaderMaterial({
  uniforms: {
    topColor: { value: new THREE.Color(0x1a1a3e) },
    bottomColor: { value: new THREE.Color(0x0a0a1a) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.999, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    varying vec2 vUv;
    void main() {
      gl_FragColor = vec4(mix(bottomColor, topColor, vUv.y), 1.0);
    }
  `,
  depthWrite: false,
  depthTest: false,
});
const bgMesh = new THREE.Mesh(bgGeo, bgMat);
bgMesh.renderOrder = -1;
bgMesh.frustumCulled = false;
scene.add(bgMesh);
```

**Step 2: Visual test in browser**

Run: `npm run dev:viewer`

Expected: 背景が上部(暗い藍色)から下部(深い黒)へグラデーション

**Step 3: Commit**

```bash
git add src/viewer/public/js/scene.js
git commit -m "feat(viewer): add gradient background for depth"
```

**CHECKPOINT:** ブラウザで全体の雰囲気を確認。HemisphereLight + グラデーション背景 + 高品質シャドウ。

---

## Phase 5: Polish & Effects

- [-] Task 13: 目のハイライト — テスト + 実装

**Files:**
- Create: `test/viewer/eye-highlight.test.ts`
- Modify: `src/viewer/public/js/creature.js` (createEye関数)

アニメキャラクターの「キラキラ目」を白い小球で表現。`MeshBasicMaterial`（ライティング無視）で常に白く光り、Bloom パスで自然に発光。

**Step 1: Write the failing test**

```typescript
// test/viewer/eye-highlight.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { buildLegacyCreature } from "../../src/viewer/public/js/creature.js";

const TEST_PARAMS = {
  headRatio: 0.5, bodyWidthRatio: 0.5, roundness: 0.5, topHeavy: 0.5,
  eyeSize: 2, eyeSpacing: 0.5,
  hasEars: false, hasHorns: false, hasTail: false, hasWings: false,
  limbStage: 0, patternType: 0, patternDensity: 0,
  neckWidth: 0.5, legLength: 0.3, armLength: 0.3,
  tailLength: 0.4, wingSize: 0.5, earSize: 0.3, hornSize: 0.3,
  bodyTaper: 0.3, asymmetry: 0.1,
};

const TEST_PALETTE = [
  "#1a1a2e", "#222244", "#4488aa", "#55aacc",
  "#88ccee", "#ffffff", "#111111", "#ff6644",
];

describe("eye highlights", () => {
  it("each eye group contains a highlight mesh with MeshBasicMaterial", () => {
    const { parts } = buildLegacyCreature(TEST_PARAMS, TEST_PALETTE, 1);
    const leftEye = parts.leftEye as THREE.Group;
    const rightEye = parts.rightEye as THREE.Group;

    const findHighlight = (eyeGroup: THREE.Group) => {
      let found: THREE.Mesh | null = null;
      eyeGroup.traverse((child) => {
        if (child.name === "eye_highlight" && (child as THREE.Mesh).isMesh) {
          found = child as THREE.Mesh;
        }
      });
      return found;
    };

    const leftHighlight = findHighlight(leftEye);
    const rightHighlight = findHighlight(rightEye);

    expect(leftHighlight).not.toBeNull();
    expect(rightHighlight).not.toBeNull();
    expect(leftHighlight!.material.type).toBe("MeshBasicMaterial");
    expect((leftHighlight!.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0xffffff);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/viewer/eye-highlight.test.ts`

Expected: FAIL — no `eye_highlight` mesh found

**Step 3: Add highlight in createEye function**

```javascript
// creature.js — createEye function, after pupil is added:
const highlightGeo = new THREE.SphereGeometry(scale * 0.2, 8, 6);
const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const highlight = new THREE.Mesh(highlightGeo, highlightMat);
highlight.position.set(scale * 0.25, scale * 0.2, scale * 0.7);
highlight.name = "eye_highlight";
eyeGroup.add(highlight);
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/viewer/eye-highlight.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/viewer/public/js/creature.js test/viewer/eye-highlight.test.ts
git commit -m "feat(viewer): add eye highlight points for anime sparkle"
```

---

- [-] Task 14: emissive アクセント — テスト + 実装

**Files:**
- Create: `test/viewer/emissive-accents.test.ts`
- Modify: `src/viewer/public/js/creature.js` (horn/wing tip materials)

角や翼先端に `emissive` を設定。Bloom と組み合わせて微かに光るエフェクト。

**Step 1: Write the failing test**

```typescript
// test/viewer/emissive-accents.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { buildLegacyCreature } from "../../src/viewer/public/js/creature.js";

const TEST_PARAMS = {
  headRatio: 0.5, bodyWidthRatio: 0.5, roundness: 0.5, topHeavy: 0.5,
  eyeSize: 2, eyeSpacing: 0.5,
  hasEars: false, hasHorns: true, hasTail: false, hasWings: false,
  limbStage: 0, patternType: 0, patternDensity: 0,
  neckWidth: 0.5, legLength: 0.3, armLength: 0.3,
  tailLength: 0.4, wingSize: 0.5, earSize: 0.3, hornSize: 0.3,
  bodyTaper: 0.3, asymmetry: 0.1,
};

const TEST_PALETTE = [
  "#1a1a2e", "#222244", "#4488aa", "#55aacc",
  "#88ccee", "#ffffff", "#111111", "#ff6644",
];

describe("emissive accents", () => {
  it("horn materials have non-zero emissiveIntensity", () => {
    // Stage 3+ for horns to appear
    const { group } = buildLegacyCreature(TEST_PARAMS, TEST_PALETTE, 3);
    const hornMaterials: THREE.MeshToonMaterial[] = [];
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !child.userData.isOutline) {
        const mat = (child as THREE.Mesh).material as THREE.MeshToonMaterial;
        if (mat.emissiveIntensity && mat.emissiveIntensity > 0) {
          hornMaterials.push(mat);
        }
      }
    });
    expect(hornMaterials.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/viewer/emissive-accents.test.ts`

Expected: FAIL — no materials have emissiveIntensity > 0

**Step 3: Update horn material in buildLegacyCreature**

```javascript
// creature.js — buildLegacyCreature, horn section (around line 301-315):
// Replace the existing highlightMat usage for horns with an emissive version:

// Inside the `if (hasHorns && stage >= 3)` block, create a dedicated horn material:
const hornMat = new THREE.MeshToonMaterial({
  color: highlightColor,
  gradientMap,
  emissive: highlightColor,
  emissiveIntensity: 0.15,
});
// Use hornMat instead of highlightMat for the horn meshes
const leftHorn = new THREE.Mesh(hornGeo, hornMat);
// ... same for rightHorn
const rightHorn = new THREE.Mesh(hornGeo.clone(), hornMat);
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/viewer/emissive-accents.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/viewer/public/js/creature.js test/viewer/emissive-accents.test.ts
git commit -m "feat(viewer): add emissive accents on horns for bloom interaction"
```

---

- [-] Task 15: アニメーション イージング — テスト + 実装

**Files:**
- Create: `test/viewer/easing.test.ts`
- Modify: `src/viewer/public/js/animation.js`

純粋な数学関数なので Node で完全テスト可能。

**Step 1: Write the failing test**

```typescript
// test/viewer/easing.test.ts
import { describe, it, expect } from "vitest";
import { easeInOutCubic } from "../../src/viewer/public/js/animation.js";

describe("easeInOutCubic", () => {
  it("returns 0 at t=0", () => {
    expect(easeInOutCubic(0)).toBeCloseTo(0);
  });

  it("returns 1 at t=1", () => {
    expect(easeInOutCubic(1)).toBeCloseTo(1);
  });

  it("returns 0.5 at t=0.5 (symmetric midpoint)", () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
  });

  it("starts slow (value < t for small t)", () => {
    expect(easeInOutCubic(0.2)).toBeLessThan(0.2);
  });

  it("ends slow (value > t for large t)", () => {
    expect(easeInOutCubic(0.8)).toBeGreaterThan(0.8);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/viewer/easing.test.ts`

Expected: FAIL — `easeInOutCubic is not exported`

**Step 3: Add and export easeInOutCubic in animation.js**

```javascript
// animation.js — add at top of file, before existing code:

/**
 * Cubic ease-in-out for smoother animation transitions.
 * @param {number} t - Input value 0..1
 * @returns {number} Eased value 0..1
 */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
```

Update blink animation to use easing:

```javascript
// animateBlink — replace squash calculation:
// Before:
const squash = 1 - Math.sin(t * Math.PI);
// After:
const squash = 1 - easeInOutCubic(Math.sin(t * Math.PI));
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/viewer/easing.test.ts`

Expected: All 5 tests PASS

**Step 5: Run all viewer tests**

Run: `npx vitest run test/viewer/`

Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/viewer/public/js/animation.js test/viewer/easing.test.ts
git commit -m "feat(viewer): add easing functions for smoother animations"
```

**CHECKPOINT:** 最終ブラウザ確認。
- Toon Shading（段階的な陰影）
- アウトライン（キャラクター輪郭線）
- Bloom（目のキラキラ、角の発光）
- FXAA（なめらかなエッジ）
- HemisphereLight（自然な間接光）
- グラデーション背景
- イージングアニメーション

---

## Summary

| Task | Phase | テスト方法 | Files |
|------|-------|-----------|-------|
| 0 | Setup | — | package.json |
| 1-2 | Toon | vitest | toon-utils.js, test |
| 3-4 | Toon | vitest | creature.js, test |
| 5 | Toon | vitest | creature.js, test |
| 6-7 | Outline | vitest | outline.js, test |
| 8 | Outline | vitest (regression) | creature.js, animation.js |
| 9 | PostProcess | browser | postprocess.js |
| 10 | PostProcess | browser | app.js |
| 11 | Lighting | browser | scene.js |
| 12 | Background | browser | scene.js |
| 13 | Polish | vitest | creature.js, test |
| 14 | Polish | vitest | creature.js, test |
| 15 | Polish | vitest | animation.js, test |

**影響範囲:** `src/viewer/public/` 配下のみ。他ドメイン（ingestion, progression, personality, ASCII art）・サーバーサイド・PetRenderDataインターフェースへの影響なし。

**パフォーマンス:** セグメント数 8→24（三角形9倍、単一キャラクターで問題なし）。EffectComposer 3パス追加（シンプルなシーンで60fps維持可能）。Inverted Hull でメッシュ2倍（Toon標準手法）。
