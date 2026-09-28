import type { Line, Song } from '../song/types';
import { SYNTHS, click, samplePlayer, type Player } from './synth';

/**
 * Owns the AudioContext and the gain graph: master -> per-line gains and a click gain.
 */
export class AudioEngine {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly clickGain: GainNode;
  private lineGains = new Map<string, GainNode>();
  private players = new Map<string, Player>();

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.clickGain = this.ctx.createGain();
    this.clickGain.gain.value = 0.7;
    this.clickGain.connect(this.master);
  }

  /** Must be called from a user gesture on iOS. */
  async unlock() {
    if (this.ctx.state !== 'running') await this.ctx.resume();
    // A silent buffer nudges iOS into actually starting the hardware clock.
    const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.start();
  }

  get now() {
    return this.ctx.currentTime;
  }

  /** Output latency the browser reports, in seconds; used to align visuals with sound. */
  get outputLatency() {
    return (this.ctx as AudioContext & { outputLatency?: number }).outputLatency ?? this.ctx.baseLatency ?? 0;
  }

  async loadSong(song: Song) {
    this.lineGains.forEach((g) => g.disconnect());
    this.lineGains.clear();
    this.players.clear();
    await Promise.all(song.lines.map((l) => this.prepareLine(l, song.baseUrl)));
  }

  private async prepareLine(line: Line, baseUrl: string) {
    const g = this.ctx.createGain();
    g.connect(this.master);
    this.lineGains.set(line.id, g);
    let player: Player = SYNTHS[line.sound] ?? SYNTHS.generic;
    if (line.sample) {
      try {
        const res = await fetch(baseUrl + line.sample);
        const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        player = samplePlayer(buf);
      } catch (e) {
        console.warn(`No se pudo cargar la muestra ${line.sample}, usando sintetizador`, e);
      }
    }
    this.players.set(line.id, player);
  }

  setLineMuted(lineId: string, muted: boolean) {
    const g = this.lineGains.get(lineId);
    if (g) g.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.005);
  }

  playNote(lineId: string, time: number, velocity: number) {
    const g = this.lineGains.get(lineId);
    const p = this.players.get(lineId);
    if (!g || !p) return;
    p(this.ctx, g, Math.max(time, this.ctx.currentTime), velocity);
  }

  /** Plays the line's sound right now regardless of its mute state (used for taps). */
  playTap(lineId: string) {
    const p = this.players.get(lineId);
    if (!p) return;
    p(this.ctx, this.master, this.ctx.currentTime, 1);
  }

  playClick(time: number, accent: boolean) {
    click(this.ctx, this.clickGain, Math.max(time, this.ctx.currentTime), accent);
  }

  setClickEnabled(on: boolean) {
    this.clickGain.gain.setTargetAtTime(on ? 0.7 : 0, this.ctx.currentTime, 0.005);
  }
}
