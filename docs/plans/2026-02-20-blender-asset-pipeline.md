# Blender オフラインアセットパイプライン実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Blender で作成した高品質 glTF モデルを Three.js ビューアで読み込み、製品クオリティのキャラクター表示を実現する

**Architecture:** 開発時に Blender（MCP で効率化）で 8 アーキタイプのモデルを作成し、glTF/GLB にエクスポートしてリポジトリに保存。ランタイムでは Three.js の GLTFLoader で読み込み、カラーパレット・表情・アニメーションを動的に適用する。既存のプロシージャル生成はフォールバックとして維持。

**Tech Stack:** Three.js 0.170.0（GLTFLoader）, Blender 4.x + blender-mcp, Vitest, glTF 2.0

**前提条件:**
- `feat/pro-3d-viewer` ブランチのマージ完了（トゥーンシェーディング・アウトライン・ポスプロ基盤）
- Blender 4.x インストール済み
- `blender-mcp` アドオン導入済み

---

## フェーズ 1: GLTFLoader 統合基盤

glTF モデルを読み込む仕組みをビューアに追加する。モデルが存在しない場合は既存のプロシージャル生成にフォールバック。

---

- [-] Task 1: GLTFLoader のインポートマップ追加

**Files:**
- Modify: `src/viewer/public/index.html:78-85`

**Step 1: index.html のインポートマップに GLTFLoader を追加**

現在のインポートマップ:
```json
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
  }
}
```

GLTFLoader は `three/addons/loaders/GLTFLoader.js` でアクセス可能なため、インポートマップの変更は不要。ただし、ビューアコードで `import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'` が正しく解決されることを確認する。

**Step 2: 確認**

ブラウザの開発者コンソールでインポートエラーが出ないことを確認。

**Step 3: Commit**

```bash
git add src/viewer/public/index.html
git commit -m "chore(viewer): verify GLTFLoader import path in import map"
```

---

- [-] Task 2: モデルローダーモジュール作成（テストファースト）

**Files:**
- Create: `test/viewer/model-loader.test.ts`
- Create: `src/viewer/public/js/model-loader.js`

**Step 1: テスト作成**

```typescript
// test/viewer/model-loader.test.ts
import { describe, it, expect, vi } from "vitest";

// GLTFLoader をモック（Node.js 環境では WebGL 不可）
vi.mock("three/addons/loaders/GLTFLoader.js", () => {
  class MockGLTFLoader {
    load(
      url: string,
      onLoad: (gltf: unknown) => void,
      _onProgress?: (event: unknown) => void,
      onError?: (error: Error) => void,
    ) {
      if (url.includes("missing")) {
        onError?.(new Error("404 Not Found"));
      } else {
        onLoad({
          scene: { name: "mock-scene", children: [], traverse: vi.fn() },
          animations: [],
        });
      }
    }
  }
  return { GLTFLoader: MockGLTFLoader };
});

import { loadModel, MODEL_BASE_PATH } from "../../src/viewer/public/js/model-loader.js";

describe("model-loader", () => {
  it("exports MODEL_BASE_PATH as ./models/", () => {
    expect(MODEL_BASE_PATH).toBe("./models/");
  });

  it("resolves model path from archetype name", async () => {
    const result = await loadModel("builder");
    expect(result).not.toBeNull();
    expect(result!.scene).toBeDefined();
  });

  it("returns null when model file not found", async () => {
    const result = await loadModel("missing");
    expect(result).toBeNull();
  });

  it("returns null for empty archetype string", async () => {
    const result = await loadModel("");
    expect(result).toBeNull();
  });
});
```

**Step 2: テスト実行して FAIL を確認**

Run: `npx vitest run test/viewer/model-loader.test.ts`
Expected: FAIL — `model-loader.js` が存在しない

**Step 3: 最小実装**

```javascript
// src/viewer/public/js/model-loader.js
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const MODEL_BASE_PATH = "./models/";

const loader = new GLTFLoader();

/**
 * アーキタイプ名から glTF モデルを読み込む。
 * モデルが見つからなければ null を返す（プロシージャル生成にフォールバック）。
 * @param {string} archetype - アーキタイプ名（例: "builder"）
 * @returns {Promise<{scene: THREE.Group, animations: THREE.AnimationClip[]} | null>}
 */
export function loadModel(archetype) {
  if (!archetype) return Promise.resolve(null);

  const url = `${MODEL_BASE_PATH}${archetype}.glb`;

  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations }),
      undefined,
      () => resolve(null),
    );
  });
}
```

