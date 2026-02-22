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
 * Normalizes by the maximum trait value so the dominant trait always
 * reaches the outer ring, making the shape clearly visible regardless
 * of absolute magnitudes.
 * @param {Record<string, number>} traits - 8 trait scores (0-100)
 * @param {number} radius - max radius in pixels
 * @returns {{ x: number, y: number }[]} 8 points relative to center
 */
export function computeRadarPoints(traits, radius) {
  const maxValue = Math.max(...TRAIT_KEYS.map((k) => traits[k] ?? 0), 1);
  return TRAIT_KEYS.map((key, i) => {
    const value = (traits[key] ?? 0) / maxValue;
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
  const radius = size * 0.24;

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
    ctx.strokeStyle = "rgba(60, 80, 120, 0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Axis lines
  for (let i = 0; i < TRAIT_KEYS.length; i++) {
    const angle = (Math.PI * 2 * i) / TRAIT_KEYS.length - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.strokeStyle = "rgba(60, 80, 120, 0.15)";
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
  ctx.fillStyle = "rgba(58, 123, 213, 0.18)";
  ctx.fill();
  ctx.strokeStyle = "rgba(58, 123, 213, 0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Data points
  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(cx + p.x, cy + p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(58, 123, 213, 0.9)";
    ctx.fill();
  });

  // Axis labels — smart alignment to prevent clipping
  const labelRadius = radius + 30;

  TRAIT_KEYS.forEach((key, i) => {
    const angle = (Math.PI * 2 * i) / TRAIT_KEYS.length - Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const lx = cx + cos * labelRadius;
    const ly = cy + sin * labelRadius;

    // Align text outward from chart center to avoid edge clipping
    if (cos > 0.25) ctx.textAlign = "left";
    else if (cos < -0.25) ctx.textAlign = "right";
    else ctx.textAlign = "center";

    if (sin > 0.25) ctx.textBaseline = "top";
    else if (sin < -0.3) ctx.textBaseline = "bottom";
    else ctx.textBaseline = "middle";

    const isActive = key === archetype;
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    ctx.font = isActive ? "bold 22px monospace" : "18px monospace";
    ctx.fillStyle = isActive ? "#3a7bd5" : "rgba(42, 58, 74, 0.7)";
    ctx.fillText(label, lx, ly);
  });
}
