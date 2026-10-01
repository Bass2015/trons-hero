import type { Section } from '../song/types';

export interface Locator {
  /** Arrangement position in beats. */
  time: number;
  name: string;
}

export interface SectionOptions {
  /** Arrangement beat that becomes the app's beat 0. */
  startBeat: number;
  /** Arrangement beat where the song ends (exclusive). */
  endBeat: number;
  /** Locators whose name matches are ignored (default: "Start" and names beginning with "_"). */
  ignore?: RegExp;
}

/**
 * Turns Ableton locators into sections.
 * - `NAME … /NAME` pairs are inserts (sub-sections); the closer consumes the nearest unmatched opener of that name.
 * - Every other non-closer locator is a part, running until the next part or the end of the song.
 * Beats are shifted so the song starts at 0.
 */
export function buildSections(locators: Locator[], opts: SectionOptions): Section[] {
  const ignore = opts.ignore ?? /^(start|_)/i;
  const list = locators
    .map((l) => ({ time: l.time, name: l.name.trim() }))
    .filter((l) => l.name && !ignore.test(l.name) && l.time >= opts.startBeat && l.time < opts.endBeat)
    .sort((a, b) => a.time - b.time);

  const openers = new Map<string, number[]>(); // lower-case name -> indexes of unmatched openers
  const matched = new Set<number>(); // opener indexes that became inserts
  const inserts: Section[] = [];
  list.forEach((l, i) => {
    if (l.name.startsWith('/')) {
      const key = l.name.slice(1).trim().toLowerCase();
      const stack = openers.get(key);
      const open = stack?.pop();
      if (open === undefined) return; // stray closer
      matched.add(open);
      const start = list[open]!.time;
      if (l.time > start) inserts.push({ name: list[open]!.name, startBeat: start, endBeat: l.time, kind: 'insert' });
    } else {
      const key = l.name.toLowerCase();
      openers.set(key, [...(openers.get(key) ?? []), i]);
    }
  });

  const partIdx = list.map((_, i) => i).filter((i) => !matched.has(i) && !list[i]!.name.startsWith('/'));
  const parts: Section[] = partIdx.map((i, k) => ({
    name: list[i]!.name,
    startBeat: list[i]!.time,
    endBeat: k + 1 < partIdx.length ? list[partIdx[k + 1]!]!.time : opts.endBeat,
    kind: 'part' as const,
  }));

  const r = (x: number) => Math.round((x - opts.startBeat) * 1e6) / 1e6;
  return [...parts, ...inserts]
    .filter((s) => s.endBeat > s.startBeat)
    .map((s) => ({ ...s, startBeat: r(s.startBeat), endBeat: r(Math.min(s.endBeat, opts.endBeat)) }))
    .sort((a, b) => a.startBeat - b.startBeat || (a.kind === 'part' ? -1 : 1));
}
