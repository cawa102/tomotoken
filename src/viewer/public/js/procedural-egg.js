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
  return (hash >>> 0) % 10000 / 10000;
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

// --- GLSL Shaders ---

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float seed;
  uniform float stage;

  varying vec2 vUv;
  varying vec3 vNormal;

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
    color = color * (ambient + diff * 0.55);

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
  const id = petId && petId.length > 0 ? petId : "default";
  const seed = hashString(id);
  const geometry = createEggGeometry();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      seed: { value: seed },
      stage: { value: Math.min(Math.max(stage || 0, 0), 3) },
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
