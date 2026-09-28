import type { Game } from '../game/game';
import type { Verdict } from '../game/judge';
import { t } from '../i18n/es';

export const LANE_COLORS = ['#ff5d5d', '#ffc857', '#4dd4ac', '#5da9ff', '#c77dff', '#ff9f43', '#7bed9f', '#f368e0'];

interface Flash {
  lane: number;
  verdict: Verdict;
  time: number;
}

export interface HighwayOptions {
  visibleSeconds: number;
}

/** Canvas renderer for the scrolling lanes. */
export class Highway {
  private ctx: CanvasRenderingContext2D;
  private flashes: Flash[] = [];
  private raf = 0;
  private w = 0;
  private h = 0;
  opts: HighwayOptions;

  constructor(
    private canvas: HTMLCanvasElement,
    private game: Game,
    opts: HighwayOptions,
  ) {
    this.opts = opts;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
  }

  private onResize() {
    this.resize();
  }

  private resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  flash(lane: number, verdict: Verdict) {
    this.flashes.push({ lane, verdict, time: performance.now() });
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

  private laneGeometry() {
    const lines = this.game.song.lines;
    const weights = lines.map((l) => (l.id === this.game.myLineId ? 1.7 : 1));
    const total = weights.reduce((a, b) => a + b, 0);
    const pad = 6;
    let x = pad;
    return lines.map((_, i) => {
      const width = ((this.w - pad * 2) * (weights[i] ?? 1)) / total;
      const g = { x, width, center: x + width / 2 };
      x += width;
      return g;
    });
  }

  private draw() {
    const { ctx, w, h, game } = this;
    const song = game.song;
    const tr = game.transport;
    const spb = tr.secondsPerBeat;
    // what the ear hears now is what was scheduled outputLatency ago
    const beatNow = tr.currentBeat() - game.engine.outputLatency / spb;
    const strikeY = h * 0.8;
    const pxPerBeat = (strikeY / this.opts.visibleSeconds) * spb;
    const yOf = (beat: number) => strikeY - (beat - beatNow) * pxPerBeat;
    const topBeat = beatNow + strikeY / pxPerBeat;
    const bottomBeat = beatNow - (h - strikeY) / pxPerBeat;
    const lanes = this.laneGeometry();
    const myLane = song.lines.findIndex((l) => l.id === game.myLineId);

    ctx.clearRect(0, 0, w, h);

    // lanes
    lanes.forEach((g, i) => {
      ctx.fillStyle = i === myLane ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.025)';
      ctx.fillRect(g.x, 0, g.width, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(g.x, 0);
      ctx.lineTo(g.x, h);
      ctx.stroke();
    });

    // beat and bar lines (with loop wrap)
    const drawGrid = (beat: number, y: number) => {
      const isBar = Math.abs(beat / song.beatsPerBar - Math.round(beat / song.beatsPerBar)) < 1e-6;
      ctx.strokeStyle = isBar ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = isBar ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      if (isBar && beat >= 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(String(Math.round(beat / song.beatsPerBar) + 1), 8, y - 4);
      }
    };
    this.forVisibleBeats(bottomBeat, topBeat, (beat, displayBeat) => {
      if (Number.isInteger(Math.round(beat * 1e6) / 1e6)) drawGrid(beat, yOf(displayBeat));
    });

    // loop boundary
    if (tr.loop) {
      ctx.strokeStyle = '#ffc857';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      for (const b of [tr.loopStartBeat, tr.loopEndBeat]) {
        const y = yOf(b);
        if (y > -2 && y < h + 2) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }

    // strike line
    ctx.strokeStyle = '#f5f5f5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, strikeY);
    ctx.lineTo(w, strikeY);
    ctx.stroke();

    // notes
    song.lines.forEach((line, li) => {
      const g = lanes[li]!;
      const color = LANE_COLORS[li % LANE_COLORS.length]!;
      const mine = li === myLane;
      const r = Math.min(g.width * 0.32, mine ? 22 : 14);
      const state = game.lineStates[line.id];
      line.notes.forEach((n, ni) => {
        const candidates = this.wrapCandidates(n.beat, bottomBeat - 1, topBeat + 1);
        for (const displayBeat of candidates) {
          const y = yOf(displayBeat);
          if (y < -r * 2 || y > h + r * 2) continue;
          let alpha = state === 'muted' ? 0.3 : 1;
          let fill = color;
          if (mine) {
            const res = game.judge.results[ni];
            if (res === 'miss') {
              fill = '#666';
              alpha = 0.6;
            } else if (res) {
              alpha = Math.max(0, 1 - (beatNow - n.beat) * 3);
            }
          }
          if (alpha <= 0) continue;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.arc(g.center, y, r, 0, Math.PI * 2);
          ctx.fill();
          if (mine) {
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      });
    });

    // flashes and verdict text
    const now = performance.now();
    this.flashes = this.flashes.filter((f) => now - f.time < 450);
    for (const f of this.flashes) {
      const age = (now - f.time) / 450;
      const g = lanes[f.lane]!;
      const col = f.verdict === 'perfect' ? '#4dd4ac' : f.verdict === 'good' ? '#ffc857' : '#ff5d5d';
      ctx.globalAlpha = 1 - age;
      ctx.strokeStyle = col;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(g.center, strikeY, 18 + age * 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t[f.verdict], g.center, strikeY - 40 - age * 30);
      ctx.globalAlpha = 1;
    }

    // count-in
    if (beatNow < 0 && tr.state === 'playing') {
      const n = Math.ceil(-beatNow);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 96px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(n), w / 2, h * 0.4);
    }

    // lane labels
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    lanes.forEach((g, i) => {
      ctx.fillStyle = i === myLane ? '#fff' : 'rgba(255,255,255,0.6)';
      ctx.fillText(song.lines[i]!.name, g.center, h - 10);
    });
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
