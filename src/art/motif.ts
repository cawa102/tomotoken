type Canvas = string[][];
type Prng = () => number;

const ARCHETYPE_MOTIFS: Record<string, string[]> = {
  builder: ["#", "=", "[]"],
  fixer: ["/", "\\", "x"],
  refiner: ["*", "~", "^"],
  scholar: ["?", "!", ";"],
  scribe: ['"', "'", "_"],
  architect: ["|", "-", "+"],
  operator: ["%", "&", "@"],
  guardian: ["[", "]", "#"],
};

export function applyMotifs(canvas: Canvas, archetype: string, _traits: Record<string, number>, prng: Prng, progress: number): Canvas {
  const result = canvas.map((row) => [...row]);
  const motifs = ARCHETYPE_MOTIFS[archetype] ?? ARCHETYPE_MOTIFS["builder"];
  const intensity = progress * 0.15;

  for (let y = 0; y < result.length; y++) {
    for (let x = 0; x < result[0].length; x++) {
      if (result[y][x] !== " " && result[y][x] !== "." && prng() < intensity) {
        result[y][x] = motifs[Math.floor(prng() * motifs.length)];
      }
    }
  }

  return result;
}
