import * as THREE from "three";
import { createGradientMap } from "./toon-utils.js";
import { addOutlines } from "./outline.js";

const STAGE_NAMES = ["egg", "infant", "child", "youth", "complete", "item"];

// --- Geometry factory for primitive strings ---
const TOON_SEGMENTS = 24;

function createGeometry(primitive, scale) {
  const [sx, sy, sz] = scale;
  let geo;

  switch (primitive) {
    case "sphere":
      geo = new THREE.SphereGeometry(0.5, TOON_SEGMENTS, TOON_SEGMENTS - 2);
      break;
    case "box":
      geo = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
      break;
    case "cylinder":
      geo = new THREE.CylinderGeometry(0.5, 0.5, 1, TOON_SEGMENTS);
      break;
    case "cone":
      geo = new THREE.ConeGeometry(0.5, 1, TOON_SEGMENTS);
      break;
    case "torus":
      geo = new THREE.TorusGeometry(0.35, 0.15, TOON_SEGMENTS, TOON_SEGMENTS);
      break;
    case "capsule":
      geo = new THREE.CapsuleGeometry(0.3, 0.4, 4, TOON_SEGMENTS);
      break;
    default:
      geo = new THREE.SphereGeometry(0.5, TOON_SEGMENTS, TOON_SEGMENTS - 2);
  }

  geo.scale(sx, sy, sz);
  return geo;
}

/**
 * Recursively build a Three.js Object3D from a part definition.
 */
function buildPart(partDef) {
  const { name, primitive, position, rotation, scale, color, material, children, animatable } = partDef;

  const geo = createGeometry(primitive, scale);
  const gradientMap = createGradientMap(3);
  const mat = new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;

  if (animatable) {
    mesh.userData.animatable = { ...animatable };
  }

  if (children && children.length > 0) {
    for (const childDef of children) {
      const childMesh = buildPart(childDef);
      mesh.add(childMesh);
    }
  }

  return mesh;
}

/**
 * Build a 3D creature from an LLM-generated CreatureDesign JSON.
 * Returns { group, parts } where parts is a flat map of named meshes.
 */
export function buildFromDesign(design) {
  const group = new THREE.Group();
  group.name = "creature";

  const parts = {};

  for (const partDef of design.parts) {
    const mesh = buildPart(partDef);
    group.add(mesh);
    parts[partDef.name] = mesh;

    // Collect named descendants for expression lookups
    mesh.traverse((child) => {
      if (child !== mesh && child.name) {
        parts[child.name] = child;
      }
    });
  }

  addOutlines(group);
  return { group, parts };
}

/**
 * Build a low-poly stylized 3D creature from CreatureParams + palette.
 * Returns a THREE.Group that can be added to the scene.
 *
 * Legacy PRNG-based builder kept as fallback when no LLM design is available.
 * Style: Crossy Road-inspired low-poly with rounded primitives.
 */
