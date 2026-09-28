import type { Line, Song, SongSpec } from './types';
import { midiToNotes } from './midi';
import { instrumentFor } from './instruments';

const SONGS_URL = `${import.meta.env.BASE_URL}songs/`;

/** Loads every song listed in index.json (MIDI files are small, so the full parse is cheap). */
export async function listSongs(): Promise<Song[]> {
  const slugs: string[] = await fetchJson(`${SONGS_URL}index.json`);
  return Promise.all(slugs.map((slug) => loadSong(slug)));
}

export async function loadSong(slug: string): Promise<Song> {
  const baseUrl = `${SONGS_URL}${slug}/`;
  const spec = await fetchJson<SongSpec>(`${baseUrl}song.json`);
  return buildSong(slug, spec, baseUrl, (file) => fetchBytes(baseUrl + file));
}

/** Pure assembly step, separated so tests can feed MIDI bytes directly. */
export async function buildSong(
  slug: string,
  spec: SongSpec,
  baseUrl: string,
  readFile: (file: string) => Promise<ArrayBuffer | Uint8Array>,
): Promise<Song> {
  const cache = new Map<string, Promise<ArrayBuffer | Uint8Array>>();
  const read = (file: string) => cache.get(file) ?? cache.set(file, readFile(file)).get(file)!;

  let bpm: number | undefined;
  let beatsPerBar: number | undefined;
  const lines: Line[] = [];
  for (const [i, l] of spec.lines.entries()) {
    const parsed = midiToNotes(await read(l.file), l.id, l.pitches);
    bpm ??= parsed.bpm;
    beatsPerBar ??= parsed.beatsPerBar;
    lines.push({ ...l, sound: l.sound ?? instrumentFor(l, i).sound, notes: parsed.notes });
  }
  const finalBpm = spec.bpm ?? bpm ?? 120;
  const finalBeatsPerBar = spec.beatsPerBar ?? beatsPerBar ?? 4;
  const lastBeat = Math.max(0, ...lines.flatMap((l) => l.notes.map((n) => n.beat + Math.max(n.durationBeats, 0.01))));
  const lengthBeats = Math.max(finalBeatsPerBar, Math.ceil(lastBeat / finalBeatsPerBar) * finalBeatsPerBar);
  return { slug, title: spec.title, bpm: finalBpm, beatsPerBar: finalBeatsPerBar, lengthBeats, lines, baseUrl };
}

async function fetchJson<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  return res.json() as Promise<T>;
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  return res.arrayBuffer();
}
