export type SoundName =
  | 'surdo'
  | 'caixa'
  | 'repinique'
  | 'agogo'
  | 'tamborim'
  | 'chocalho'
  | 'generic';

/**
 * lane   = visible, selectable, playable (default).
 * hidden = sounds with the song but has no lane (e.g. shakers that nobody practises).
 * click  = the song's own click track: plays through the metronome channel when the metronome is on.
 */
export type LineRole = 'lane' | 'hidden' | 'click';

/** A line as declared in song.json. */
export interface LineSpec {
  id: string;
  name: string;
  file: string;
  /** MIDI note numbers that belong to this line. Omit to take every note in the file. */
  pitches?: number[];
  /** Id from the fixed lineup (surdo, contra, goliat, mig, repe, caixa). Defaults to `id`. */
  instrument?: string;
  sound?: SoundName;
  /** Optional recorded sample, relative to the song folder. Falls back to the synth. */
  sample?: string;
  role?: LineRole;
}

export interface SongSpec {
  title: string;
  /** Overrides the tempo found in the MIDI file. */
  bpm?: number;
  /** Beats per bar. Defaults to the MIDI time signature or 4. */
  beatsPerBar?: number;
  /** Ableton bar number of the app's bar 1, so bar labels match the project. Defaults to 1. */
  firstBar?: number;
  /** Cover image, relative to the song folder. */
  cover?: string;
  lines: LineSpec[];
}

export interface Note {
  lineId: string;
  /** Position in beats from the start of the song. */
  beat: number;
  durationBeats: number;
  /** 0..1 */
  velocity: number;
  /** MIDI note number, kept for stroke types and click accents. */
  pitch?: number;
}

export interface Line extends LineSpec {
  sound: SoundName;
  notes: Note[];
}

export interface Song {
  slug: string;
  title: string;
  bpm: number;
  beatsPerBar: number;
  /** Total length in beats, rounded up to a whole bar. */
  lengthBeats: number;
  lines: Line[];
  firstBar: number;
  /** Absolute URL of the cover image, if any. */
  coverUrl?: string;
  /** Base URL of the song folder, used to fetch samples. */
  baseUrl: string;
}

/** Lines that get a lane on the highway. */
export function laneLines(song: Pick<Song, 'lines'>): Line[] {
  return song.lines.filter((l) => (l.role ?? 'lane') === 'lane');
}

/** Lines that produce sound with the song (lanes and hidden lines, not the click). */
export function soundingLines(song: Pick<Song, 'lines'>): Line[] {
  return song.lines.filter((l) => (l.role ?? 'lane') !== 'click');
}

export function clickLine(song: Pick<Song, 'lines'>): Line | undefined {
  return song.lines.find((l) => l.role === 'click');
}
