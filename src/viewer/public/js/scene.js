import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createGradientMap } from "./toon-utils.js";

/**
 * Creates the Three.js scene with camera, lights, and ground plane.
 * Returns { scene, camera, renderer } for the main loop.
 */
export function createScene(container) {
  const scene = new THREE.Scene();

  // Gradient background via NDC plane (replaces flat scene.background)
  const bgGeo = new THREE.PlaneGeometry(2, 2);
  const bgMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x2dd4a8) },
      bottomColor: { value: new THREE.Color(0xd0faf0) },
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

  // Camera
  const aspect = container.clientWidth / container.clientHeight;
  const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
  camera.position.set(0, 1.5, 5);
  camera.lookAt(0, 0.8, 0);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // Hemisphere light (bright sky / soft ground fill)
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xb0c4de, 1.0);
  hemiLight.position.set(0, 10, 0);
  scene.add(hemiLight);

  // Key light (warm, from upper-right-front)
  const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.0);
  keyLight.position.set(3, 5, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.005;
  keyLight.shadow.normalBias = 0.02;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 20;
  keyLight.shadow.camera.left = -3;
  keyLight.shadow.camera.right = 3;
  keyLight.shadow.camera.top = 3;
  keyLight.shadow.camera.bottom = -1;
  scene.add(keyLight);

  // Fill light (soft blue, from left)
  const fillLight = new THREE.DirectionalLight(0xc8d8f0, 0.5);
  fillLight.position.set(-3, 2, 2);
  scene.add(fillLight);

  // Rim light (back, subtle highlight)
  const rimLight = new THREE.DirectionalLight(0xe0e8ff, 0.4);
  rimLight.position.set(0, 3, -4);
  scene.add(rimLight);

  // Ground disc (solid pastel platform)
  const groundGeo = new THREE.CircleGeometry(2.5, 48);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x8ecfb0,
    roughness: 0.8,
    metalness: 0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  // Orbit controls (drag to rotate, scroll to zoom)
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.8, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.minDistance = 2;
  controls.maxDistance = 10;
  controls.maxPolarAngle = Math.PI * 0.85;
  controls.update();

  // Handle resize
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);

  return { scene, camera, renderer, controls };
}
