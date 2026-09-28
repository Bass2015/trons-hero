import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { midiToNotes } from './midi';
import { buildSong } from './loader';
import type { SongSpec } from './types';

const bytes = new Uint8Array(readFileSync(new URL('../../public/songs/batucada/batucada.mid', import.meta.url)));
const spec = JSON.parse(readFileSync(new URL('../../public/songs/batucada/song.json', import.meta.url), 'utf8')) as SongSpec;

describe('midiToNotes', () => {
  it('reads tempo and time signature', () => {
    const parsed = midiToNotes(bytes, 'x');
    expect(parsed.bpm).toBeCloseTo(120);
    expect(parsed.beatsPerBar).toBe(4);
  });

  it('takes every note when no pitch filter is given', () => {
    expect(midiToNotes(bytes, 'x').notes).toHaveLength(84);
  });

  it('filters by pitch and converts ticks to beats', () => {
    const surdo = midiToNotes(bytes, 'surdo', [47]).notes;
    const caixa = midiToNotes(bytes, 'caixa', [56]).notes;
    expect(surdo).toHaveLength(42);
    expect(caixa).toHaveLength(42);
    expect(surdo.every((n) => n.lineId === 'surdo')).toBe(true);
    expect(surdo[0]!.beat).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < surdo.length; i++) expect(surdo[i]!.beat).toBeGreaterThanOrEqual(surdo[i - 1]!.beat);
    // 7 bars of 4/4 at most
    expect(Math.max(...surdo.map((n) => n.beat))).toBeLessThan(28.5);
  });
});

describe('buildSong', () => {
  it('assembles lines from song.json and rounds the length to whole bars', async () => {
    const song = await buildSong('batucada', spec, '/songs/batucada/', async () => bytes);
    expect(song.bpm).toBe(120);
    expect(song.beatsPerBar).toBe(4);
    expect(song.lines.map((l) => l.id)).toEqual(['surdo', 'caixa']);
    expect(song.lines[0]!.notes).toHaveLength(42);
    expect(song.lengthBeats % 4).toBe(0);
    expect(song.lengthBeats).toBeGreaterThanOrEqual(28);
  });

  it('lets song.json override the tempo', async () => {
    const song = await buildSong('b', { ...spec, bpm: 90 }, '/', async () => bytes);
    expect(song.bpm).toBe(90);
  });
});
