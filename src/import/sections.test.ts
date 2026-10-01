import { describe, expect, it } from 'vitest';
import { buildSections } from './sections';

const L = (time: number, name: string) => ({ time, name });

describe('buildSections', () => {
  it('builds parts that end at the next part and inserts from NAME … /NAME pairs', () => {
    const out = buildSections(
      [L(4, 'Start'), L(8, 'INTRO'), L(29, 'TAKITE 9'), L(38, '/TAKITE 9'), L(56, 'TALL 01'), L(64, 'TAKITE 4'), L(68, '/TAKITE 4'), L(80, 'TALL 02')],
      { startBeat: 4, endBeat: 100 },
    );
    expect(out).toEqual([
      { name: 'INTRO', startBeat: 4, endBeat: 52, kind: 'part' },
      { name: 'TAKITE 9', startBeat: 25, endBeat: 34, kind: 'insert' },
      { name: 'TALL 01', startBeat: 52, endBeat: 76, kind: 'part' },
      { name: 'TAKITE 4', startBeat: 60, endBeat: 64, kind: 'insert' },
      { name: 'TALL 02', startBeat: 76, endBeat: 96, kind: 'part' },
    ]);
  });

  it('pairs repeated names with their nearest closer and ignores stray closers', () => {
    const out = buildSections([L(0, 'A'), L(2, 'X'), L(4, '/X'), L(6, 'X'), L(9, '/X'), L(12, '/Y')], { startBeat: 0, endBeat: 16 });
    expect(out.map((s) => [s.name, s.startBeat, s.endBeat, s.kind])).toEqual([
      ['A', 0, 16, 'part'],
      ['X', 2, 4, 'insert'],
      ['X', 6, 9, 'insert'],
    ]);
  });

  it('drops ignored names and locators outside the song', () => {
    const out = buildSections([L(0, 'Start'), L(2, '_cue'), L(4, 'A'), L(40, 'B'), L(60, 'C')], { startBeat: 0, endBeat: 50 });
    expect(out.map((s) => [s.name, s.startBeat, s.endBeat])).toEqual([
      ['A', 4, 40],
      ['B', 40, 50],
    ]);
  });

  it('accepts a custom ignore pattern', () => {
    const out = buildSections([L(0, 'Start'), L(4, 'silenci raro')], { startBeat: 0, endBeat: 8, ignore: /silenci/i });
    expect(out.map((s) => s.name)).toEqual(['Start']);
  });
});