export function buildLegacyCreature(params, palette, stage) {
  const group = new THREE.Group();
  group.name = "creature";

  // Parse palette hex strings to THREE.Color
  const colors = palette.map((hex) => new THREE.Color(hex));
  const bodyColor = colors[2] || new THREE.Color(0x888888);
  const bodySecondary = colors[3] || bodyColor.clone().offsetHSL(0, 0, 0.1);
  const outlineColor = colors[1] || new THREE.Color(0x222222);
  const highlightColor = colors[4] || bodyColor.clone().offsetHSL(0, 0, 0.2);
  const eyeWhite = colors[5] || new THREE.Color(0xffffff);
  const pupilColor = colors[6] || new THREE.Color(0x000000);
  const accentColor = colors[7] || new THREE.Color(0xff6644);

  // Materials — Toon shading with shared gradient map
  const gradientMap = createGradientMap(3);
  const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap });

  const bodyMat = toon(bodyColor);
  const bodySecMat = toon(bodySecondary);
  const outlineMat = toon(outlineColor);
  const highlightMat = toon(highlightColor);
  const eyeWhiteMat = toon(eyeWhite);
  const pupilMat = toon(pupilColor);
  const accentMat = toon(accentColor);

  // === Stage 0: Egg ===
  if (stage === 0) {
    const eggGeo = new THREE.SphereGeometry(0.5, 8, 6);
    eggGeo.scale(1, 1.3, 1);
    const egg = new THREE.Mesh(eggGeo, bodyMat);
    egg.position.y = 0.65;
    egg.castShadow = true;
    group.add(egg);

    // Spots on egg
    for (let i = 0; i < 3; i++) {
      const spotGeo = new THREE.SphereGeometry(0.08, 6, 4);
      const spot = new THREE.Mesh(spotGeo, bodySecMat);
      const angle = (i / 3) * Math.PI * 2 + 0.5;
      spot.position.set(
        Math.sin(angle) * 0.42,
        0.5 + i * 0.25,
        Math.cos(angle) * 0.42,
      );
      group.add(spot);
    }
    addOutlines(group, { thickness: 0.02 });
    return { group, parts: { egg } };
  }

  // === Creature body parts ===
  const {
    headRatio, bodyWidthRatio, roundness, topHeavy,
    eyeSize, eyeSpacing,
    hasEars, hasHorns, hasTail, hasWings, limbStage,
    neckWidth, legLength, armLength,
    tailLength, wingSize, earSize, hornSize,
    bodyTaper, asymmetry,
  } = params;

  // Subdivision level based on roundness
  const subdivW = Math.max(20, Math.floor(16 + roundness * 12)); // 20-28
  const subdivH = Math.max(14, Math.floor(10 + roundness * 10)); // 14-20

  // --- Body ---
  const bodyHeight = 0.8;
  const bodyWidth = bodyWidthRatio * 1.2;
  const bodyDepth = bodyWidth * 0.8;
  const bodyGeo = new THREE.SphereGeometry(0.5, subdivW, subdivH);

  // Apply taper: scale bottom narrower based on bodyTaper
  const positions = bodyGeo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    // y ranges from -0.5 to 0.5
    const normalizedY = (y + 0.5); // 0 at bottom, 1 at top
    let taperFactor;
    if (topHeavy > 0.5) {
      // Top-heavy: wider at top, narrower at bottom
      taperFactor = 1.0 - bodyTaper * 0.3 * (1 - normalizedY);
    } else {
      // Bottom-heavy: wider at bottom
      taperFactor = 1.0 - bodyTaper * 0.3 * normalizedY;
    }
    positions.setX(i, positions.getX(i) * taperFactor);
    positions.setZ(i, positions.getZ(i) * taperFactor);
  }
  bodyGeo.computeVertexNormals();
  bodyGeo.scale(bodyWidth, bodyHeight, bodyDepth);

  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = bodyHeight / 2 + legLength * 2;
  body.castShadow = true;
  group.add(body);

  const parts = { body };

  // --- Head ---
  const headRadius = headRatio * 1.0;
  const headGeo = new THREE.SphereGeometry(headRadius, subdivW, subdivH);
  const head = new THREE.Mesh(headGeo, bodyMat);
  const headY = body.position.y + bodyHeight / 2 + headRadius * 0.7;
  head.position.y = headY;
  head.castShadow = true;
  group.add(head);
  parts.head = head;

  // --- Eyes ---
  const eyeScale = eyeSize * 0.04;
  const eyeOffset = headRadius * eyeSpacing;
  const eyeY = headY + headRadius * 0.1;
  const eyeZ = headRadius * 0.85;

  const leftEye = createEye(eyeScale, eyeWhiteMat, pupilMat);
  leftEye.position.set(-eyeOffset, eyeY, eyeZ);
  group.add(leftEye);

  const rightEye = createEye(eyeScale, eyeWhiteMat, pupilMat);
  rightEye.position.set(eyeOffset, eyeY, eyeZ);
  group.add(rightEye);

  parts.leftEye = leftEye;
  parts.rightEye = rightEye;

  // --- Mouth ---
  const mouthGeo = new THREE.SphereGeometry(headRadius * 0.15, 6, 4);
  mouthGeo.scale(1.5, 0.5, 0.5);
  const mouth = new THREE.Mesh(mouthGeo, outlineMat);
  mouth.position.set(0, headY - headRadius * 0.35, headRadius * 0.9);
  group.add(mouth);

  // --- Neck (subtle connector) ---
  if (stage >= 2) {
    const neckGeo = new THREE.CylinderGeometry(
      headRadius * neckWidth * 0.4,
      bodyWidth * 0.3,
      headRadius * 0.5,
      6,
    );
    const neck = new THREE.Mesh(neckGeo, bodyMat);
    neck.position.y = body.position.y + bodyHeight / 2 + headRadius * 0.1;
    group.add(neck);
  }

  // --- Ears ---
  if (hasEars && stage >= 2) {
    const earH = earSize * 1.5;
    const earGeo = new THREE.ConeGeometry(earSize * 0.4, earH, 5);
    const leftEarMesh = new THREE.Mesh(earGeo, bodySecMat);
    leftEarMesh.position.set(-headRadius * 0.6, headY + headRadius * 0.7, 0);
    leftEarMesh.rotation.z = 0.3;
    leftEarMesh.castShadow = true;
    group.add(leftEarMesh);

    const rightEarMesh = new THREE.Mesh(earGeo.clone(), bodySecMat);
    rightEarMesh.position.set(headRadius * 0.6, headY + headRadius * 0.7, 0);
    rightEarMesh.rotation.z = -0.3;
    rightEarMesh.castShadow = true;
    group.add(rightEarMesh);

    parts.leftEar = leftEarMesh;
    parts.rightEar = rightEarMesh;
  }

  // --- Horns ---
  if (hasHorns && stage >= 3) {
    const hornH = hornSize * 2.0;
    const hornGeo = new THREE.ConeGeometry(hornSize * 0.15, hornH, 5);
    const hornMat = new THREE.MeshToonMaterial({
      color: highlightColor,
      gradientMap,
      emissive: highlightColor,
      emissiveIntensity: 0.15,
    });
    const leftHorn = new THREE.Mesh(hornGeo, hornMat);
    leftHorn.position.set(-headRadius * 0.4, headY + headRadius * 0.85, -headRadius * 0.1);
    leftHorn.rotation.z = 0.2;
    leftHorn.castShadow = true;
    group.add(leftHorn);

    const rightHorn = new THREE.Mesh(hornGeo.clone(), hornMat);
    rightHorn.position.set(headRadius * 0.4, headY + headRadius * 0.85, -headRadius * 0.1);
    rightHorn.rotation.z = -0.2;
    rightHorn.castShadow = true;
    group.add(rightHorn);
  }

  // --- Limbs ---
  if (limbStage >= 1) {
    const limbMat = stage >= 3 ? bodySecMat : bodyMat;
    const limbRadius = limbStage >= 3 ? 0.06 : 0.04;
    const jointRadius = limbStage >= 2 ? 0.05 : 0;

    // Arms
    if (limbStage >= 2) {
      const armH = armLength * 2.5;
      const leftArm = createLimb(limbRadius, armH, jointRadius, limbStage, limbMat, outlineMat);
      leftArm.position.set(-(bodyWidth / 2 + 0.05), body.position.y + bodyHeight * 0.2, 0);
      leftArm.rotation.z = 0.3;
      group.add(leftArm);

      const rightArm = createLimb(limbRadius, armH, jointRadius, limbStage, limbMat, outlineMat);
      rightArm.position.set(bodyWidth / 2 + 0.05, body.position.y + bodyHeight * 0.2, 0);
      rightArm.rotation.z = -0.3;
      group.add(rightArm);

      parts.leftArm = leftArm;
      parts.rightArm = rightArm;
    }

    // Legs
    const legH = legLength * 2.5;
    const leftLeg = createLimb(limbRadius * 1.2, legH, jointRadius, limbStage, limbMat, outlineMat);
    leftLeg.position.set(-(bodyWidth * 0.25), body.position.y - bodyHeight / 2 - 0.02, 0);
    group.add(leftLeg);

    const rightLeg = createLimb(limbRadius * 1.2, legH, jointRadius, limbStage, limbMat, outlineMat);
    rightLeg.position.set(bodyWidth * 0.25, body.position.y - bodyHeight / 2 - 0.02, 0);
    group.add(rightLeg);

    parts.leftLeg = leftLeg;
    parts.rightLeg = rightLeg;
  }

  // --- Tail ---
  if (hasTail && stage >= 2) {
    const tail = createTail(tailLength, bodyWidth, bodyMat, accentMat);
    tail.position.set(0, body.position.y - bodyHeight * 0.1, -(bodyDepth / 2 + 0.05));
    group.add(tail);
    parts.tail = tail;
  }

  // --- Wings ---
  if (hasWings && stage >= 4) {
    const wingGroup = createWings(wingSize, bodyHeight, bodySecMat, highlightMat);
    wingGroup.position.set(0, body.position.y + bodyHeight * 0.15, -(bodyDepth / 2 - 0.05));
    group.add(wingGroup);
    parts.wings = wingGroup;
  }

  addOutlines(group, { thickness: 0.025 });
  return { group, parts };
}

