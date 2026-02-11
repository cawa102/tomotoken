import React from "react";
import { Text } from "ink";

interface Props {
  consumed: number;
  required: number;
  width?: number;
}

export function ProgressBar({ consumed, required, width = 30 }: Props) {
  const pct = Math.min(1, consumed / required);
  const filled = Math.round(pct * width);
  const empty = width - filled;
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
  const label = `${Math.round(pct * 100)}% (${consumed.toLocaleString()}/${required.toLocaleString()})`;

  return <Text>[{bar}] {label}</Text>;
}
