/**
 * Radar chart renderer for archetype trait visualization.
 * Uses Canvas 2D to draw an 8-axis spider chart.
 */

const TRAIT_KEYS = [
  "builder", "fixer", "refiner", "scholar",
  "scribe", "architect", "operator", "guardian",
];

/**
 * Compute polygon vertices from trait values.
 * @param {Record<string, number>} traits - 8 trait scores (0-100)
 * @param {number} radius - max radius in pixels
 * @returns {{ x: number, y: number }[]} 8 points relative to center
 */
export function computeRadarPoints(traits, radius) {
  return TRAIT_KEYS.map((key, i) => {
    const value = (traits[key] ?? 0) / 100;
    const angle = (Math.PI * 2 * i) / TRAIT_KEYS.length - Math.PI / 2;
    return {
      x: Math.cos(angle) * radius * value,
      y: Math.sin(angle) * radius * value,
    };
  });
}

/**
 * Render radar chart onto a canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {Record<string, number>} traits - 8 trait scores (0-100)
 * @param {string} archetype - dominant archetype name to highlight
 */
export function renderRadarChart(canvas, traits, archetype) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;

  ctx.clearRect(0, 0, size, size);

  // Grid lines (3 concentric octagons)
  for (let ring = 1; ring <= 3; ring++) {
    const r = (radius * ring) / 3;
    ctx.beginPath();
    for (let i = 0; i <= TRAIT_KEYS.length; i++) {
      const angle = (Math.PI * 2 * i) / TRAIT_KEYS.length - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(100, 100, 160, 0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Axis lines
  for (let i = 0; i < TRAIT_KEYS.length; i++) {
    const angle = (Math.PI * 2 * i) / TRAIT_KEYS.length - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.strokeStyle = "rgba(100, 100, 160, 0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Data polygon
  const points = computeRadarPoints(traits, radius);
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = cx + p.x;
    const y = cy + p.y;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(79, 172, 254, 0.2)";
  ctx.fill();
  ctx.strokeStyle = "rgba(79, 172, 254, 0.8)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Data points (small dots)
  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(cx + p.x, cy + p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(79, 172, 254, 0.9)";
    ctx.fill();
  });

  // Axis labels
  const labelRadius = radius + 16;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  TRAIT_KEYS.forEach((key, i) => {
    const angle = (Math.PI * 2 * i) / TRAIT_KEYS.length - Math.PI / 2;
    const lx = cx + Math.cos(angle) * labelRadius;
    const ly = cy + Math.sin(angle) * labelRadius;

    const isActive = key === archetype;
    ctx.font = isActive ? "bold 10px monospace" : "9px monospace";
    ctx.fillStyle = isActive ? "#7ecfff" : "rgba(200, 200, 220, 0.6)";
    ctx.fillText(key, lx, ly);
  });
}
