type Canvas = string[][];
type Prng = () => number;

function deepCopy(canvas: Canvas): Canvas {
  return canvas.map((row) => [...row]);
}

function findNonEmpty(canvas: Canvas): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let y = 0; y < canvas.length; y++) {
    for (let x = 0; x < canvas[0].length; x++) {
      if (canvas[y][x] !== " ") points.push([y, x]);
    }
  }
  return points;
}

function blink(base: Canvas, _prng: Prng): Canvas {
  const frame = deepCopy(base);
  for (let y = 0; y < frame.length; y++) {
    for (let x = 0; x < frame[0].length; x++) {
      if (frame[y][x] === "o") frame[y][x] = "-";
    }
  }
  return frame;
}

function gesture(base: Canvas, prng: Prng): Canvas {
  const frame = deepCopy(base);
  const points = findNonEmpty(frame);
  if (points.length === 0) return frame;

  const edgeCount = Math.min(3, Math.floor(prng() * 3) + 1);
  for (let i = 0; i < edgeCount; i++) {
    const [y, x] = points[Math.floor(prng() * points.length)];
    const dir = prng() > 0.5 ? 1 : -1;
    const nx = x + dir;
    if (nx >= 0 && nx < frame[0].length && frame[y][nx] === " ") {
      frame[y][nx] = frame[y][x];
      frame[y][x] = " ";
    }
  }
  return frame;
}

function shimmer(base: Canvas, prng: Prng): Canvas {
  const frame = deepCopy(base);
  const points = findNonEmpty(frame);
  const shimmerChars = ".*~+";
  const count = Math.min(3, Math.floor(prng() * 3) + 1);

  for (let i = 0; i < count; i++) {
    if (points.length === 0) break;
    const [y, x] = points[Math.floor(prng() * points.length)];
    frame[y][x] = shimmerChars[Math.floor(prng() * shimmerChars.length)];
  }
  return frame;
}

export function generateFrames(base: Canvas, prng: Prng, _archetype: string): Canvas[] {
  return [
    deepCopy(base),
    blink(base, prng),
    gesture(base, prng),
    shimmer(base, prng),
  ];
}
