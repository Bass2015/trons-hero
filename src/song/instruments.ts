import type { LineSpec, SoundName } from './types';

export interface Instrument {
  id: string;
  name: string;
  color: string;
  sound: SoundName;
  /** Inline SVG using currentColor, so CSS colour applies. */
  icon: string;
}

type Shape = 'barrel-xl' | 'barrel-l' | 'barrel-m' | 'tom' | 'snare';

function drum(shape: Shape): string {
  // 48x48 viewBox, stroke only, currentColor
  const s = 'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';
  switch (shape) {
    case 'barrel-xl':
      return `<svg viewBox="0 0 48 48" ${s}><ellipse cx="24" cy="9" rx="17" ry="5"/><path d="M7 9v29c0 2.8 7.6 5 17 5s17-2.2 17-5V9"/><path d="M7 20c0 2.8 7.6 5 17 5s17-2.2 17-5M7 31c0 2.8 7.6 5 17 5s17-2.2 17-5"/></svg>`;
    case 'barrel-l':
      return `<svg viewBox="0 0 48 48" ${s}><ellipse cx="24" cy="11" rx="15" ry="4.5"/><path d="M9 11v26c0 2.5 6.7 4.5 15 4.5s15-2 15-4.5V11"/><path d="M9 24c0 2.5 6.7 4.5 15 4.5s15-2 15-4.5"/></svg>`;
    case 'barrel-m':
      return `<svg viewBox="0 0 48 48" ${s}><ellipse cx="24" cy="13" rx="13" ry="4"/><path d="M11 13v22c0 2.2 5.8 4 13 4s13-1.8 13-4V13"/><path d="M11 24c0 2.2 5.8 4 13 4s13-1.8 13-4"/></svg>`;
    case 'tom':
      return `<svg viewBox="0 0 48 48" ${s}><ellipse cx="24" cy="16" rx="14" ry="4.5"/><path d="M10 16v14c0 2.5 6.3 4.5 14 4.5s14-2 14-4.5V16"/><path d="M14 20v11M34 20v11"/></svg>`;
    case 'snare':
      return `<svg viewBox="0 0 48 48" ${s}><ellipse cx="24" cy="17" rx="17" ry="5"/><path d="M7 17v12c0 2.8 7.6 5 17 5s17-2.2 17-5V17"/><path d="M12 22l4 9M20 23l1 9M28 23l-1 9M36 22l-4 9"/></svg>`;
  }
}

/** Fixed lineup of the ensemble, low to high. */
export const INSTRUMENTS: Instrument[] = [
  { id: 'surdo', name: 'Surdo', color: '#ff8c1a', sound: 'surdo', icon: drum('barrel-xl') },
  { id: 'contra', name: 'Contra', color: '#22d3ee', sound: 'surdo', icon: drum('barrel-l') },
  { id: 'goliat', name: 'Goliat', color: '#ff2fb3', sound: 'surdo', icon: drum('barrel-m') },
  { id: 'mig', name: 'Mig', color: '#ffd60a', sound: 'repinique', icon: drum('tom') },
  { id: 'repe', name: 'Repe', color: '#4dff88', sound: 'repinique', icon: drum('tom') },
  { id: 'caixa', name: 'Caixa', color: '#a855f7', sound: 'caixa', icon: drum('snare') },
];

const byId = new Map(INSTRUMENTS.map((i) => [i.id, i]));

/** Resolves the visual identity of a line: by `instrument`, then by `id`, then by lane position. */
export function instrumentFor(line: Pick<LineSpec, 'id' | 'name' | 'instrument' | 'sound'>, index: number): Instrument {
  const known = byId.get((line.instrument ?? line.id).toLowerCase());
  if (known) return { ...known, name: line.name || known.name, sound: line.sound ?? known.sound };
  const fallback = INSTRUMENTS[index % INSTRUMENTS.length]!;
  return { ...fallback, id: line.id, name: line.name, sound: line.sound ?? 'generic' };
}
