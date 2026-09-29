import { describe, expect, it } from 'vitest';
import { TempoMap } from './tempoMap';

describe('TempoMap', () => {
  it('behaves like a constant tempo with one point', () => {
    const m = new TempoMap(120);
    expect(m.secondsBetween(0, 4)).toBeCloseTo(2);
    expect(m.beatAfter(0, 2)).toBeCloseTo(4);
    expect(m.beatAfter(4, -1)).toBeCloseTo(2);
    expect(m.bpmAt(-4)).toBe(120);
  });

  it('integrates across tempo changes', () => {
    // 120 bpm for beats 0..8, then 60 bpm
    const m = new TempoMap([{ beat: 0, bpm: 120 }, { beat: 8, bpm: 60 }]);
    expect(m.bpmAt(7.9)).toBe(120);
    expect(m.bpmAt(8)).toBe(60);
    expect(m.secondsBetween(0, 8)).toBeCloseTo(4);
    expect(m.secondsBetween(0, 12)).toBeCloseTo(8);
    expect(m.secondsBetween(6, 10)).toBeCloseTo(1 + 2);
    expect(m.beatAfter(0, 8)).toBeCloseTo(12);
    expect(m.beatAfter(6, 3)).toBeCloseTo(10);
    expect(m.beatAfter(10, -3)).toBeCloseTo(6);
    // round trip
    for (const b of [0, 3.3, 8, 9.5, 20]) expect(m.beatAfter(0, m.secondsBetween(0, b))).toBeCloseTo(b);
  });

  it('applies the first tempo to the count-in before beat 0', () => {
    const m = new TempoMap([{ beat: 0, bpm: 120 }, { beat: 4, bpm: 240 }]);
    expect(m.secondsBetween(-4, 0)).toBeCloseTo(2);
    expect(m.beatAfter(-4, 2)).toBeCloseTo(0);
  });
});
