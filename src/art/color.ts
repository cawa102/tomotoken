import chalk from "chalk";

type Canvas = string[][];

const ARCHETYPE_PALETTE: Record<string, number[]> = {
  builder: [208, 214, 220, 178, 136],
  fixer: [196, 160, 124, 88, 52],
  refiner: [141, 177, 213, 147, 183],
  scholar: [39, 75, 111, 33, 69],
  scribe: [114, 150, 186, 78, 42],
  architect: [226, 220, 184, 148, 190],
  operator: [247, 250, 253, 244, 241],
  guardian: [30, 66, 102, 138, 24],
};

export function colorize(canvas: Canvas, archetype: string, _traits: Record<string, number>, progress: number, prng: () => number): string[] {
  const palette = ARCHETYPE_PALETTE[archetype] ?? ARCHETYPE_PALETTE["builder"];
  return canvas.map((row) =>
    row
      .map((ch) => {
        if (ch === " ") return " ";
        if (ch === "o" || ch === "-") return chalk.ansi256(255)(ch);
        if (ch === ".") return chalk.ansi256(palette[4])(ch);
        const idx = Math.floor(prng() * 3);
        return chalk.ansi256(palette[idx])(ch);
      })
      .join(""),
  );
}

export function colorizeFrames(frames: Canvas[], archetype: string, traits: Record<string, number>, progress: number, prng: () => number): string[][] {
  return frames.map((frame) => colorize(frame, archetype, traits, progress, prng));
}