**Step 4: テスト実行して PASS を確認**

Run: `npx vitest run test/viewer/model-loader.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add test/viewer/model-loader.test.ts src/viewer/public/js/model-loader.js
git commit -m "feat(viewer): add glTF model loader with fallback to null"
```

---

- [-] Task 3: creature.js にモデル読み込みパスを追加（テストファースト）

**Files:**
- Create: `test/viewer/creature-model-loading.test.ts`
- Modify: `src/viewer/public/js/creature.js`

**Step 1: テスト作成**

```typescript
// test/viewer/creature-model-loading.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as THREE from "three";

// model-loader をモック
const mockLoadModel = vi.fn();
vi.mock("../../src/viewer/public/js/model-loader.js", () => ({
  loadModel: (...args: unknown[]) => mockLoadModel(...args),
  MODEL_BASE_PATH: "./models/",
}));

import {
  buildFromModel,
} from "../../src/viewer/public/js/creature.js";

describe("buildFromModel", () => {
  beforeEach(() => {
    mockLoadModel.mockReset();
  });

  it("returns loaded model scene as group with parts map", async () => {
    const mockBody = new THREE.Mesh(
      new THREE.SphereGeometry(1),
      new THREE.MeshStandardMaterial(),
    );
    mockBody.name = "body";
    const mockEyeL = new THREE.Mesh(
      new THREE.SphereGeometry(0.1),
      new THREE.MeshStandardMaterial(),
    );
    mockEyeL.name = "eye-left";
    mockBody.add(mockEyeL);

    const mockScene = new THREE.Group();
    mockScene.add(mockBody);

    mockLoadModel.mockResolvedValue({ scene: mockScene, animations: [] });

    const result = await buildFromModel("builder");
    expect(result).not.toBeNull();
    expect(result!.group).toBeInstanceOf(THREE.Group);
    expect(result!.parts.body).toBe(mockBody);
    expect(result!.parts["eye-left"]).toBe(mockEyeL);
  });

  it("returns null when loadModel returns null", async () => {
    mockLoadModel.mockResolvedValue(null);
    const result = await buildFromModel("unknown");
    expect(result).toBeNull();
  });
});
```

**Step 2: テスト実行して FAIL を確認**

Run: `npx vitest run test/viewer/creature-model-loading.test.ts`
Expected: FAIL — `buildFromModel` が存在しない

**Step 3: creature.js に buildFromModel を追加**

`src/viewer/public/js/creature.js` の先頭にインポート追加:
```javascript
import { loadModel } from "./model-loader.js";
```

既存の `buildFromDesign` の近くに `buildFromModel` を追加:
```javascript
/**
 * glTF モデルからクリーチャーを構築する。
 * モデルが見つからなければ null を返す。
 * @param {string} archetype - アーキタイプ名
 * @returns {Promise<{group: THREE.Group, parts: Record<string, THREE.Object3D>} | null>}
 */
export async function buildFromModel(archetype) {
  const loaded = await loadModel(archetype);
  if (!loaded) return null;

  const group = loaded.scene;
  group.name = "creature";

  const parts = {};
  group.traverse((child) => {
    if (child.name) {
      parts[child.name] = child;
    }
  });

  return { group, parts };
}
```

**Step 4: テスト実行して PASS を確認**

Run: `npx vitest run test/viewer/creature-model-loading.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add test/viewer/creature-model-loading.test.ts src/viewer/public/js/creature.js
git commit -m "feat(viewer): add buildFromModel for glTF creature loading"
```

---

- [-] Task 4: app.js の updateCreature にモデル読み込み優先パスを追加

**Files:**
- Modify: `src/viewer/public/js/app.js:70-93`

**Step 1: updateCreature のフロー変更**

現在の優先順位:
1. `creatureDesign` あり → `buildFromDesign()`
2. なし → `buildLegacyCreature()`

新しい優先順位:
1. glTF モデル存在 → `buildFromModel(archetype)`
2. `creatureDesign` あり → `buildFromDesign()`
3. なし → `buildLegacyCreature()`

