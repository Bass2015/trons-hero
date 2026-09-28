import { describe, expect, it } from 'vitest';
import { Judge } from './judge';
import type { Note } from '../song/types';

const n = (beat: number): Note => ({ lineId: 'l', beat, durationBeats: 0.25, velocity: 1 });
const MS = 500; // 120 bpm

describe('Judge', () => {
  it('hits the nearest note inside the window and grades it', () => {
    const j = new Judge([n(0), n(1), n(2)]);
    expect(j.tap(1.02, MS)).toMatchObject({ index: 1, verdict: 'perfect' }); // 10 ms late
    expect(j.tap(2.15, MS)).toMatchObject({ index: 2, verdict: 'good' }); // 75 ms late
    expect(j.results).toEqual([undefined, 'perfect', 'good']);
  });

  it('ignores taps outside the window', () => {
    const j = new Judge([n(0), n(4)]);
    expect(j.tap(2, MS)).toBeNull();
    expect(j.tap(0.36, MS)).toBeNull(); // 180 ms late
    expect(j.results).toEqual([undefined, undefined]);
  });

  it('does not hit the same note twice', () => {
    const j = new Judge([n(1)]);
    expect(j.tap(1, MS)?.index).toBe(0);
    expect(j.tap(1.01, MS)).toBeNull();
  });

  it('expires notes that scrolled past the window', () => {
    const j = new Judge([n(0), n(1), n(2)]);
    expect(j.expire(1.1, MS)).toEqual([0]);
    expect(j.expire(1.4, MS)).toEqual([1]);
    expect(j.results).toEqual(['miss', 'miss', undefined]);
  });

  it('accepts an early tap for the first note of a loop while near the loop end', () => {
    const j = new Judge([n(4), n(6)]);
    const loop = { startBeat: 4, endBeat: 8 };
    expect(j.tap(7.8, MS, loop)).toMatchObject({ index: 0, verdict: 'good' }); // 100 ms early, wrapped
  });

  it('resets a beat range for the next loop pass', () => {
    const j = new Judge([n(0), n(4), n(6)]);
    j.tap(4, MS);
    j.tap(6, MS);
    j.resetRange(4, 8);
    expect(j.results).toEqual([undefined, undefined, undefined]);
  });
});
