/** A tempo change: from `beat` onwards the song runs at `bpm`, until the next entry. */
export interface TempoPoint {
  beat: number;
  bpm: number;
}

/**
 * Piecewise-constant tempo map. Converts between beats and seconds at rate 1;
 * callers divide seconds by the playback rate.
 */
export class TempoMap {
  readonly points: TempoPoint[];

  constructor(points: TempoPoint[] | number) {
    const list = typeof points === 'number' ? [{ beat: 0, bpm: points }] : [...points].sort((a, b) => a.beat - b.beat);
    if (!list.length) throw new Error('empty tempo map');
    // the first tempo also applies before its beat (count-in)
    this.points = list.map((p, i) => (i === 0 ? { beat: -Infinity, bpm: p.bpm } : p));
  }

  get initialBpm() {
    return this.points[0]!.bpm;
  }

  bpmAt(beat: number): number {
    let bpm = this.points[0]!.bpm;
    for (const p of this.points) {
      if (p.beat <= beat) bpm = p.bpm;
      else break;
    }
    return bpm;
  }

  /** Seconds elapsed while going from beat `from` to beat `to` (negative when to < from). */
  secondsBetween(from: number, to: number): number {
    if (to < from) return -this.secondsBetween(to, from);
    let t = 0;
    let cursor = from;
    for (let i = 0; i < this.points.length && cursor < to; i++) {
      const start = Math.max(this.points[i]!.beat, cursor);
      const end = Math.min(i + 1 < this.points.length ? this.points[i + 1]!.beat : Infinity, to);
      if (end > start) {
        t += ((end - start) * 60) / this.points[i]!.bpm;
        cursor = end;
      }
    }
    return t;
  }

  /** Beat reached `seconds` after beat `from` (seconds may be negative). */
  beatAfter(from: number, seconds: number): number {
    if (seconds < 0) {
      // walk backwards: tempo before `from` is what matters
      let left = -seconds;
      let cursor = from;
      for (let i = this.points.length - 1; i >= 0 && left > 0; i--) {
        const p = this.points[i]!;
        if (p.beat >= cursor) continue;
        const spb = 60 / p.bpm;
        const available = (cursor - Math.max(p.beat, -Infinity)) * spb;
        if (!Number.isFinite(available) || available >= left) return cursor - left / spb;
        left -= available;
        cursor = p.beat;
      }
      return cursor - left / (60 / this.points[0]!.bpm);
    }
    let left = seconds;
    let cursor = from;
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i]!;
      const next = i + 1 < this.points.length ? this.points[i + 1]!.beat : Infinity;
      if (next <= cursor) continue;
      const spb = 60 / p.bpm;
      const available = (next - cursor) * spb;
      if (available >= left) return cursor + left / spb;
      left -= available;
      cursor = next;
    }
    return cursor;
  }
}