/**
 * Create an eye (white sphere + pupil sphere).
 */
function createEye(scale, whiteMat, pupilMat) {
  const eyeGroup = new THREE.Group();
  eyeGroup.name = "eye";

  const whiteGeo = new THREE.SphereGeometry(scale, 16, 12);
  const white = new THREE.Mesh(whiteGeo, whiteMat);
  eyeGroup.add(white);

  const pupilGeo = new THREE.SphereGeometry(scale * 0.55, 12, 8);
  const pupil = new THREE.Mesh(pupilGeo, pupilMat);
  pupil.position.z = scale * 0.5;
  eyeGroup.add(pupil);

  // Anime-style highlight sparkle (unlit, always bright for bloom)
  const highlightGeo = new THREE.SphereGeometry(scale * 0.2, 8, 6);
  const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const highlight = new THREE.Mesh(highlightGeo, highlightMat);
  highlight.position.set(scale * 0.25, scale * 0.2, scale * 0.7);
  highlight.name = "eye_highlight";
  eyeGroup.add(highlight);

  return eyeGroup;
}

/**
 * Create a limb (cylinder + optional joint sphere + optional endpoint).
 */
function createLimb(radius, height, jointRadius, limbStage, limbMat, endpointMat) {
  const limbGroup = new THREE.Group();
  limbGroup.name = "limb";

  const cylGeo = new THREE.CylinderGeometry(radius, radius, height, 12);
  const cyl = new THREE.Mesh(cylGeo, limbMat);
  cyl.position.y = -height / 2;
  limbGroup.add(cyl);

  // Joint
  if (limbStage >= 2 && jointRadius > 0) {
    const jointGeo = new THREE.SphereGeometry(jointRadius, 12, 8);
    const joint = new THREE.Mesh(jointGeo, limbMat);
    joint.position.y = -height * 0.5;
    limbGroup.add(joint);
  }

  // Endpoint (hand/foot)
  if (limbStage >= 3) {
    const endGeo = new THREE.SphereGeometry(radius * 1.5, 12, 8);
    const end = new THREE.Mesh(endGeo, endpointMat);
    end.position.y = -height;
    limbGroup.add(end);
  }

  return limbGroup;
}