```javascript
// app.js の updateCreature を変更
import { buildFromDesign, buildFromModel, buildLegacyCreature, disposeCreature } from "./creature.js";

async function updateCreature(data) {
  const { creatureParams, palette, petId, stage, creatureDesign, archetype } = data;
  const needsRebuild = petId !== currentPetId || stage !== currentStage;
  if (!needsRebuild) return;

  disposeCreature(scene);

  // 1. glTF モデル優先
  let built = await buildFromModel(archetype);

  // 2. フォールバック: LLM デザイン
  if (!built && creatureDesign) {
    built = buildFromDesign(creatureDesign);
  }

  // 3. フォールバック: プロシージャル生成
  if (!built) {
    built = buildLegacyCreature(creatureParams, palette, stage);
  }

  scene.add(built.group);
  currentGroup = built.group;
  currentParts = built.parts;
  currentPetId = petId;
  currentStage = stage;
  currentDesign = creatureDesign;
}
```

**Step 2: ブラウザで動作確認**

モデルファイルがまだないため、コンソールに 404 が一瞬出た後プロシージャル生成にフォールバックすることを確認。

**Step 3: Commit**

```bash
git add src/viewer/public/js/app.js src/viewer/public/js/creature.js
git commit -m "feat(viewer): prioritize glTF model loading with procedural fallback"
```

---

## フェーズ 2: カラーパレット適用システム

glTF モデルのマテリアルカラーをランタイムで上書きし、シードベースのカラーパレットを反映する。

---

- [-] Task 5: カラー適用モジュール作成（テストファースト）

**Files:**
- Create: `test/viewer/palette-apply.test.ts`
- Create: `src/viewer/public/js/palette-apply.js`

**Step 1: テスト作成**

```typescript
// test/viewer/palette-apply.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { applyPalette, COLOR_ROLE_PREFIX } from "../../src/viewer/public/js/palette-apply.js";

describe("applyPalette", () => {
  function createMeshWithRole(role: string): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshToonMaterial({ color: 0xffffff }),
    );
    mesh.name = `${COLOR_ROLE_PREFIX}${role}_part`;
    return mesh;
  }

  it("applies body color to meshes with 'body' role prefix", () => {
    const group = new THREE.Group();
    const mesh = createMeshWithRole("body");
    group.add(mesh);

    const palette = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffffff", "#000000"];
    applyPalette(group, palette);

    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHexString()).toBe("ff0000");
  });

  it("applies accent color to meshes with 'accent' role prefix", () => {
    const group = new THREE.Group();
    const mesh = createMeshWithRole("accent");
    group.add(mesh);

    const palette = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffffff", "#000000"];
    applyPalette(group, palette);

    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHexString()).toBe("00ff00");
  });

  it("does not modify meshes without role prefix", () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshToonMaterial({ color: 0xaabbcc }),
    );
    mesh.name = "random-part";
    group.add(mesh);

    const palette = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffffff", "#000000"];
    applyPalette(group, palette);

    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHexString()).toBe("aabbcc");
  });

  it("traverses nested children", () => {
    const group = new THREE.Group();
    const parent = new THREE.Group();
    const child = createMeshWithRole("body");
    parent.add(child);
    group.add(parent);

    const palette = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffffff", "#000000"];
    applyPalette(group, palette);

    const mat = child.material as THREE.MeshToonMaterial;
    expect(mat.color.getHexString()).toBe("ff0000");
  });
});
```

**Step 2: テスト実行して FAIL を確認**

Run: `npx vitest run test/viewer/palette-apply.test.ts`
Expected: FAIL

**Step 3: 実装**

