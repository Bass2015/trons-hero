import type { Note } from '../song/types';

/** One MIDI clip from an Ableton arrangement, times in beats (quarter notes). */
export interface AlsClip {
  /** Arrangement position where the clip starts and ends. */
  start: number;
  end: number;
  /** Loop (or start/end) markers inside the clip's own timeline. */
  loopStart: number;
  loopEnd: number;
  /** Offset from loopStart at which playback begins on the first pass. */
  startRelative: number;
  loopOn: boolean;
  notes: AlsNote[];
}

export interface AlsNote {
  /** Position inside the clip's timeline. */
  time: number;
  duration: number;
  /** 1..127 */
  velocity: number;
  pitch: number;
  enabled: boolean;
}

/**
 * Flattens a possibly looped clip into absolute arrangement beats. Playback
 * begins at loopStart + startRelative, wraps at loopEnd while the loop is on,
 * and stops at the clip's end in the arrangement.
 */
export function unrollClip(clip: AlsClip, lineId: string, velocityScale = 1): Note[] {
  const out: Note[] = [];
  const len = clip.loopEnd - clip.loopStart;
  if (len <= 0 || clip.end <= clip.start) return out;
  const firstFrom = clip.loopStart + clip.startRelative;
  const notes = clip.notes.filter((n) => n.enabled).sort((a, b) => a.time - b.time);
  const emit = (n: AlsNote, abs: number) => {
    if (abs < clip.start - 1e-9 || abs >= clip.end - 1e-9) return;
    out.push({
      lineId,
      beat: round(abs),
      durationBeats: round(Math.max(n.duration, 0.05)),
      velocity: Math.min(1, Math.max(0, (n.velocity / 127) * velocityScale)),
      pitch: n.pitch,
    });
  };
  // first pass: from the start marker to the loop end
  for (const n of notes) if (n.time >= firstFrom - 1e-9 && n.time < clip.loopEnd - 1e-9) emit(n, clip.start + (n.time - firstFrom));
  if (!clip.loopOn) return out.sort((a, b) => a.beat - b.beat);
  // further passes: whole loops until the clip ends
  let passStart = clip.start + (clip.loopEnd - firstFrom);
  let guard = 0;
  while (passStart < clip.end - 1e-9 && guard++ < 100000) {
    for (const n of notes) if (n.time >= clip.loopStart - 1e-9 && n.time < clip.loopEnd - 1e-9) emit(n, passStart + (n.time - clip.loopStart));
    passStart += len;
  }
  return out.sort((a, b) => a.beat - b.beat);
}

/** Ableton stores the time signature as one number: numerator - 1 + 99 * log2(denominator). */
export function decodeTimeSignature(value: number): { numerator: number; denominator: number } {
  return { numerator: (value % 99) + 1, denominator: 2 ** Math.floor(value / 99) };
}

function round(x: number) {
  return Math.round(x * 1e6) / 1e6;
}
