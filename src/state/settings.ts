import type { Mode } from '../game/modes';
import type { Lang } from '../i18n/index';

export interface Settings {
  offsetMs: number;
  /** Bars of upcoming notes visible above the strike line. */
  visibleBars: number;
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
  visibleBars: 2,
  metronome: true,
  rate: 1,
  mode: 'practicar',
  hideNotes: false,
  lastLine: {},
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const stored = JSON.parse(raw) as Partial<Settings> & { visibleSeconds?: number };
    delete stored.visibleSeconds; // replaced by visibleBars
    return { ...DEFAULTS, ...stored };
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