```javascript
// src/viewer/public/js/palette-apply.js
import * as THREE from "three";

/**
 * glTF モデルのメッシュ名に含まれるロールプレフィックス。
 * Blender でメッシュ命名時にこのプレフィックスを使用する規約。
 *
 * 例: "cr_body_torso", "cr_accent_horn-left"
 */
export const COLOR_ROLE_PREFIX = "cr_";

/**
 * パレットインデックスのロールマッピング。
 * palette[0] = body, palette[1] = accent, etc.
 */
const ROLE_TO_INDEX = {
  body: 0,
  accent: 1,
  detail: 2,
  eye: 3,
  eyewhite: 4,
  mouth: 5,
  accessory: 6,
  highlight: 7,
};

/**
 * glTF モデル内のメッシュにカラーパレットを適用する。
 * メッシュ名が "cr_{role}_..." のパターンに一致する場合、
 * 対応するパレットカラーでマテリアルの color を上書きする。
 *
 * @param {THREE.Group} group - glTF のルートグループ
 * @param {string[]} palette - 8色の hex カラー配列
 */
export function applyPalette(group, palette) {
  group.traverse((child) => {
    if (!child.isMesh) return;
    if (!child.name.startsWith(COLOR_ROLE_PREFIX)) return;

    const afterPrefix = child.name.slice(COLOR_ROLE_PREFIX.length);
    const role = afterPrefix.split("_")[0].toLowerCase();
    const index = ROLE_TO_INDEX[role];

    if (index !== undefined && palette[index]) {
      child.material.color = new THREE.Color(palette[index]);
    }
  });
}
```

**Step 4: テスト実行して PASS を確認**

Run: `npx vitest run test/viewer/palette-apply.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add test/viewer/palette-apply.test.ts src/viewer/public/js/palette-apply.js
git commit -m "feat(viewer): add palette color application for glTF models"
```

---

- [-] Task 6: buildFromModel にパレット適用を統合

**Files:**
- Modify: `test/viewer/creature-model-loading.test.ts`
- Modify: `src/viewer/public/js/creature.js`

**Step 1: テスト追加**

`test/viewer/creature-model-loading.test.ts` に追加:
```typescript
it("applies palette colors to loaded model", async () => {
  const mockBody = new THREE.Mesh(
    new THREE.SphereGeometry(1),
    new THREE.MeshToonMaterial({ color: 0xffffff }),
  );
  mockBody.name = "cr_body_torso";

  const mockScene = new THREE.Group();
  mockScene.add(mockBody);

  mockLoadModel.mockResolvedValue({ scene: mockScene, animations: [] });

  const palette = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffffff", "#000000"];
  const result = await buildFromModel("builder", palette);

  expect(result).not.toBeNull();
  const mat = mockBody.material as THREE.MeshToonMaterial;
  expect(mat.color.getHexString()).toBe("ff0000");
});
```

**Step 2: テスト FAIL を確認**

Run: `npx vitest run test/viewer/creature-model-loading.test.ts`
Expected: FAIL — `buildFromModel` が palette を受け取らない

**Step 3: buildFromModel に palette 引数を追加**

```javascript
import { applyPalette } from "./palette-apply.js";

export async function buildFromModel(archetype, palette) {
  const loaded = await loadModel(archetype);
  if (!loaded) return null;

  const group = loaded.scene;
  group.name = "creature";

  if (palette) {
    applyPalette(group, palette);
  }

  const parts = {};
  group.traverse((child) => {
    if (child.name) {
      parts[child.name] = child;
    }
  });

  return { group, parts };
}
```

**Step 4: テスト PASS を確認**

Run: `npx vitest run test/viewer/creature-model-loading.test.ts`
Expected: PASS

**Step 5: app.js の呼び出しも更新**

```javascript
let built = await buildFromModel(archetype, palette);
```

**Step 6: Commit**

```bash
git add test/viewer/creature-model-loading.test.ts src/viewer/public/js/creature.js src/viewer/public/js/app.js
git commit -m "feat(viewer): apply color palette to loaded glTF models"
```

---

## フェーズ 3: 表情システム統合

glTF モデルのシェイプキー（モーフターゲット）を使って表情を制御する。

---

- [-] Task 7: モーフターゲット表情モジュール作成（テストファースト）

**Files:**
- Create: `test/viewer/morph-expression.test.ts`
- Create: `src/viewer/public/js/morph-expression.js`

**Step 1: テスト作成**

