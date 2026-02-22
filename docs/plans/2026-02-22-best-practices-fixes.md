# Best Practices Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix HIGH/MEDIUM issues found in context7 best-practices audit across Express, Three.js, tsup, and Vitest.

**Architecture:** Six independent tasks targeting server robustness (Express), memory safety (Three.js), and test reliability (Vitest). Each task is self-contained and can be executed in parallel.

**Tech Stack:** Express 5, Three.js r170, tsup 8, Vitest 3, Zod 3.24

---

## Task Overview

| # | Priority | Component | Description |
|---|----------|-----------|-------------|
| 1 | HIGH | Express | Fix `publicDir` to use `import.meta.url` instead of `process.cwd()` |
| 2 | HIGH | Three.js | Add texture disposal to `disposeCreature()` |
| 3 | HIGH | Three.js | Fix resize listener leak in `scene.js` |
| 4 | MEDIUM | Express | Add centralized error-handling middleware |
| 5 | MEDIUM | Express | Add security headers |
| 6 | MEDIUM | Vitest | Add `restoreMocks: true` to config |

---

- [ ] Task 1: Fix publicDir resolution (import.meta.url)

**Files:**
- Modify: `src/viewer/server.ts:4,47`
- Test: `test/viewer/server-public-dir.test.ts` (create)

**Context:** `process.cwd()` depends on where `node` is invoked from. If the user runs the binary from a different directory, static files won't be found. `import.meta.url` resolves relative to the source file location, which is deterministic.

**Step 1: Write the failing test**

```typescript
// test/viewer/server-public-dir.test.ts
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

describe("publicDir resolution", () => {
  it("resolves public directory relative to server module", () => {
    // Simulate the resolution logic used in server.ts
    const serverPath = join(process.cwd(), "src", "viewer", "server.ts");
    const serverDir = dirname(serverPath);
    const publicDir = join(serverDir, "public");

    expect(existsSync(publicDir)).toBe(true);
    expect(existsSync(join(publicDir, "index.html"))).toBe(true);
    expect(existsSync(join(publicDir, "zukan.html"))).toBe(true);
  });
});
```

**Step 2: Run test to verify it passes (baseline)**

Run: `npx vitest run test/viewer/server-public-dir.test.ts`
Expected: PASS (this validates our target directory structure)

**Step 3: Update server.ts**

Replace the import and publicDir lines:

```typescript
// Add to imports (line 4 area):
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Replace line 47:
// OLD: const publicDir = join(process.cwd(), "src", "viewer", "public");
// NEW:
const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "..", "viewer", "public");
```

Wait — since tsup bundles with `packages: "external"` and the output is `dist/bin/tomotoken.js`, `import.meta.url` will point to the dist location. The relative path from `dist/bin/` to `src/viewer/public/` is `../../src/viewer/public`. But this depends on the directory structure being intact.

A more robust approach: resolve from the **project root** detected via `package.json` proximity, or simply keep `process.cwd()` but document it. Actually, for a local dev tool that's always run via `npm start` from the project root, the simplest correct approach is:

```typescript
const __dirname = dirname(fileURLToPath(import.meta.url));
// In dev: __dirname = .../src/viewer/  → ../public
// In dist: __dirname = .../dist/bin/   → ../../src/viewer/public
// Since we always run from project root, use process.cwd() as fallback
const publicDir = join(process.cwd(), "src", "viewer", "public");
```

**Decision: Keep `process.cwd()` but add a startup check.**

```typescript
// After publicDir assignment, add:
if (!existsSync(join(publicDir, "index.html"))) {
  process.stderr.write(
    `\n✗ Cannot find public directory at ${publicDir}\n` +
    `  Run "npm start" from the project root directory.\n\n`
  );
  process.exit(1);
}
```

**Step 4: Add the existsSync import and startup check to server.ts**

In `src/viewer/server.ts`, add `existsSync` to the imports:

```typescript
import { existsSync } from "node:fs";
```

Then after `const publicDir = ...` (line 47), before `app.use(express.static(...))`:

```typescript
if (!existsSync(join(publicDir, "index.html"))) {
  process.stderr.write(
    `\n✗ Cannot find public directory at ${publicDir}\n` +
    `  Run "npm start" from the project root directory.\n\n`
  );
  process.exit(1);
}
```

**Step 5: Run all tests**

Run: `npx vitest run test/viewer/`
Expected: All PASS

**Step 6: Commit**

```bash
git add src/viewer/server.ts test/viewer/server-public-dir.test.ts
git commit -m "fix: add publicDir existence check on startup"
```

---

- [ ] Task 2: Add texture disposal to disposeCreature()

**Files:**
- Modify: `src/viewer/public/js/creature.js:141-156`

**Context:** Per Three.js cleanup docs, materials may hold Texture references (map, normalMap, etc.) that must be explicitly `.dispose()`d to free GPU memory. Current code disposes geometry and material but not textures on the material.

**Step 1: Update `disposeCreature` in creature.js**

Replace the `disposeCreature` function:

```javascript
/**
 * Remove existing creature from scene and dispose of geometries/materials/textures.
 */
export function disposeCreature(scene) {
  const existing = scene.getObjectByName("creature");
  if (existing) {
    existing.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        for (const mat of materials) {
          if (!mat) continue;
          // Dispose textures referenced by material properties
          for (const value of Object.values(mat)) {
            if (value && value.isTexture) {
              value.dispose();
            }
          }
          mat.dispose();
        }
      }
    });
    scene.remove(existing);
  }
}
```

