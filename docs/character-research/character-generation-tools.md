# Character Generation Tools Comparison

## 3D Character Generation

### Three.js (Selected)
- **Type**: WebGL library
- **Node.js**: Yes (via headless WebGL or browser WebView)
- **Deterministic**: Yes (procedural geometry from params)
- **Bundle**: ~200KB gzip (tree-shaken)
- **Pros**: Full control, procedural generation, runs in WebView
- **Cons**: Manual mesh construction required

### Ready Player Me
- **Type**: SaaS API for 3D avatars
- **Node.js**: REST API
- **Deterministic**: No (cloud-generated)
- **Pros**: High-quality humanoid avatars
- **Cons**: Requires network, not deterministic, humanoid only

### MakeHuman
- **Type**: Desktop app for humanoid modeling
- **Node.js**: No native integration
- **Deterministic**: Yes (if scripted)
- **Pros**: Detailed humanoid models
- **Cons**: Not suitable for stylized creatures, heavy

### Babylon.js
- **Type**: WebGL engine
- **Node.js**: Yes (headless or WebView)
- **Deterministic**: Yes
- **Bundle**: ~500KB gzip
- **Pros**: Full game engine features
- **Cons**: Heavier than Three.js, overkill for pet display

## 2D Character Generation (Reference)

### DiceBear
- **Type**: SVG avatar generator
- **Node.js**: Yes
- **Deterministic**: Yes (seed-based)
- **Pros**: Simple, many styles
- **Cons**: 2D only, fixed art styles

### pixel-sprite-generator
- **Type**: Procedural pixel sprite
- **Node.js**: Yes
- **Deterministic**: Yes (seed-based)
- **Pros**: Retro aesthetic
- **Cons**: Very simple, limited variety

## AI-Based Generation (Not Suitable)

### Stable Diffusion + ControlNet
- Requires GPU, not deterministic across runs
- Would violate "no AI calls" design constraint

### Hugging Face Models
- Same issues: GPU requirement, non-deterministic

## Decision: Three.js

Three.js is the clear choice because:
1. **Deterministic**: Same params → same mesh (no randomness beyond PRNG)
2. **Lightweight**: ~200KB after tree-shaking
3. **WebView compatible**: Runs in Tauri WebView natively
4. **Procedural**: Perfect for generating creatures from 25 parameters
5. **No network**: Fully local, matching design principles
6. **Ecosystem**: Extensive documentation, large community
7. **Animation**: Built-in animation system with bones/skinning