```typescript
// test/viewer/morph-expression.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { applyMorphExpression, MORPH_NAMES } from "../../src/viewer/public/js/morph-expression.js";

describe("applyMorphExpression", () => {
  function createMorphMesh(morphNames: string[]): THREE.Mesh {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    // morphAttributes はシェイプキーを模擬
    geo.morphAttributes.position = morphNames.map(
      () => new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3),
    );
    const mat = new THREE.MeshToonMaterial({ morphTargets: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.morphTargetDictionary = Object.fromEntries(morphNames.map((n, i) => [n, i]));
    mesh.morphTargetInfluences = new Array(morphNames.length).fill(0);
    mesh.name = "cr_body_face";
    return mesh;
  }

  it("sets morph target influence for matching expression", () => {
    const mesh = createMorphMesh(["happy", "sleepy", "excited"]);
    const group = new THREE.Group();
    group.add(mesh);

    applyMorphExpression(group, "happy");

    expect(mesh.morphTargetInfluences![0]).toBe(1); // happy = 1
    expect(mesh.morphTargetInfluences![1]).toBe(0); // sleepy = 0
    expect(mesh.morphTargetInfluences![2]).toBe(0); // excited = 0
  });

  it("resets all morph targets when expression is 'default'", () => {
    const mesh = createMorphMesh(["happy", "sleepy"]);
    const group = new THREE.Group();
    group.add(mesh);

    mesh.morphTargetInfluences![0] = 1;
    applyMorphExpression(group, "default");

    expect(mesh.morphTargetInfluences![0]).toBe(0);
    expect(mesh.morphTargetInfluences![1]).toBe(0);
  });

  it("does nothing for meshes without morph targets", () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshToonMaterial(),
    );
    mesh.name = "cr_body_torso";
    const group = new THREE.Group();
    group.add(mesh);

    // Should not throw
    expect(() => applyMorphExpression(group, "happy")).not.toThrow();
  });
});
```

**Step 2: テスト FAIL を確認**

Run: `npx vitest run test/viewer/morph-expression.test.ts`
Expected: FAIL

**Step 3: 実装**

```javascript
// src/viewer/public/js/morph-expression.js

/**
 * Blender でシェイプキーに使用する標準名。
 * モデル作成時にこれらの名前でシェイプキーを定義する。
 */
export const MORPH_NAMES = [
  "happy",
  "sleepy",
  "excited",
  "focused",
  "surprised",
  "sad",
];

/**
 * glTF モデル内のモーフターゲットを使って表情を適用する。
 *
 * @param {THREE.Group} group - クリーチャーのルートグループ
 * @param {string} expression - 表情名（MORPH_NAMES の一つ、または "default"）
 */
export function applyMorphExpression(group, expression) {
  group.traverse((child) => {
    if (!child.isMesh) return;
    if (!child.morphTargetDictionary) return;
    if (!child.morphTargetInfluences) return;

    // 全モーフターゲットをリセット
    for (let i = 0; i < child.morphTargetInfluences.length; i++) {
      child.morphTargetInfluences[i] = 0;
    }

    // "default" の場合はリセットのみ
    if (expression === "default") return;

    // 該当する表情のモーフターゲットを 1 に設定
    const index = child.morphTargetDictionary[expression];
    if (index !== undefined) {
      child.morphTargetInfluences[index] = 1;
    }
  });
}
```

**Step 4: テスト PASS を確認**

Run: `npx vitest run test/viewer/morph-expression.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add test/viewer/morph-expression.test.ts src/viewer/public/js/morph-expression.js
git commit -m "feat(viewer): add morph target expression system for glTF models"
```

---

- [-] Task 8: app.js の表情選択にモーフターゲットパスを追加

**Files:**
- Modify: `src/viewer/public/js/app.js:128-139`

**Step 1: app.js のアニメーションループに分岐追加**

```javascript
import { applyMorphExpression } from "./morph-expression.js";

// animate() 内の表情処理を変更:
// glTF モデル（モーフターゲットあり）の場合
const isGltfModel = currentGroup?.userData?.isGltfModel;
if (isGltfModel) {
  const expr = selectExpression(null, { progress: currentProgress });
  applyMorphExpression(currentGroup, expr || "default");
} else if (currentDesign) {
  // 既存の LLM デザインパス
  const expr = selectExpression(currentDesign.expressions, { progress: currentProgress });
  if (expr) applyExpression(currentParts, currentDesign.expressions[expr]);
}
```

**Step 2: buildFromModel で userData フラグを設定**

```javascript
export async function buildFromModel(archetype, palette) {
  const loaded = await loadModel(archetype);
  if (!loaded) return null;

  const group = loaded.scene;
  group.name = "creature";
  group.userData.isGltfModel = true;  // ← 追加

  // ...
}
```

**Step 3: 動作確認**

ブラウザでモーフターゲット付きモデルが正しく表情変化することを確認。

**Step 4: Commit**

