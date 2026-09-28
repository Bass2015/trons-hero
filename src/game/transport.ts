export interface LoopRange {
  /** First bar of the loop, 0-based, inclusive. */
  startBar: number;
  /** Bar after the last looped bar, exclusive. */
  endBar: number;
}

export type TransportState = 'stopped' | 'playing' | 'paused';

/**
 * Song clock. Maps an audio-context time to a position in beats and back.
 * All position math lives here so the scheduler, renderer and judge agree.
 */
export class Transport {
  bpm: number;
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

  constructor(opts: { bpm: number; beatsPerBar: number; lengthBeats: number; now: () => number; countInBars?: number }) {
    this.bpm = opts.bpm;
    this.beatsPerBar = opts.beatsPerBar;
    this.lengthBeats = opts.lengthBeats;
    this.now = opts.now;
    this.countInBeats = (opts.countInBars ?? 1) * opts.beatsPerBar;
  }

  get rate() {
    return this._rate;
  }

  /** Seconds per beat at the current rate. */
  get secondsPerBeat() {
    return 60 / (this.bpm * this._rate);
  }

  get msPerBeat() {
    return this.secondsPerBeat * 1000;
  }

  get loopStartBeat() {
    return this.loop ? this.loop.startBar * this.beatsPerBar : 0;
  }

  get loopEndBeat() {
    return this.loop ? this.loop.endBar * this.beatsPerBar : this.lengthBeats;
  }

  /** Where playback begins: the count-in before the song or before the loop. */
  get startBeat() {
    return this.loopStartBeat - this.countInBeats;
  }

  /** Raw mapping, ignoring loop wrap. */
  beatAt(time: number): number {
    if (this.state === 'playing') return this.anchorBeat + (time - this.anchorTime) / this.secondsPerBeat;
    return this.pausedBeat;
  }

  timeAt(beat: number): number {
    return this.anchorTime + (beat - this.anchorBeat) * this.secondsPerBeat;
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
      const len = end - this.loopStartBeat;
      while (beat >= end) {
        this.anchorTime = this.timeAt(end);
        this.anchorBeat = this.loopStartBeat;
        beat -= len;
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
