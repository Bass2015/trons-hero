import { Midi } from '@tonejs/midi';
import type { Note } from './types';

export interface ParsedMidi {
  notes: Note[];
  bpm: number | undefined;
  beatsPerBar: number | undefined;
}

/**
 * Converts raw MIDI bytes into notes measured in beats.
 * `pitches` restricts the result to those MIDI note numbers.
 */
export function midiToNotes(bytes: ArrayBuffer | Uint8Array, lineId: string, pitches?: number[]): ParsedMidi {
  const midi = new Midi(bytes);
  const ppq = midi.header.ppq;
  const allow = pitches ? new Set(pitches) : undefined;
  const notes: Note[] = [];
  for (const track of midi.tracks) {
    for (const n of track.notes) {
      if (allow && !allow.has(n.midi)) continue;
      notes.push({
        lineId,
        beat: n.ticks / ppq,
        durationBeats: n.durationTicks / ppq,
        velocity: n.velocity,
      });
    }
  }
  notes.sort((a, b) => a.beat - b.beat);
  const tempo = midi.header.tempos[0]?.bpm;
  const sig = midi.header.timeSignatures[0]?.timeSignature;
  const beatsPerBar = sig ? (sig[0] ?? 4) * (4 / (sig[1] ?? 4)) : undefined;
  return { notes, bpm: tempo, beatsPerBar };
}