```bash
git add src/viewer/public/js/app.js src/viewer/public/js/creature.js
git commit -m "feat(viewer): integrate morph expression system into render loop"
```

---

## フェーズ 4: glTF アニメーション再生

Blender で仕込んだアニメーションクリップ（アイドル、まばたき等）を Three.js で再生する。

---

- [-] Task 9: アニメーションミキサー管理モジュール作成（テストファースト）

**Files:**
- Create: `test/viewer/anim-mixer.test.ts`
- Create: `src/viewer/public/js/anim-mixer.js`

**Step 1: テスト作成**

```typescript
// test/viewer/anim-mixer.test.ts
import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { createAnimMixer, CLIP_NAMES } from "../../src/viewer/public/js/anim-mixer.js";

describe("createAnimMixer", () => {
  it("exports standard clip names", () => {
    expect(CLIP_NAMES).toContain("idle");
    expect(CLIP_NAMES).toContain("blink");
  });

  it("creates mixer and plays idle clip if available", () => {
    const group = new THREE.Group();
    const track = new THREE.NumberKeyframeTrack(".position[1]", [0, 1], [0, 0.1]);
    const idleClip = new THREE.AnimationClip("idle", 1, [track]);
    const blinkClip = new THREE.AnimationClip("blink", 0.3, [track]);

    const { mixer, actions } = createAnimMixer(group, [idleClip, blinkClip]);

    expect(mixer).toBeInstanceOf(THREE.AnimationMixer);
    expect(actions.idle).toBeDefined();
    expect(actions.blink).toBeDefined();
  });

  it("returns empty actions when no clips provided", () => {
    const group = new THREE.Group();
    const { mixer, actions } = createAnimMixer(group, []);

    expect(mixer).toBeInstanceOf(THREE.AnimationMixer);
    expect(Object.keys(actions)).toHaveLength(0);
  });
});
```

**Step 2: テスト FAIL を確認**

Run: `npx vitest run test/viewer/anim-mixer.test.ts`
Expected: FAIL

**Step 3: 実装**

```javascript
// src/viewer/public/js/anim-mixer.js
import * as THREE from "three";

/**
 * Blender でアニメーションクリップに使用する標準名。
 */
export const CLIP_NAMES = ["idle", "blink", "walk", "jump", "wave"];

/**
 * glTF モデル用のアニメーションミキサーを作成する。
 *
 * @param {THREE.Group} group - クリーチャーのルートグループ
 * @param {THREE.AnimationClip[]} clips - glTF から読み込んだクリップ
 * @returns {{ mixer: THREE.AnimationMixer, actions: Record<string, THREE.AnimationAction> }}
 */
export function createAnimMixer(group, clips) {
  const mixer = new THREE.AnimationMixer(group);
  const actions = {};

  for (const clip of clips) {
    const action = mixer.clipAction(clip);
    actions[clip.name] = action;

    // idle はデフォルトでループ再生
    if (clip.name === "idle") {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
    }
  }

  return { mixer, actions };
}
```

**Step 4: テスト PASS を確認**

Run: `npx vitest run test/viewer/anim-mixer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add test/viewer/anim-mixer.test.ts src/viewer/public/js/anim-mixer.js
git commit -m "feat(viewer): add animation mixer for glTF clip playback"
```

---

- [-] Task 10: app.js のアニメーションループにミキサー更新を統合

**Files:**
- Modify: `src/viewer/public/js/app.js`
- Modify: `src/viewer/public/js/creature.js`

**Step 1: buildFromModel でミキサーを作成**

```javascript
import { createAnimMixer } from "./anim-mixer.js";

export async function buildFromModel(archetype, palette) {
  const loaded = await loadModel(archetype);
  if (!loaded) return null;

  const group = loaded.scene;
  group.name = "creature";
  group.userData.isGltfModel = true;

  if (palette) {
    applyPalette(group, palette);
  }

  // アニメーションミキサー作成
  const { mixer, actions } = createAnimMixer(group, loaded.animations);

  const parts = {};
  group.traverse((child) => {
    if (child.name) {
      parts[child.name] = child;
    }
  });

  return { group, parts, mixer, actions };
}
```

**Step 2: app.js でミキサーを毎フレーム更新**