/**
 * Create a tail using bezier-ish segments.
 */
function createTail(tailLength, bodyWidth, bodyMat, tipMat) {
  const tailGroup = new THREE.Group();
  tailGroup.name = "tail";

  const segments = 4;
  const segLen = tailLength * 2.0 / segments;

  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const radius = 0.05 * (1 - t * 0.5);
    const geo = new THREE.CylinderGeometry(radius, radius * 0.7, segLen, 12);
    const mat = i === segments - 1 ? tipMat : bodyMat;
    const seg = new THREE.Mesh(geo, mat);

    // Curve tail upward and slightly to the side
    const curveX = Math.sin(t * Math.PI * 0.5) * tailLength * 0.3;
    const curveY = Math.sin(t * Math.PI) * tailLength * 0.8;
    const curveZ = -(segLen * i);

    seg.position.set(curveX, curveY, curveZ);
    seg.rotation.x = -t * 0.5;
    seg.castShadow = true;
    tailGroup.add(seg);
  }

  return tailGroup;
}

/**
 * Create wing fan meshes.
 */
function createWings(wingSize, bodyHeight, wingMat, tipMat) {
  const wingGroup = new THREE.Group();
  wingGroup.name = "wings";

  const wingSpan = wingSize * 3;
  const wingH = wingSize * 2;

  // Left wing
  const leftWingGeo = createWingFanGeometry(wingSpan, wingH);
  const leftWing = new THREE.Mesh(leftWingGeo, wingMat);
  leftWing.position.set(-0.15, 0, 0);
  leftWing.rotation.y = -0.3;
  leftWing.castShadow = true;
  wingGroup.add(leftWing);

  // Right wing
  const rightWingGeo = createWingFanGeometry(wingSpan, wingH);
  const rightWing = new THREE.Mesh(rightWingGeo, wingMat);
  rightWing.position.set(0.15, 0, 0);
  rightWing.rotation.y = 0.3;
  rightWing.scale.x = -1;
  rightWing.castShadow = true;
  wingGroup.add(rightWing);

  wingGroup.userData.leftWing = leftWing;
  wingGroup.userData.rightWing = rightWing;

  return wingGroup;
}

/**
 * Create a simple fan-shaped geometry for a wing.
 */
function createWingFanGeometry(span, height) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(-span, height * 0.3);
  shape.lineTo(-span * 0.8, height);
  shape.lineTo(-span * 0.3, height * 0.7);
  shape.lineTo(0, 0);

  const geo = new THREE.ShapeGeometry(shape, 1);
  return geo;
}

/**
 * Remove existing creature from scene and dispose of geometries/materials.
 */
export function disposeCreature(scene) {
  const existing = scene.getObjectByName("creature");
  if (existing) {
    existing.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });
    scene.remove(existing);
  }
}
