/** Sunset sky, sun and a rooftop silhouette, rendered once per size to an offscreen canvas. */
export class Background {
  private cache: HTMLCanvasElement | null = null;
  private key = '';

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, horizonY: number, dpr: number) {
    const key = `${w}x${h}@${horizonY}@${dpr}`;
    if (this.key !== key || !this.cache) {
      this.cache = render(w, h, horizonY, dpr);
      this.key = key;
    }
    ctx.drawImage(this.cache, 0, 0, w, h);
  }
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function render(w: number, h: number, horizonY: number, dpr: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);

  // sky
  const sky = g.createLinearGradient(0, 0, 0, horizonY * 1.15);
  sky.addColorStop(0, '#12081f');
  sky.addColorStop(0.45, '#4a1046');
  sky.addColorStop(0.8, '#b8267a');
  sky.addColorStop(1, '#ff8c1a');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  // sun
  const sunR = w * 0.16;
  const sunY = horizonY * 0.95;
  const sun = g.createRadialGradient(w * 0.5, sunY, sunR * 0.2, w * 0.5, sunY, sunR);
  sun.addColorStop(0, '#fff1a8');
  sun.addColorStop(0.6, '#ffd60a');
  sun.addColorStop(1, 'rgba(255,140,26,0)');
  g.fillStyle = sun;
  g.beginPath();
  g.arc(w * 0.5, sunY, sunR, 0, Math.PI * 2);
  g.fill();

  // soft brand glows in the corners
  for (const [x, col] of [
    [0.08, 'rgba(34,211,238,0.35)'],
    [0.92, 'rgba(255,47,179,0.35)'],
  ] as [number, string][]) {
    const r = w * 0.35;
    const gl = g.createRadialGradient(w * x, horizonY * 0.4, 0, w * x, horizonY * 0.4, r);
    gl.addColorStop(0, col);
    gl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gl;
    g.fillRect(0, 0, w, horizonY * 1.2);
  }

  // skyline: two layers of buildings
  const rnd = mulberry32(2024);
  const layer = (color: string, minH: number, maxH: number, minW: number, maxW: number) => {
    g.fillStyle = color;
    let x = -10;
    while (x < w + 10) {
      const bw = minW + rnd() * (maxW - minW);
      const bh = minH + rnd() * (maxH - minH);
      g.fillRect(x, horizonY - bh, bw + 1, bh + 2);
      // antenna or water tank
      if (rnd() < 0.3) {
        g.fillRect(x + bw / 2 - 1, horizonY - bh - 10 - rnd() * 14, 2, 14);
      }
      x += bw;
    }
  };
  layer('#2a1236', 10, horizonY * 0.45, 14, 40);
  layer('#120a18', 6, horizonY * 0.3, 10, 30);

  // ground
  g.fillStyle = '#0b0b10';
  g.fillRect(0, horizonY, w, h - horizonY);
  // haze at the horizon so the highway fades in
  const haze = g.createLinearGradient(0, horizonY, 0, horizonY + h * 0.18);
  haze.addColorStop(0, 'rgba(255,140,26,0.35)');
  haze.addColorStop(1, 'rgba(11,11,16,0)');
  g.fillStyle = haze;
  g.fillRect(0, horizonY, w, h * 0.18);

  return c;
}
