const flashEl = () => document.getElementById("hatch-flash");
const loadingEl = () => document.getElementById("hatch-loading");

/** Show loading indicator during character generation */
export function showLoading() {
  const el = loadingEl();
  if (el) el.style.display = "flex";
}

/** Hide loading indicator */
export function hideLoading() {
  const el = loadingEl();
  if (el) el.style.display = "none";
}

/**
 * Play white flash transition.
 * Call swapCallback during the flash peak to swap models.
 * Returns a Promise that resolves when the full transition completes.
 */
export function playFlash(swapCallback) {
  return new Promise((resolve) => {
    const el = flashEl();
    if (!el) {
      if (swapCallback) swapCallback();
      resolve();
      return;
    }

    // Phase 1: Flash in (fast)
    el.style.transition = "opacity 0.15s ease-in";
    el.style.opacity = "1";

    setTimeout(() => {
      // Phase 2: At peak white — swap the model
      if (swapCallback) swapCallback();

      // Phase 3: Fade out (slow)
      el.style.transition = "opacity 0.8s ease-out";
      el.style.opacity = "0";

      setTimeout(() => {
        resolve();
      }, 850);
    }, 200);
  });
}

/**
 * Animate scale bounce-in for newly hatched character.
 * Scales from 0.5 → 1.1 → 1.0 over ~0.6s.
 */
export function bounceIn(group) {
  if (!group) return;
  group.scale.set(0.5, 0.5, 0.5);

  const duration = 600;
  const startTime = performance.now();

  function animate(now) {
    const elapsed = now - startTime;
    if (elapsed >= duration) {
      group.scale.set(1, 1, 1);
      return;
    }

    const t = elapsed / duration;
    // Overshoot ease: goes to 1.1 then settles to 1.0
    const scale = t < 0.7
      ? 0.5 + (0.6 / 0.7) * t       // 0.5 → 1.1 (first 70%)
      : 1.1 - (0.1 / 0.3) * (t - 0.7); // 1.1 → 1.0 (last 30%)

    group.scale.set(scale, scale, scale);
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}