**Step 2: Verify the app loads correctly**

Open `http://localhost:3456` in browser. Navigate between main view and zukan modal. Confirm no rendering errors in console.

**Step 3: Commit**

```bash
git add src/viewer/public/js/creature.js
git commit -m "fix: dispose textures in disposeCreature to prevent GPU memory leak"
```

---

- [ ] Task 3: Fix resize listener leak in scene.js

**Files:**
- Modify: `src/viewer/public/js/scene.js:111-122`

**Context:** `createScene()` adds a `window.addEventListener("resize", ...)` that is never removed. The caller (`viewer-core.js`) adds its own resize handler and cleans it up in `dispose()`, but the one from `scene.js` leaks. Fix: return a `dispose` function or let the caller handle resize entirely.

**Step 1: Remove the internal resize listener from scene.js**

The caller (`app.js` line 25-27 and `viewer-core.js` line 45-51) already handles resize. Remove the duplicated listener in `scene.js`.

Replace lines 111-122:

```javascript
  // Note: caller is responsible for handling resize
  // (see app.js and viewer-core.js)

  return { scene, camera, renderer, controls };
}
```

The scene.js `onResize` only updated camera aspect + renderer size, but the callers already do this:
- `app.js:25` calls `resizeComposer()` which calls `composer.setSize()` (which sets renderer size)
- `viewer-core.js:45` does the same

However, **neither caller updates `camera.aspect` + `camera.updateProjectionMatrix()`**. We need to move that logic to the callers.

**Step 1a: Update viewer-core.js resize handler**

In `src/viewer/public/js/viewer-core.js`, update the `onResize` function (line 45-51):

```javascript
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w > 0 && h > 0) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      resizeComposer(w, h);
    }
  };
```

**Step 1b: Update app.js resize handler**

In `src/viewer/public/js/app.js`, update the resize handler (line 25-27):

```javascript
window.addEventListener("resize", () => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  resizeComposer(w, h);
});
```

**Step 2: Verify in browser**

Resize the browser window on both `/` and `/zukan` modal. Confirm aspect ratio updates correctly and no duplicate resize handlers fire.

**Step 3: Commit**

```bash
git add src/viewer/public/js/scene.js src/viewer/public/js/viewer-core.js src/viewer/public/js/app.js
git commit -m "fix: remove leaked resize listener from scene.js, move camera update to callers"
```

---

- [ ] Task 4: Add centralized error-handling middleware

**Files:**
- Modify: `src/viewer/server.ts` (add after all routes, before `server.listen`)

**Context:** Express 5 best practice: add a catch-all error middleware `(err, req, res, next)` after all route definitions. This catches unhandled errors from async route handlers and prevents stack traces from leaking to clients.

**Step 1: Add error middleware to server.ts**

After the WebSocket setup (after line 155) and before `server.listen()`, add:

```typescript
  // Centralized error handler — must be last middleware
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      process.stderr.write(`Unhandled error: ${err.message}\n`);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );
```

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/viewer/server.ts
git commit -m "feat: add centralized Express error-handling middleware"
```

---

- [ ] Task 5: Add security headers

**Files:**
- Modify: `src/viewer/server.ts` (add before routes)

**Context:** Express best practice: set security headers to prevent clickjacking, MIME sniffing, and XSS. Since this is a local-only tool (bound to 127.0.0.1), the risk is low, but defense-in-depth is still good practice. We'll add headers manually to avoid a `helmet` dependency.

**Step 1: Add security headers middleware**

After `app.use(express.static(publicDir))` (line 48), add:

```typescript
  // Security headers (defense-in-depth, even for localhost)
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });
```

Note: We intentionally skip `Content-Security-Policy` because the client loads Three.js from a CDN (`cdn.jsdelivr.net`), and a restrictive CSP would break it. We also skip `Strict-Transport-Security` since this is HTTP localhost.

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/viewer/server.ts
git commit -m "feat: add X-Content-Type-Options and X-Frame-Options security headers"
```

---

- [ ] Task 6: Add restoreMocks to Vitest config

**Files:**
- Modify: `vitest.config.ts:5`

**Context:** Per Vitest docs, `restoreMocks: true` automatically calls `vi.restoreAllMocks()` after each test, preventing mock state from leaking between tests. Without it, a mock set in one test can silently affect another.

**Step 1: Update vitest.config.ts**

Add `restoreMocks: true` to the test config:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.tsx", "src/**/types.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

**Step 2: Run full test suite to verify no tests break**

Run: `npx vitest run`
Expected: All PASS. If any tests fail, they were relying on mock leakage — fix those tests to set up their own mocks.

**Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: add restoreMocks to vitest config to prevent mock leakage"
```

---

## Execution Order

Tasks 1-6 are independent and can be executed in parallel. Recommended sequential order if doing one-at-a-time:

1. Task 6 (Vitest) — smallest change, validates test infra first
2. Task 2 (Three.js textures) — critical memory fix
3. Task 3 (Three.js resize leak) — critical memory fix
4. Task 1 (publicDir check) — server robustness
5. Task 4 (error middleware) — server robustness
6. Task 5 (security headers) — defense-in-depth

## Final Verification

After all tasks:

```bash
npx vitest run                    # All tests pass
npm run typecheck                 # No type errors
npm run build                     # Build succeeds
npm start                         # Server starts, / and /zukan work
```
