import { describe, expect, it } from 'vitest';
import { Transport } from './transport';
import { TempoMap } from './tempoMap';

function make(opts: Partial<ConstructorParameters<typeof Transport>[0]> = {}) {
  let t = 0;
  const tr = new Transport({ tempo: 120, beatsPerBar: 4, lengthBeats: 16, now: () => t, ...opts });
  return { tr, advance: (s: number) => (t += s), time: () => t };
}

describe('Transport', () => {
  it('starts with a one-bar count-in', () => {
    const { tr } = make();
    expect(tr.startBeat).toBe(-4);
    tr.play();
    expect(tr.currentBeat()).toBe(-4);
  });

  it('advances at bpm * rate', () => {
    const { tr, advance } = make();
    tr.play(0);
    advance(1);
    expect(tr.currentBeat()).toBeCloseTo(2); // 120 bpm = 2 beats per second
    tr.setRate(0.5);
    advance(1);
    expect(tr.currentBeat()).toBeCloseTo(3);
  });

  it('maps beat to time and back', () => {
    const { tr, advance } = make();
    tr.play(0);
    advance(0.25);
    expect(tr.timeAt(4)).toBeCloseTo(2);
    expect(tr.beatAt(2)).toBeCloseTo(4);
  });

  it('pauses and resumes without drift', () => {
    const { tr, advance } = make();
    tr.play(0);
    advance(1);
    tr.pause();
    advance(5);
    expect(tr.currentBeat()).toBeCloseTo(2);
    tr.resume();
    advance(0.5);
    expect(tr.currentBeat()).toBeCloseTo(3);
  });

  it('wraps a loop exactly at the loop end', () => {
    const { tr, advance } = make();
    tr.setLoop({ startBar: 1, endBar: 2 }); // beats 4..8
    expect(tr.startBeat).toBe(0); // count-in bar before the loop
    tr.play(4);
    advance(2.25); // 4.5 beats later => beat 8.5 => wrapped to 4.5
    expect(tr.currentBeat()).toBeCloseTo(4.5);
    advance(2); // another 4 beats => 8.5 => 4.5 again
    expect(tr.currentBeat()).toBeCloseTo(4.5);
  });

  it('reports finish only without loop', () => {
    const { tr, advance } = make();
    tr.play(0);
    advance(7.9);
    expect(tr.isFinished()).toBe(false);
    advance(0.2);
    expect(tr.isFinished()).toBe(true);
  });

  it('follows tempo changes when converting time to beats', () => {
    let t = 0;
    const tr = new Transport({ tempo: new TempoMap([{ beat: 0, bpm: 120 }, { beat: 4, bpm: 60 }]), beatsPerBar: 4, lengthBeats: 16, now: () => t });
    tr.play(0);
    t = 2; // 4 beats at 120
    expect(tr.currentBeat()).toBeCloseTo(4);
    t = 4; // + 2 beats at 60
    expect(tr.currentBeat()).toBeCloseTo(6);
    expect(tr.currentBpm).toBe(60);
    expect(tr.timeAt(8)).toBeCloseTo(6);
    tr.setRate(2);
    t = 5; // 1 s at double speed = 2 beats at 60
    expect(tr.currentBeat()).toBeCloseTo(8);
  });
});
