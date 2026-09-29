import type { Game } from '../game/game';
import type { Verdict } from '../game/judge';
import { t } from '../i18n/index';
import type { Instrument } from '../song/instruments';
import { laneLines, type Line } from '../song/types';
import { Background } from './background';
import { laneOrder } from './laneOrder';

interface Flash {
  lane: number;
  verdict: Verdict;
  points: number;
  time: number;
}

export interface HighwayOptions {
  /** Seconds between the far end of the highway and the strike line. */
  visibleSeconds: number;
  /** Memory mode: do not draw notes. */
  hideNotes: boolean;
  /** Multiplier on the note pill size (1 = 70% of the lane width for the player's lane, 62% for others). */
  noteScale?: number;
}

const FONT = '"Barlow Condensed", system-ui, sans-serif';
const FLASH_MS = 550;

/**
 * Perspective highway: lanes converge to a vanishing point on the horizon,
 * notes are glowing pills that grow as they approach the strike line.
 */
export class Highway {
  private ctx: CanvasRenderingContext2D;
  private flashes: Flash[] = [];
  private raf = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private bg = new Background();
  private sprites = new Map<string, HTMLCanvasElement>();
  /** Lines that have a lane, in song order; `instruments` is parallel to this. */
  private lines: Line[];
  opts: HighwayOptions;

  constructor(
    private canvas: HTMLCanvasElement,
    private game: Game,
    private instruments: Instrument[],
    opts: HighwayOptions,
  ) {
    this.opts = opts;
    this.lines = laneLines(game.song);
    this.ctx = canvas.getContext('2d')!;
    this.onResize = this.onResize.bind(this);
    this.resize();
    window.addEventListener('resize', this.onResize);
  }

  private onResize() {
    this.resize();
  }

  private resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  flash(lane: number, verdict: Verdict, points = 0) {
    this.flashes.push({ lane, verdict, points, time: performance.now() });
  }

