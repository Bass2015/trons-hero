import type { Line, Song } from '../song/types';
import { SYNTHS, click, samplePlayer, type Player } from './synth';

/**
 * Owns the AudioContext and the gain graph: master -> per-line gains and a click gain.
 */
export class AudioEngine {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly clickGain: GainNode;
  private readonly tapGain: GainNode;
  private lineGains = new Map<string, GainNode>();
  private players = new Map<string, Player>();
  /** Mixer level per line id, 0..1; unset means 1. Survives `loadSong` so it can be set before the song loads. */
  private volumes = new Map<string, number>();
  private muted = new Set<string>();

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.clickGain = this.ctx.createGain();
    this.clickGain.gain.value = 0.7;
    this.clickGain.connect(this.master);
    this.tapGain = this.ctx.createGain();
    this.tapGain.connect(this.master);
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
    g.gain.value = this.levelOf(line.id);
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
    if (muted) this.muted.add(lineId);
    else this.muted.delete(lineId);
    this.applyGain(lineId);
  }

  /** Mixer level for a line, 0..1. Composes with mute: a muted line stays silent whatever its level. */
  setLineVolume(lineId: string, volume: number) {
    this.volumes.set(lineId, Math.min(1, Math.max(0, volume)));
    this.applyGain(lineId);
  }

  private levelOf(lineId: string) {
    return this.muted.has(lineId) ? 0 : this.volumes.get(lineId) ?? 1;
  }

  private applyGain(lineId: string) {
    const g = this.lineGains.get(lineId);
    if (g) g.gain.setTargetAtTime(this.levelOf(lineId), this.ctx.currentTime, 0.005);
  }

  playNote(lineId: string, time: number, velocity: number) {
    const g = this.lineGains.get(lineId);
    const p = this.players.get(lineId);
    if (!g || !p) return;
    p(this.ctx, g, Math.max(time, this.ctx.currentTime), velocity);
  }

  /** Plays the line's sound right now regardless of its mute state (used for taps), at the line's mixer level. */
  playTap(lineId: string) {
    const p = this.players.get(lineId);
    if (!p) return;
    this.tapGain.gain.setValueAtTime(this.volumes.get(lineId) ?? 1, this.ctx.currentTime);
    p(this.ctx, this.tapGain, this.ctx.currentTime, 1);
  }

  playClick(time: number, accent: boolean) {
    click(this.ctx, this.clickGain, Math.max(time, this.ctx.currentTime), accent);
  }

  setClickEnabled(on: boolean) {
    this.clickGain.gain.setTargetAtTime(on ? 0.7 : 0, this.ctx.currentTime, 0.005);
  }
}
