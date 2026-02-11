import { useState, useEffect } from "react";

export function useAnimation(frameCount: number, fps: number, enabled: boolean): number {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!enabled || frameCount <= 1) return;
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % frameCount);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [frameCount, fps, enabled]);

  return frame;
}
