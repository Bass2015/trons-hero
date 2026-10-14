import type { Settings } from '../state/settings';
import { INSTRUMENTS, instrumentFor } from './instruments';
import { laneLines, soundingLines, type Song } from './types';

/** Settings key for the single column that controls every hidden (lane-less) line. */
export const EXTRAS_KEY = 'extras';

/** One fader of the mixer: a volume key in settings and the lines it drives. */
export interface MixColumn {
  /** Global settings key: the lineup instrument id (surdo, caixa…) or `extras`. */
  key: string;
  name: string;
  color: string;
  icon: string;
  lineIds: string[];
}

/**
 * One column per lane, in lane order (same indices as `laneLines`), plus a trailing
 * `extras` column when the song has hidden lines that sound without a lane.
 */
export function mixColumns(song: Pick<Song, 'lines'>, extrasName: string): MixColumn[] {
  const cols: MixColumn[] = laneLines(song).map((line, i) => {
    const inst = instrumentFor(line, i);
    return { key: inst.id, name: inst.name, color: inst.color, icon: inst.icon, lineIds: [line.id] };
  });
  const hidden = soundingLines(song).filter((l) => l.role === 'hidden');
  if (hidden.length) {
    const extra = INSTRUMENTS.find((i) => i.id === 'rocar')!;
    cols.push({ key: EXTRAS_KEY, name: extrasName, color: extra.color, icon: extra.icon, lineIds: hidden.map((l) => l.id) });
  }
  return cols;
}

/** Stored volume for a mixer column, 0..1; unset means full volume. */
export function volumeOf(s: Pick<Settings, 'volumes'>, key: string): number {
  const v = s.volumes[key];
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}
