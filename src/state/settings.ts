import type { Mode } from '../game/modes';
import type { Lang } from '../i18n/index';

export interface Settings {
  offsetMs: number;
  /** Seconds of song visible between the top of the highway and the strike line. */
  visibleSeconds: number;
  metronome: boolean;
  rate: number;
  mode: Mode;
  hideNotes: boolean;
  lang?: Lang;
  lastSong?: string;
  lastLine: Record<string, string>;
}

const KEY = 'trons-hero.settings.v1';

const DEFAULTS: Settings = {
  offsetMs: 0,
  visibleSeconds: 1.6,
  metronome: true,
  rate: 1,
  mode: 'practicar',
  hideNotes: false,
  lastLine: {},
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode or quota: ignore */
  }
}
