// test/viewer/anim-mixer.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  CLIP_NAMES,
  createAnimMixer,
} from "../../src/viewer/public/js/anim-mixer.js";

function makeClip(name: string, duration = 1): THREE.AnimationClip {
  const track = new THREE.NumberKeyframeTrack(".position[0]", [0, duration], [0, 1]);
  return new THREE.AnimationClip(name, duration, [track]);
}

describe("anim-mixer", () => {
  it("exports standard CLIP_NAMES", () => {
    expect(CLIP_NAMES).toEqual(["idle", "blink", "walk", "jump", "wave"]);
  });

  it("creates mixer and plays idle clip if available", () => {
    const group = new THREE.Group();
    const clips = [makeClip("idle"), makeClip("blink")];

    const { mixer, actions } = createAnimMixer(group, clips);

    expect(mixer).toBeInstanceOf(THREE.AnimationMixer);
    expect(Object.keys(actions)).toHaveLength(2);
    expect(actions["idle"]).toBeDefined();
    expect(actions["blink"]).toBeDefined();

    // idle action should be playing
    expect(actions["idle"].isRunning()).toBe(true);
    expect(actions["idle"].loop).toBe(THREE.LoopRepeat);
  });

  it("does not auto-play when idle clip is absent", () => {
    const group = new THREE.Group();
    const clips = [makeClip("walk"), makeClip("jump")];

    const { actions } = createAnimMixer(group, clips);

    expect(actions["walk"]).toBeDefined();
    expect(actions["jump"]).toBeDefined();
    expect(actions["walk"].isRunning()).toBe(false);
    expect(actions["jump"].isRunning()).toBe(false);
  });

  it("returns empty actions when no clips provided", () => {
    const group = new THREE.Group();

    const { mixer, actions } = createAnimMixer(group, []);

    expect(mixer).toBeInstanceOf(THREE.AnimationMixer);
    expect(Object.keys(actions)).toHaveLength(0);
  });

  it("creates actions for all provided clips", () => {
    const group = new THREE.Group();
    const clips = [
      makeClip("idle"),
      makeClip("blink"),
      makeClip("walk"),
      makeClip("jump"),
      makeClip("wave"),
    ];

    const { actions } = createAnimMixer(group, clips);

    expect(Object.keys(actions)).toHaveLength(5);
    CLIP_NAMES.forEach((name) => {
      expect(actions[name]).toBeDefined();
    });
  });

  it("mixer can be updated with a delta time", () => {
    const group = new THREE.Group();
    const clips = [makeClip("idle")];

    const { mixer } = createAnimMixer(group, clips);

    // Should not throw
    expect(() => mixer.update(0.016)).not.toThrow();
  });
});
