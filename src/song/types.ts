export type SoundName =
  | 'surdo'
  | 'caixa'
  | 'repinique'
  | 'agogo'
  | 'tamborim'
  | 'chocalho'
  | 'generic';

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
}

export interface SongSpec {
  title: string;
  /** Overrides the tempo found in the MIDI file. */
  bpm?: number;
  /** Beats per bar. Defaults to the MIDI time signature or 4. */
  beatsPerBar?: number;
  lines: LineSpec[];
}

export interface Note {
  lineId: string;
  /** Position in beats from the start of the song. */
  beat: number;
  durationBeats: number;
  /** 0..1 */
  velocity: number;
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
  /** Base URL of the song folder, used to fetch samples. */
  baseUrl: string;
}
