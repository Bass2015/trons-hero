import type { Note } from '../song/types';

export type Verdict = 'perfect' | 'good' | 'miss';
/** 'skip' marks notes that were behind the playhead when judging (re)started: neither hit nor miss. */
export type NoteResult = Verdict | 'skip';

export interface JudgeOptions {
  /** Half-width of the hit window in milliseconds. */
  windowMs: number;
  perfectMs: number;
}

export interface TapResult {
  index: number;
  verdict: Exclude<Verdict, 'miss'>;
  /** Positive = tapped late. */
  deltaMs: number;
}

export interface LoopBeats {
  startBeat: number;
  endBeat: number;
}

/**
 * Decides whether taps hit notes on a single lane. Pure: positions come in as
 * beats already corrected for calibration, together with the current ms per beat.
 */
export class Judge {
  readonly notes: Note[];
  readonly results: (NoteResult | undefined)[];
  opts: JudgeOptions;

  constructor(notes: Note[], opts: JudgeOptions = { windowMs: 170, perfectMs: 65 }) {
    this.notes = notes;
    this.results = new Array(notes.length).fill(undefined);
    this.opts = opts;
  }

  tap(beat: number, msPerBeat: number, loop?: LoopBeats): TapResult | null {
    const windowBeats = this.opts.windowMs / msPerBeat;
    let best: { index: number; delta: number } | null = null;
    for (let i = 0; i < this.notes.length; i++) {
      if (this.results[i]) continue;
      const nb = this.notes[i]!.beat;
      let delta = beat - nb;
      if (loop && nb >= loop.startBeat && nb < loop.endBeat) {
        const len = loop.endBeat - loop.startBeat;
        for (const alt of [delta - len, delta + len]) if (Math.abs(alt) < Math.abs(delta)) delta = alt;
      }
      if (Math.abs(delta) > windowBeats) continue;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { index: i, delta };
    }
    if (!best) return null;
    const deltaMs = best.delta * msPerBeat;
    const verdict = Math.abs(deltaMs) <= this.opts.perfectMs ? 'perfect' : 'good';
    this.results[best.index] = verdict;
    return { index: best.index, verdict, deltaMs };
  }

  /** Marks notes whose window has closed as missed. Returns their indexes. */
  expire(beat: number, msPerBeat: number): number[] {
    const windowBeats = this.opts.windowMs / msPerBeat;
    const missed: number[] = [];
    for (let i = 0; i < this.notes.length; i++) {
      if (this.results[i]) continue;
      if (this.notes[i]!.beat < beat - windowBeats) {
        this.results[i] = 'miss';
        missed.push(i);
      }
    }
    return missed;
  }

  /** Forgets results for notes in [fromBeat, toBeat), used when a loop wraps. */
  resetRange(fromBeat: number, toBeat: number) {
    for (let i = 0; i < this.notes.length; i++) {
      const b = this.notes[i]!.beat;
      if (b >= fromBeat && b < toBeat) this.results[i] = undefined;
    }
  }

  resetAll() {
    this.results.fill(undefined);
  }

  /** Marks every unjudged note before `beat` as skipped so it is not counted as a miss. */
  ignoreBefore(beat: number) {
    for (let i = 0; i < this.notes.length; i++) {
      if (!this.results[i] && this.notes[i]!.beat < beat) this.results[i] = 'skip';
    }
  }
}