```javascript
let currentMixer = null;

async function updateCreature(data) {
  // ... 既存の処理
  let built = await buildFromModel(archetype, palette);
  if (built) {
    currentMixer = built.mixer || null;
  } else {
    currentMixer = null;
    // ... フォールバック
  }
  // ...
}

function animate() {
  // ...
  const delta = clock.getDelta();
  if (currentMixer) {
    currentMixer.update(delta);
  }
  // ...
}
```

**Step 3: Commit**

```bash
git add src/viewer/public/js/app.js src/viewer/public/js/creature.js
git commit -m "feat(viewer): integrate animation mixer into render loop"
```

---

## フェーズ 5: Blender MCP セットアップ & テストモデル

Blender MCP を設定し、最初のテストモデルを作成する。

---

- [-] Task 11: Blender MCP サーバーを Claude Code に登録

**Files:**
- None（CLI 設定のみ）

**Step 1: blender-mcp をインストール**

Blender 4.x で:
1. Edit → Preferences → Add-ons → Install
2. `addon.py` を選択（blender-mcp リポジトリから）
3. アドオンを有効化
4. サイドパネル（N キー）→ BlenderMCP → "Start MCP Server" をクリック

**Step 2: Claude Code に MCP サーバーを登録**

```bash
claude mcp add --transport stdio --scope project blender -- uvx blender-mcp
```

**Step 3: 接続確認**

Claude Code で Blender ツールが利用可能になったことを確認。

**Step 4: Commit**

```bash
git add .mcp.json
git commit -m "chore: add blender-mcp server configuration"
```

---

- [-] Task 12: モデルディレクトリとプレースホルダー作成

**Files:**
- Create: `src/viewer/public/models/.gitkeep`

**Step 1: ディレクトリ作成**

```bash
mkdir -p src/viewer/public/models
touch src/viewer/public/models/.gitkeep
```

**Step 2: .gitattributes に LFS 設定（任意）**

glTF バイナリファイルが大きい場合:
```
src/viewer/public/models/*.glb filter=lfs diff=lfs merge=lfs -text
```

**Step 3: Commit**

```bash
git add src/viewer/public/models/.gitkeep
git commit -m "chore: create models directory for glTF assets"
```

---

- [-] Task 13: Blender MCP でテストモデル（builder アーキタイプ）作成

**Files:**
- Create: `src/viewer/public/models/builder.glb`
- Create: `docs/model-spec.md`

**Step 1: モデル仕様書を作成**

`docs/model-spec.md`:
```markdown
# Tomotoken 3D モデル仕様

## 命名規約

メッシュ名には `cr_` プレフィックスとロールを含める:
- `cr_body_*` — メインボディ（palette[0]）
- `cr_accent_*` — アクセント部位（palette[1]）
- `cr_detail_*` — ディテール（palette[2]）
- `cr_eye_*` — 瞳（palette[3]）
- `cr_eyewhite_*` — 白目（palette[4]）
- `cr_mouth_*` — 口（palette[5]）
- `cr_accessory_*` — アクセサリー（palette[6]）
- `cr_highlight_*` — ハイライト（palette[7]）

## ジオメトリ制約

- 1モデルあたり最大 5,000 頂点
- 全モデル合計 < 2MB（GLB 圧縮後）
- Draco 圧縮推奨

## シェイプキー（モーフターゲット）

Basis（デフォルト）の上に以下を定義:
- `happy` — 笑顔
- `sleepy` — 眠そう
- `excited` — 興奮
- `focused` — 集中
- `surprised` — 驚き
- `sad` — 悲しみ

## アニメーションクリップ

- `idle` — アイドルモーション（2-4秒ループ）
- `blink` — まばたき（0.3秒）

## エクスポート設定

- Format: glTF Binary (.glb)
- Apply Modifiers: ON
- Animation: Include
- Shape Keys: Include
- Compression: Draco (quantization: position 14, normal 10)
```

**Step 2: Blender MCP を使ってテストモデルを作成**

Claude Code から Blender MCP ツールを使い、builder アーキタイプの基本モデルを作成:
- 丸いボディ + 大きな頭 + 短い手足
- メッシュ名に `cr_` プレフィックス
- 基本的なシェイプキー（happy, sleepy）
- idle アニメーション

**Step 3: GLB エクスポート**

```python
# Blender Python (MCP 経由で実行)
bpy.ops.export_scene.gltf(
    filepath="src/viewer/public/models/builder.glb",
    export_format="GLB",
    export_draco_mesh_compression_enable=True,
    export_animations=True,
    export_morph=True,
)
```

