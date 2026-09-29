import { describe, expect, it } from 'vitest';
import { decodeTimeSignature, unrollClip, type AlsClip } from './unroll';

const note = (time: number, velocity = 100, pitch = 36, enabled = true) => ({ time, duration: 0.25, velocity, pitch, enabled });
const clip = (o: Partial<AlsClip>): AlsClip => ({ start: 0, end: 4, loopStart: 0, loopEnd: 1, startRelative: 0, loopOn: true, notes: [], ...o });

describe('unrollClip', () => {
  it('repeats a one-beat loop across the clip', () => {
    const c = clip({ start: 10, end: 14, notes: [note(0), note(0.5)] });
    expect(unrollClip(c, 'x').map((n) => n.beat)).toEqual([10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5]);
  });

  it('honours the start offset on the first pass only', () => {
    const c = clip({ start: 8, end: 12, loopEnd: 2, startRelative: 1.5, notes: [note(0), note(1), note(1.75)] });
    // first pass plays 1.5..2 (note 1.75 -> 8.25), then full loops from 8.5
    expect(unrollClip(c, 'x').map((n) => n.beat)).toEqual([8.25, 8.5, 9.5, 10.25, 10.5, 11.5]);
  });

  it('plays once when the loop is off and clips to the arrangement end', () => {
    const c = clip({ start: 0, end: 3, loopEnd: 9, loopOn: false, notes: [note(0), note(2.5), note(3.5)] });
    expect(unrollClip(c, 'x').map((n) => n.beat)).toEqual([0, 2.5]);
  });

  it('skips disabled notes and scales velocity', () => {
    const c = clip({ end: 1, notes: [note(0, 100), note(0.5, 100, 36, false)] });
    const out = unrollClip(c, 'x', 0.5);
    expect(out).toHaveLength(1);
    expect(out[0]!.velocity).toBeCloseTo(100 / 127 / 2);
    expect(out[0]!.pitch).toBe(36);
  });
});

describe('decodeTimeSignature', () => {
  it('decodes Ableton time signature codes', () => {
    expect(decodeTimeSignature(201)).toEqual({ numerator: 4, denominator: 4 });
    expect(decodeTimeSignature(200)).toEqual({ numerator: 3, denominator: 4 });
    expect(decodeTimeSignature(102)).toEqual({ numerator: 4, denominator: 2 });
  });
});