  start() {
    const loop = () => {
      this.game.update();
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
  }

  // --- geometry -------------------------------------------------------------

  private get horizonY() {
    return this.h * 0.2;
  }

  private get strikeY() {
    return this.h * 0.84;
  }

  /** Lane spans at the strike line (full width), indexed by line; the player's line sits in the middle. */
  private lanesAtStrike() {
    const n = this.instruments.length;
    const myLane = this.myLane;
    const order = laneOrder(n, myLane);
    const total = n - 1 + (myLane >= 0 ? 1.6 : 1);
    const out: { x0: number; x1: number; cx: number; w: number }[] = new Array(n);
    let x = 0;
    for (const li of order) {
      const w = (this.w * (li === myLane ? 1.6 : 1)) / total;
      out[li] = { x0: x, x1: x + w, cx: x + w / 2, w };
      x += w;
    }
    return out;
  }

  private get myLane() {
    return this.lines.findIndex((l) => l.id === this.game.myLineId);
  }

  /** Perspective scale for a depth in seconds ahead of the strike line. */
  private scale(d: number) {
    const K = (1 / 0.28 - 1) / this.opts.visibleSeconds; // far end of the visible window is 28% wide
    return 1 / (1 + Math.max(d, -0.35) * K);
  }

  private project(xAtStrike: number, d: number) {
    const s = this.scale(d);
    const cx = this.w / 2;
    return { x: cx + (xAtStrike - cx) * s, y: this.horizonY + (this.strikeY - this.horizonY) * s, s };
  }

  // --- drawing --------------------------------------------------------------

  private draw() {
    const { ctx, w, h, game } = this;
    const tr = game.transport;
    const spb = tr.secondsPerBeat;
    const beatNow = tr.currentBeat() - game.engine.outputLatency / spb;
    const lanes = this.lanesAtStrike();
    const myLane = this.myLane;
    const horizonY = this.horizonY;
    const strikeY = this.strikeY;
    const visibleBeats = this.opts.visibleSeconds / spb;
    const farBeat = beatNow + visibleBeats * 1.4;
    const nearBeat = beatNow - 0.35 / spb;

    this.bg.draw(ctx, w, h, horizonY, this.dpr);

    // lane fills: quads from the bottom edge to the vanishing point
    const cx = w / 2;
    lanes.forEach((l, i) => {
      const col = this.instruments[i]!.color;
      const grad = ctx.createLinearGradient(0, h, 0, horizonY);
      grad.addColorStop(0, hexA(col, i === myLane ? 0.32 : 0.16));
      grad.addColorStop(0.6, hexA(col, i === myLane ? 0.14 : 0.06));
      grad.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(l.x0, h);
      ctx.lineTo(l.x1, h);
      ctx.lineTo(cx, horizonY);
      ctx.closePath();
      ctx.fill();
    });

    // lane edges
    ctx.lineWidth = 1.5;
    for (const x of [0, ...lanes.map((l) => l.x1)]) {
      const grad = ctx.createLinearGradient(0, h, 0, horizonY);
      grad.addColorStop(0, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(cx, horizonY);
      ctx.stroke();
    }
    // player's lane edges glow in its colour
    if (myLane >= 0) {
      const l = lanes[myLane]!;
      const col = this.instruments[myLane]!.color;
      for (const [lw, a] of [[8, 0.12], [4, 0.25], [1.5, 0.9]] as [number, number][]) {
        ctx.lineWidth = lw;
        const grad = ctx.createLinearGradient(0, h, 0, horizonY);
        grad.addColorStop(0, hexA(col, a));
        grad.addColorStop(1, hexA(col, 0));
        ctx.strokeStyle = grad;
        for (const x of [l.x0, l.x1]) {
          ctx.beginPath();
          ctx.moveTo(x, h);
          ctx.lineTo(cx, horizonY);
          ctx.stroke();
        }
      }
    }

    // beat / bar lines
    this.forVisibleBeats(nearBeat, farBeat, (beat, displayBeat) => {
      const d = (displayBeat - beatNow) * spb;
      if (d > this.opts.visibleSeconds * 1.4) return;
      const isBar = Math.abs(beat / game.song.beatsPerBar - Math.round(beat / game.song.beatsPerBar)) < 1e-6;
      const a = this.project(0, d);
      const b = this.project(w, d);
      ctx.strokeStyle = isBar ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = isBar ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (isBar && beat >= 0 && a.s > 0.35) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = `700 ${Math.round(14 * a.s + 4)}px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.fillText(String(Math.round(beat / game.song.beatsPerBar) + 1), a.x + 6, a.y - 4);
      }
    });

    // loop boundaries
    if (tr.loop) {
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffd60a';
      for (const b of [tr.loopStartBeat, tr.loopEndBeat]) {
        const d = (b - beatNow) * spb;
        if (d < -0.35 || d > this.opts.visibleSeconds * 1.4) continue;
        const a = this.project(0, d);
        const c = this.project(w, d);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // strike bar
    const bar = ctx.createLinearGradient(0, 0, w, 0);
    bar.addColorStop(0, '#22d3ee');
    bar.addColorStop(0.5, '#ffffff');
    bar.addColorStop(1, '#ff2fb3');
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, strikeY - 8, w, 16);
    ctx.fillStyle = bar;
    ctx.fillRect(0, strikeY - 2, w, 4);

    // hit pads
    lanes.forEach((l, i) => {
      const col = this.instruments[i]!.color;
      const pw = l.w * 0.62;
      const ph = 12;
      ctx.fillStyle = hexA(col, i === myLane ? 0.95 : 0.55);
      roundRect(ctx, l.cx - pw / 2, strikeY - ph / 2, pw, ph, ph / 2);
      ctx.fill();
      if (i === myLane) {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // notes
    if (!this.opts.hideNotes) {
      this.lines.forEach((line, li) => {
        const l = lanes[li]!;
        const inst = this.instruments[li]!;
        const mine = li === myLane;
        const state = game.lineStates[line.id];
        const baseW = l.w * (mine ? 0.7 : 0.62) * (this.opts.noteScale ?? 1);
        line.notes.forEach((n, ni) => {
          for (const displayBeat of this.wrapCandidates(n.beat, nearBeat, farBeat)) {
            const d = (displayBeat - beatNow) * spb;
            if (d > this.opts.visibleSeconds * 1.35) continue;
            const p = this.project(l.cx, d);
            let alpha = state === 'muted' ? 0.35 : 1;
            let variant: 'normal' | 'mine' | 'miss' = mine ? 'mine' : 'normal';
            if (mine) {
              const res = game.judge.results[ni];
              if (res === 'miss') {
                variant = 'miss';
                alpha = 0.7;
              } else if (res === 'skip') {
                alpha = 0.35;
              } else if (res) {
                alpha = Math.max(0, 1 - (beatNow - n.beat) * spb * 4);
              }
            }
            // fade in at the far end
            alpha *= Math.min(1, Math.max(0, (this.opts.visibleSeconds * 1.35 - d) / (this.opts.visibleSeconds * 0.35)));
            if (alpha <= 0.01) continue;
            // dynamics: ghost notes small and faint, accents big and bright
            const dyn = n.velocity < 0.35 ? 0.72 : n.velocity > 0.85 ? 1.25 : 1;
            if (n.velocity < 0.35) alpha *= 0.65;
            const nw = baseW * p.s * dyn;
            const nh = nw * 0.42;
            const sprite = this.sprite(inst.color, variant);
            ctx.globalAlpha = alpha;
            // sprite has a glow margin equal to 50% of the pill size on each side
            ctx.drawImage(sprite, p.x - nw, p.y - nh, nw * 2, nh * 2);
            ctx.globalAlpha = 1;
          }
        });
      });
    }

    // flashes: ring on the pad and the verdict in the middle
    const now = performance.now();
    this.flashes = this.flashes.filter((f) => now - f.time < FLASH_MS);
    const latest = this.flashes[this.flashes.length - 1];
    for (const f of this.flashes) {
      const age = (now - f.time) / FLASH_MS;
      const l = lanes[f.lane]!;
      const col = f.verdict === 'perfect' ? '#22d3ee' : f.verdict === 'good' ? '#ffd60a' : '#ff2fb3';
      ctx.globalAlpha = 1 - age;
      ctx.strokeStyle = col;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(l.cx, strikeY, l.w * 0.3 + age * 40, 10 + age * 18, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (latest) {
      const age = (now - latest.time) / FLASH_MS;
      const col = latest.verdict === 'perfect' ? '#22d3ee' : latest.verdict === 'good' ? '#ffd60a' : '#ff2fb3';
      const y = h * 0.42 - age * 24;
      const size = latest.verdict === 'miss' ? 34 : 44;
      ctx.globalAlpha = Math.min(1, (1 - age) * 1.6);
      ctx.textAlign = 'center';
      ctx.font = `800 ${size}px ${FONT}`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(t[latest.verdict].toUpperCase(), w / 2, y);
      ctx.fillStyle = col;
      ctx.fillText(t[latest.verdict].toUpperCase(), w / 2, y);
      if (latest.points > 0) {
        ctx.font = `700 26px ${FONT}`;
        ctx.strokeText(`+${latest.points}`, w / 2, y + 30);
        ctx.fillStyle = '#fff';
        ctx.fillText(`+${latest.points}`, w / 2, y + 30);
      }
      ctx.globalAlpha = 1;
    }

    // count-in
    if (beatNow < 0 && tr.state === 'playing') {
      const n = Math.ceil(-beatNow);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = `800 110px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.strokeText(String(n), w / 2, h * 0.5);
      ctx.fillText(String(n), w / 2, h * 0.5);
    }
  }

  /** Pre-rendered glowing pill for a colour and variant, drawn at 2x its pill size to include the glow. */
  private sprite(color: string, variant: 'normal' | 'mine' | 'miss'): HTMLCanvasElement {
    const key = `${color}:${variant}`;
    let c = this.sprites.get(key);
    if (c) return c;
    const W = 160;
    const H = Math.round(W * 0.42);
    c = document.createElement('canvas');
    c.width = W * 2;
    c.height = H * 2;
    const g = c.getContext('2d')!;
    const col = variant === 'miss' ? '#6b6b75' : color;
    g.shadowColor = col;
    g.shadowBlur = variant === 'miss' ? 0 : W * 0.3;
    g.fillStyle = col;
    roundRect(g, W / 2, H / 2, W, H, H / 2);
    g.fill();
    g.fill();
    g.shadowBlur = 0;
    // top highlight
    const hl = g.createLinearGradient(0, H / 2, 0, H / 2 + H);
    hl.addColorStop(0, `rgba(255,255,255,${variant === 'mine' ? 0.75 : 0.45})`);
    hl.addColorStop(0.55, 'rgba(255,255,255,0)');
    g.fillStyle = hl;
    roundRect(g, W / 2 + 4, H / 2 + 3, W - 8, H - 6, (H - 6) / 2);
    g.fill();
    if (variant === 'mine') {
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 5;
      roundRect(g, W / 2, H / 2, W, H, H / 2);
      g.stroke();
    }
    this.sprites.set(key, c);
    return c;
  }

  /** Beats that appear in [from, to], accounting for the loop wrap. */
  private wrapCandidates(beat: number, from: number, to: number): number[] {
    const tr = this.game.transport;
    const out: number[] = [];
    if (beat >= from && beat <= to) out.push(beat);
    if (tr.loop) {
      const len = tr.loopEndBeat - tr.loopStartBeat;
      if (beat >= tr.loopStartBeat && beat < tr.loopEndBeat) {
        const shifted = beat + len;
        if (shifted >= from && shifted <= to) out.push(shifted);
      }
    }
    return out;
  }

  private forVisibleBeats(from: number, to: number, fn: (beat: number, displayBeat: number) => void) {
    const tr = this.game.transport;
    for (let b = Math.floor(from); b <= Math.ceil(to); b++) {
      if (b > this.game.song.lengthBeats) break;
      if (tr.loop && b > tr.loopEndBeat) {
        const len = tr.loopEndBeat - tr.loopStartBeat;
        fn(b - len, b);
      } else {
        fn(b, b);
      }
    }
  }
}

function hexA(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