**Step 4: ビューアで動作確認**

ビューアを起動し、builder モデルが読み込まれてカラーパレットが適用されることを確認。

**Step 5: Commit**

```bash
git add docs/model-spec.md src/viewer/public/models/builder.glb
git commit -m "feat: add builder archetype glTF model and model specification"
```

---

- [-] Task 14: ビューアでの統合テスト（ブラウザ確認）

**Files:**
- None（手動確認）

**Step 1: ビューアサーバー起動**

```bash
npm run build && node dist/viewer/server.js
```

**Step 2: 確認項目チェックリスト**

- [-] builder モデルが読み込まれる（404 フォールバックではない）
- [-] カラーパレットが正しく適用される
- [-] idle アニメーションがループ再生される
- [-] 表情が時間帯/進捗に応じて変化する
- [-] トゥーンシェーディングが適用される
- [-] アウトラインが描画される
- [-] ブルームエフェクトが機能する
- [-] 他のアーキタイプではプロシージャル生成にフォールバックする

**Step 3: パフォーマンス確認**

- 60fps 維持（開発者ツール Performance タブ）
- メモリリークなし（creature 切り替え時に dispose 正常）

---

## フェーズ 6: 残り 7 アーキタイプのモデル制作

Task 13 と同じ手順で残りのモデルを作成する。

---

- [ ] Task 15-21: 各アーキタイプのモデル作成

各アーキタイプごとに:

| Task | Archetype | キャラクター特徴 |
|------|-----------|----------------|
| 15 | fixer | ゴーグル付き、ツール持ち |
| 16 | refiner | スリムでエレガント |
| 17 | scholar | メガネ、本を持つ |
| 18 | scribe | ペンと巻物 |
| 19 | architect | 設計図、定規 |
| 20 | operator | ヘルメット、歯車 |
| 21 | guardian | 盾、鎧 |

**各タスクの手順:**
1. Blender MCP でモデル作成
2. `cr_` プレフィックス命名規約に従う
3. シェイプキー 6 種追加
4. idle + blink アニメーション追加
5. GLB エクスポート（Draco 圧縮）
6. ビューアで確認
7. Commit: `feat: add {archetype} archetype glTF model`

---

## タスク一覧サマリー

| # | タスク | フェーズ |
|---|--------|---------|
| 1 | GLTFLoader インポート確認 | 1: 基盤 |
| 2 | モデルローダーモジュール作成 | 1: 基盤 |
| 3 | creature.js に buildFromModel 追加 | 1: 基盤 |
| 4 | app.js にモデル読み込み優先パス追加 | 1: 基盤 |
| 5 | カラーパレット適用モジュール作成 | 2: カラー |
| 6 | buildFromModel にパレット適用統合 | 2: カラー |
| 7 | モーフターゲット表情モジュール作成 | 3: 表情 |
| 8 | 表情システム統合 | 3: 表情 |
| 9 | アニメーションミキサーモジュール作成 | 4: アニメ |
| 10 | ミキサーをレンダリングループに統合 | 4: アニメ |
| 11 | Blender MCP セットアップ | 5: モデル |
| 12 | モデルディレクトリ作成 | 5: モデル |
| 13 | テストモデル（builder）作成 | 5: モデル |
| 14 | 統合テスト | 5: モデル |
| 15-21 | 残り 7 アーキタイプ | 6: 制作 |

---

## リスクと軽減策

| リスク | 影響 | 軽減策 |
|--------|------|--------|
| Blender MCP でキャラクター品質が低い | モデル品質不足 | MCP は効率化ツール。最終調整は手動 Blender で行う |
| glTF ファイルサイズが 2MB 超 | ロード時間増大 | Draco 圧縮、頂点数制限（5,000/体）、LOD 検討 |
| モーフターゲットが Three.js で正常動作しない | 表情機能不全 | フォールバックとして既存の scale ベース表情を維持 |
| トゥーンシェーディングが glTF マテリアルと競合 | 見た目の不整合 | マテリアルを MeshToonMaterial に完全置換する処理を追加 |
| feat/pro-3d-viewer のマージでコンフリクト | 開発遅延 | 先にマージを完了してからパイプライン開発に着手 |
