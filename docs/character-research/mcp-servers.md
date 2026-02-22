# Game Engine MCP Servers Survey

## Development-Time MCP Servers

These MCP servers can assist during Tomotoken 3D development but are NOT runtime dependencies.

### Blender MCP (Blender-MCP-Server)
- **Tools**: 51+ (mesh creation, material editing, animation, rendering)
- **Use case**: Prototype creature shapes, extract vertex data for reference
- **Value**: HIGH — can iterate on 3D designs interactively

### Unity MCP Variants
- **mcp-unity**: Official community server
- **unity-mcp**: Alternative implementation
- **Unity-MCP**: Third variant
- **Use case**: Reference for how game engines handle procedural characters
- **Value**: LOW — we're using Three.js, not Unity

### Unreal MCP
- **unreal-mcp** / **Unreal_mcp**: Unreal Engine integration
- **Use case**: Reference only
- **Value**: LOW

### Godot MCP
- **godot-mcp** / **Godot-MCP**: Godot Engine integration
- **Use case**: Reference only
- **Value**: LOW

### Asset Generation MCP
- **game-asset-mcp**: Generate game assets via AI
- **mcp-game-asset-gen**: Alternative asset generator
- **Use case**: Generate reference images for archetype designs
- **Value**: MEDIUM — useful for design iteration

### 3D Asset Processing MCP
- **3d-asset-processing-mcp**: Process and convert 3D assets
- **Use case**: Convert between 3D formats if needed
- **Value**: LOW — we generate procedurally, not from files

## Recommended for Tomotoken Development

1. **Blender MCP** — For prototyping creature proportions and testing visual appearance before translating to Three.js code
2. **game-asset-mcp** — For generating reference images of each archetype's visual style

## Not Recommended

Unity/Unreal/Godot MCPs are not relevant since Tomotoken uses Three.js in a WebView, not a game engine.
