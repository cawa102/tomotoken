/**
 * Controls random wobble animation for an egg group.
 * Wobble frequency increases as progress approaches 1.0.
 */
export class EggWobbleController {
  constructor(group, progress) {
    this._group = group;
    this._progress = Math.max(0, Math.min(progress, 1));
    this._timerId = null;
    this._animationFrameId = null;
    this._disposed = false;
    this._scheduleNext();
  }

  /** Delay range interpolated by progress: low progress = infrequent, high = frequent */
  getNextDelay() {
    const p = this._progress;
    const minDelay = 30000 - p * 27000; // 30s → 3s
    const maxDelay = 60000 - p * 52000; // 60s → 8s
    return minDelay + Math.random() * (maxDelay - minDelay);
  }

  /** Wobble amplitude in radians: increases slightly with progress */
  getAmplitude() {
    return 0.08 + this._progress * 0.06; // ~4.6° to ~8°
  }

  _scheduleNext() {
    if (this._disposed) return;
    this._timerId = setTimeout(() => this._startWobble(), this.getNextDelay());
  }

  _startWobble() {
    if (this._disposed) return;

    const amplitude = this.getAmplitude();
    const duration = 500; // ms
    const startTime = performance.now();
    const originalZ = this._group.rotation.z;

    const animate = (now) => {
      if (this._disposed) return;

      const elapsed = now - startTime;
      if (elapsed >= duration) {
        this._group.rotation.z = originalZ;
        this._scheduleNext();
        return;
      }

      // Damped sine oscillation: 2 full cycles with decay
      const t = elapsed / duration;
      const decay = 1 - t;
      this._group.rotation.z = originalZ + amplitude * Math.sin(t * Math.PI * 4) * decay;
      this._animationFrameId = requestAnimationFrame(animate);
    };

    this._animationFrameId = requestAnimationFrame(animate);
  }

  /** Update progress (e.g., when WebSocket sends new data) */
  updateProgress(progress) {
    this._progress = Math.max(0, Math.min(progress, 1));
  }

  /** Stop all wobble activity and clean up timers */
  dispose() {
    this._disposed = true;
    if (this._timerId != null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
    if (this._animationFrameId != null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
  }
}
