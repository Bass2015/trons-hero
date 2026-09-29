import type { AudioEngine } from '../audio/engine';
import type { Line, Song } from '../song/types';
import { Judge, type TapResult, type Verdict } from './judge';
import { presetStates, type LineState, type Mode } from './modes';
import { Scheduler } from './scheduler';
import { Score } from './score';
import { Transport, type LoopRange } from './transport';
import { TempoMap } from './tempoMap';

export type Hand = 'left' | 'right';

export interface HitEvent {
  verdict: Verdict;
  hand?: Hand;
  deltaMs?: number;
  noteIndex: number;
  points: number;
}

export interface GameOptions {
  offsetMs: number;
  metronome: boolean;
  rate: number;
  mode: Mode;
}

/** Wires transport, scheduler, judge and score for one song and one player line. */
export class Game {
  readonly transport: Transport;
  readonly scheduler: Scheduler;
  judge: Judge;
  readonly score = new Score();
  myLine: Line;
  myLineId: string;
  mode: Mode;
  offsetMs: number;
  lineStates: Record<string, LineState>;
  private lastPassBeat = -Infinity;
  onHit: (e: HitEvent) => void = () => {};
  onFinish: () => void = () => {};

  constructor(
    readonly engine: AudioEngine,
    readonly song: Song,
    myLineId: string,
    opts: GameOptions,
  ) {
    const line = song.lines.find((l) => l.id === myLineId);
    if (!line) throw new Error(`Línea desconocida: ${myLineId}`);
    this.myLine = line;
    this.myLineId = myLineId;
    this.mode = opts.mode;
    this.offsetMs = opts.offsetMs;
    this.transport = new Transport({ tempo: new TempoMap(song.tempos ?? song.bpm), beatsPerBar: song.beatsPerBar, lengthBeats: song.lengthBeats, now: () => engine.now });
    this.transport.setRate(opts.rate);
    this.judge = new Judge(line.notes);
    this.lineStates = presetStates(opts.mode, song.lines.map((l) => l.id), myLineId);
    this.scheduler = new Scheduler(engine, this.transport, song, (id) => this.lineStates[id] ?? 'auto');
    this.scheduler.metronome = opts.metronome;
    this.applyMutes();
  }

  get isPlaying() {
    return this.transport.state === 'playing';
  }

  /** Starts from the count-in, or from `fromBeat` (notes before it are skipped, not missed). */
  start(fromBeat?: number) {
    this.judge.resetAll();
    this.score.reset();
    if (fromBeat === undefined) {
      this.transport.play();
    } else {
      this.transport.play(fromBeat);
      this.judge.ignoreBefore(fromBeat);
    }
    this.lastPassBeat = this.transport.currentBeat();
    this.scheduler.start();
  }

  pause() {
    this.transport.pause();
    this.scheduler.stop();
  }

  resume() {
    this.transport.resume();
    this.lastPassBeat = this.transport.currentBeat();
    this.scheduler.start();
  }

  /** Jumps to a beat. Notes before it are skipped, not missed. Sound stays off while paused. */
  seek(beat: number) {
    const playing = this.isPlaying;
    this.scheduler.stop();
    this.transport.seek(beat);
    this.judge.resetAll();
    this.judge.ignoreBefore(beat);
    this.lastPassBeat = beat;
    if (playing) this.scheduler.start();
  }

  /** Switches the player's line in place: new judge, fresh score, same position and state. */
  setMyLine(lineId: string) {
    const line = this.song.lines.find((l) => l.id === lineId);
    if (!line || lineId === this.myLineId) return;
    this.myLine = line;
    this.myLineId = lineId;
    this.judge = new Judge(line.notes);
    this.judge.ignoreBefore(this.transport.currentBeat());
    this.score.reset();
    this.setMode(this.mode);
  }

  stop() {
    this.scheduler.stop();
    this.transport.stop();
  }

  setRate(rate: number) {
    this.transport.setRate(rate);
    this.scheduler.resync();
  }

  setLoop(loop: LoopRange | null) {
    const wasPlaying = this.isPlaying;
    this.scheduler.stop();
    this.transport.setLoop(loop);
    this.judge.resetAll();
    // notes already behind the playhead must not be counted as misses
    this.judge.ignoreBefore(this.transport.currentBeat());
    if (wasPlaying) {
      this.lastPassBeat = this.transport.currentBeat();
      this.scheduler.start();
    }
  }

  setMode(mode: Mode) {
    this.mode = mode;
    this.lineStates = presetStates(mode, this.song.lines.map((l) => l.id), this.myLineId);
    this.applyMutes();
  }

  /** Flips a single line between sounding and silent, on top of the mode preset. */
  toggleLine(lineId: string) {
    const cur = this.lineStates[lineId];
    if (cur === 'me') this.lineStates[lineId] = 'auto';
    else if (cur === 'auto') this.lineStates[lineId] = lineId === this.myLineId ? 'me' : 'muted';
    else this.lineStates[lineId] = 'auto';
    this.applyMutes();
  }

  setMetronome(on: boolean) {
    this.scheduler.metronome = on;
    this.engine.setClickEnabled(on);
  }

  private applyMutes() {
    for (const l of this.song.lines) this.engine.setLineMuted(l.id, this.lineStates[l.id] !== 'auto');
  }

  tap(hand: Hand): TapResult | null {
    this.engine.playTap(this.myLineId);
    if (!this.isPlaying) return null;
    const t = this.transport;
    const beat = t.currentBeat() - this.offsetMs / t.msPerBeat;
    const loop = t.loop ? { startBeat: t.loopStartBeat, endBeat: t.loopEndBeat } : undefined;
    const result = this.judge.tap(beat, t.msPerBeat, loop);
    if (result) {
      const points = this.score.add(result.verdict);
      this.onHit({ verdict: result.verdict, hand, deltaMs: result.deltaMs, noteIndex: result.index, points });
    }
    return result;
  }

  /** Call once per frame. Handles misses, loop wraps and the end of the song. */
  update() {
    if (!this.isPlaying) return;
    const t = this.transport;
    const beat = t.currentBeat();
    if (t.loop && beat < this.lastPassBeat - 1) {
      // wrapped: forget results inside the loop so the next pass is judged fresh
      this.judge.resetRange(t.loopStartBeat + 0.5, t.loopEndBeat);
    }
    this.lastPassBeat = beat;
    for (const i of this.judge.expire(beat - this.offsetMs / t.msPerBeat, t.msPerBeat)) {
      this.score.add('miss');
      this.onHit({ verdict: 'miss', noteIndex: i, points: 0 });
    }
    if (t.isFinished()) {
      this.stop();
      this.onFinish();
    }
  }
}
