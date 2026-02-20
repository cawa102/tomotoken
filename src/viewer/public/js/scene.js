import * as THREE from "three";
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

  // Hemisphere light (replaces ambient for natural sky/ground fill)
  const hemiLight = new THREE.HemisphereLight(0xffeeff, 0x8888cc, 0.8);
  hemiLight.position.set(0, 10, 0);
  scene.add(hemiLight);

  // Key light (warm, from upper-right-front)
  const keyLight = new THREE.DirectionalLight(0xffeedd, 1.2);
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

  // Fill light (cool, from left)
  const fillLight = new THREE.DirectionalLight(0x8888cc, 0.4);
  fillLight.position.set(-3, 2, 2);
  scene.add(fillLight);

  // Rim light (back)
  const rimLight = new THREE.DirectionalLight(0xaaccff, 0.5);
  rimLight.position.set(0, 3, -4);
  scene.add(rimLight);

  // Ground plane
  const groundGeo = new THREE.CircleGeometry(3, 32);
  const groundMat = new THREE.MeshToonMaterial({
    color: 0x252540,
    gradientMap: createGradientMap(2),
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  // Handle resize
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);

  return { scene, camera, renderer };
}
