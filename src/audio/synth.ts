import type { SoundName } from '../song/types';

export type Player = (ctx: AudioContext, dest: AudioNode, time: number, velocity: number) => void;

const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();

function noise(ctx: AudioContext): AudioBuffer {
  let buf = noiseBuffers.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buf);
  }
  return buf;
}

function env(ctx: AudioContext, dest: AudioNode, time: number, peak: number, decay: number, attack = 0.002): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), time + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  g.connect(dest);
  return g;
}

function tone(ctx: AudioContext, dest: AudioNode, time: number, opts: { type?: OscillatorType; from: number; to: number; sweep: number; peak: number; decay: number }) {
  const osc = ctx.createOscillator();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.from, time);
  osc.frequency.exponentialRampToValueAtTime(opts.to, time + opts.sweep);
  const g = env(ctx, dest, time, opts.peak, opts.decay);
  osc.connect(g);
  osc.start(time);
  osc.stop(time + opts.decay + 0.05);
}

function burst(ctx: AudioContext, dest: AudioNode, time: number, opts: { filter: BiquadFilterType; freq: number; q?: number; peak: number; decay: number }) {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = opts.filter;
  f.frequency.value = opts.freq;
  f.Q.value = opts.q ?? 1;
  const g = env(ctx, dest, time, opts.peak, opts.decay);
  src.connect(f).connect(g);
  src.start(time);
  src.stop(time + opts.decay + 0.05);
}

const v = (velocity: number) => 0.35 + 0.65 * Math.min(1, Math.max(0, velocity));

export const SYNTHS: Record<SoundName, Player> = {
  surdo(ctx, dest, t, vel) {
    const a = v(vel);
    tone(ctx, dest, t, { from: 110, to: 52, sweep: 0.12, peak: 1.0 * a, decay: 0.7 });
    burst(ctx, dest, t, { filter: 'lowpass', freq: 400, peak: 0.5 * a, decay: 0.03 });
  },
  caixa(ctx, dest, t, vel) {
    const a = v(vel);
    burst(ctx, dest, t, { filter: 'bandpass', freq: 2500, q: 0.6, peak: 0.8 * a, decay: 0.16 });
    burst(ctx, dest, t, { filter: 'highpass', freq: 5000, peak: 0.4 * a, decay: 0.08 });
    tone(ctx, dest, t, { type: 'triangle', from: 220, to: 170, sweep: 0.05, peak: 0.35 * a, decay: 0.08 });
  },
  repinique(ctx, dest, t, vel) {
    const a = v(vel);
    tone(ctx, dest, t, { from: 420, to: 240, sweep: 0.08, peak: 0.7 * a, decay: 0.25 });
    burst(ctx, dest, t, { filter: 'highpass', freq: 3000, peak: 0.45 * a, decay: 0.06 });
  },
  agogo(ctx, dest, t, vel) {
    const a = v(vel);
    tone(ctx, dest, t, { from: 830, to: 820, sweep: 0.3, peak: 0.5 * a, decay: 0.35 });
    tone(ctx, dest, t, { from: 1245, to: 1230, sweep: 0.3, peak: 0.3 * a, decay: 0.25 });
  },
  tamborim(ctx, dest, t, vel) {
    const a = v(vel);
    tone(ctx, dest, t, { from: 700, to: 450, sweep: 0.04, peak: 0.6 * a, decay: 0.09 });
    burst(ctx, dest, t, { filter: 'highpass', freq: 4000, peak: 0.5 * a, decay: 0.03 });
  },
  chocalho(ctx, dest, t, vel) {
    const a = v(vel);
    burst(ctx, dest, t, { filter: 'highpass', freq: 6500, peak: 0.5 * a, decay: 0.09 });
  },
  generic(ctx, dest, t, vel) {
    const a = v(vel);
    tone(ctx, dest, t, { from: 240, to: 160, sweep: 0.06, peak: 0.7 * a, decay: 0.2 });
  },
};

export function click(ctx: AudioContext, dest: AudioNode, time: number, accent: boolean) {
  tone(ctx, dest, time, { from: accent ? 2000 : 1400, to: accent ? 1900 : 1350, sweep: 0.03, peak: accent ? 0.6 : 0.4, decay: 0.035 });
}

export function samplePlayer(buffer: AudioBuffer): Player {
  return (ctx, dest, time, velocity) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = v(velocity);
    src.connect(g).connect(dest);
    src.start(time);
  };
}
