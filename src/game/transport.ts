import { TempoMap } from './tempoMap';

export interface LoopRange {
  /** First beat of the loop, inclusive. */
  startBeat: number;
  /** Beat where the loop wraps, exclusive. */
  endBeat: number;
}

export type TransportState = 'stopped' | 'playing' | 'paused';

/**
 * Song clock. Maps an audio-context time to a position in beats and back.
 * All position math lives here so the scheduler, renderer and judge agree.
 */
export class Transport {
  readonly map: TempoMap;
  beatsPerBar: number;
  lengthBeats: number;
  /** Playback rate multiplier, 1 = song tempo. */
  private _rate = 1;
  /** Beats of click before beat 0. */
  countInBeats: number;
  loop: LoopRange | null = null;
  state: TransportState = 'stopped';

  private anchorTime = 0;
  private anchorBeat = 0;
  private pausedBeat = 0;
  private readonly now: () => number;

  constructor(opts: { tempo: TempoMap | number; beatsPerBar: number; lengthBeats: number; now: () => number; countInBars?: number }) {
    this.map = opts.tempo instanceof TempoMap ? opts.tempo : new TempoMap(opts.tempo);
    this.beatsPerBar = opts.beatsPerBar;
    this.lengthBeats = opts.lengthBeats;
    this.now = opts.now;
    this.countInBeats = (opts.countInBars ?? 1) * opts.beatsPerBar;
  }

  get rate() {
    return this._rate;
  }

  /** Tempo of the song (before the rate) at the start. */
  get bpm() {
    return this.map.initialBpm;
  }

  /** Position without loop handling, used for local tempo lookups. */
  private rawBeat() {
    return this.state === 'playing' ? this.beatAt(this.now()) : this.pausedBeat;
  }

  /** Song tempo at the current position, before the rate. */
  get currentBpm() {
    return this.map.bpmAt(this.rawBeat());
  }

  /** Seconds per beat at the current position and rate. */
  get secondsPerBeat() {
    return 60 / (this.currentBpm * this._rate);
  }

  get msPerBeat() {
    return this.secondsPerBeat * 1000;
  }

  /** Seconds between two beats at the current rate, following tempo changes. */
  secondsBetween(from: number, to: number) {
    return this.map.secondsBetween(from, to) / this._rate;
  }

  /** Beat reached `seconds` after `from` at the current rate. */
  beatAfter(from: number, seconds: number) {
    return this.map.beatAfter(from, seconds * this._rate);
  }

  get loopStartBeat() {
    return this.loop ? this.loop.startBeat : 0;
  }

  get loopEndBeat() {
    return this.loop ? this.loop.endBeat : this.lengthBeats;
  }

  /** Where playback begins: the count-in before the song or before the loop. */
  get startBeat() {
    return this.loopStartBeat - this.countInBeats;
  }

  /** Raw mapping, ignoring loop wrap. */
  beatAt(time: number): number {
    if (this.state === 'playing') return this.beatAfter(this.anchorBeat, time - this.anchorTime);
    return this.pausedBeat;
  }

  timeAt(beat: number): number {
    return this.anchorTime + this.secondsBetween(this.anchorBeat, beat);
  }

  /**
   * Current position in beats. When looping and the end has passed, the clock
   * re-anchors at the loop start with no drift.
   */
  currentBeat(): number {
    const t = this.now();
    if (this.state !== 'playing') return this.pausedBeat;
    let beat = this.beatAt(t);
    if (this.loop) {
      const end = this.loopEndBeat;
      let guard = 0;
      while (beat >= end && guard++ < 1000) {
        this.anchorTime = this.timeAt(end);
        this.anchorBeat = this.loopStartBeat;
        beat = this.beatAt(t);
      }
    }
    return beat;
  }

  play(fromBeat = this.startBeat) {
    this.anchorTime = this.now();
    this.anchorBeat = fromBeat;
    this.state = 'playing';
  }

  pause() {
    if (this.state !== 'playing') return;
    this.pausedBeat = this.currentBeat();
    this.state = 'paused';
  }

  resume() {
    if (this.state !== 'paused') return;
    this.play(this.pausedBeat);
  }

  stop() {
    this.state = 'stopped';
    this.pausedBeat = this.startBeat;
  }

  /** Moves the playhead. Keeps playing if it was playing. */
  seek(beat: number) {
    if (this.state === 'playing') {
      this.anchorTime = this.now();
      this.anchorBeat = beat;
    } else {
      this.pausedBeat = beat;
    }
  }

  /** Changes speed without moving the current position. */
  setRate(rate: number) {
    const beat = this.currentBeat();
    this._rate = rate;
    if (this.state === 'playing') {
      this.anchorTime = this.now();
      this.anchorBeat = beat;
    }
  }

  setLoop(loop: LoopRange | null) {
    this.loop = loop;
    if (this.state === 'playing') {
      const beat = this.currentBeat();
      if (loop && (beat < this.loopStartBeat - this.countInBeats || beat >= this.loopEndBeat)) this.play(this.startBeat);
    } else {
      this.pausedBeat = this.startBeat;
    }
  }

  /** True when playback has run past the end of the song (not looping). */
  isFinished(): boolean {
    return !this.loop && this.state === 'playing' && this.currentBeat() >= this.lengthBeats;
  }
}
