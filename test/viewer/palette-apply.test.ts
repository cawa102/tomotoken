// test/viewer/palette-apply.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  COLOR_ROLE_PREFIX,
  applyPalette,
} from "../../src/viewer/public/js/palette-apply.js";

const TEST_PALETTE = [
  "#ff0000", // body (0)
  "#00ff00", // accent (1)
  "#0000ff", // detail (2)
  "#ffff00", // eye (3)
  "#ffffff", // eyewhite (4)
  "#ff00ff", // mouth (5)
  "#00ffff", // accessory (6)
  "#ff8800", // highlight (7)
];

function makeMesh(name: string, color = "#000000"): THREE.Mesh {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshToonMaterial({ color: new THREE.Color(color) });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  return mesh;
}

describe("palette-apply", () => {
  it("exports COLOR_ROLE_PREFIX as 'cr_'", () => {
    expect(COLOR_ROLE_PREFIX).toBe("cr_");
  });

  it("applies body color to meshes with 'body' role prefix (cr_body_*)", () => {
    const group = new THREE.Group();
    const bodyMesh = makeMesh("cr_body_torso");
    group.add(bodyMesh);

    applyPalette(group, TEST_PALETTE);

    const mat = bodyMesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHexString()).toBe(
      new THREE.Color("#ff0000").getHexString(),
    );
  });

  it("applies accent color to meshes with 'accent' role prefix (cr_accent_*)", () => {
    const group = new THREE.Group();
    const accentMesh = makeMesh("cr_accent_horn");
    group.add(accentMesh);

    applyPalette(group, TEST_PALETTE);

    const mat = accentMesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHexString()).toBe(
      new THREE.Color("#00ff00").getHexString(),
    );
  });

  it("applies correct color for each role index", () => {
    const roles = [
      "body",
      "accent",
      "detail",
      "eye",
      "eyewhite",
      "mouth",
      "accessory",
      "highlight",
    ];
    const group = new THREE.Group();
    const meshes = roles.map((role) => makeMesh(`cr_${role}_part`));
    meshes.forEach((m) => group.add(m));

    applyPalette(group, TEST_PALETTE);

    roles.forEach((role, i) => {
      const mat = meshes[i].material as THREE.MeshToonMaterial;
      expect(mat.color.getHexString()).toBe(
        new THREE.Color(TEST_PALETTE[i]).getHexString(),
      );
    });
  });

  it("does not modify meshes without cr_ role prefix", () => {
    const group = new THREE.Group();
    const plainMesh = makeMesh("some_other_mesh", "#123456");
    group.add(plainMesh);

    applyPalette(group, TEST_PALETTE);

    const mat = plainMesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHexString()).toBe(
      new THREE.Color("#123456").getHexString(),
    );
  });

  it("traverses nested children", () => {
    const group = new THREE.Group();
    const nested = new THREE.Group();
    nested.name = "nested_group";
    const deepMesh = makeMesh("cr_detail_stripe");
    nested.add(deepMesh);
    group.add(nested);

    applyPalette(group, TEST_PALETTE);

    const mat = deepMesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHexString()).toBe(
      new THREE.Color("#0000ff").getHexString(),
    );
  });

  it("ignores meshes with cr_ prefix but unknown role", () => {
    const group = new THREE.Group();
    const unknownMesh = makeMesh("cr_unknown_part", "#aabbcc");
    group.add(unknownMesh);

    applyPalette(group, TEST_PALETTE);

    const mat = unknownMesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHexString()).toBe(
      new THREE.Color("#aabbcc").getHexString(),
    );
  });
});
