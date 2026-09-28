export type Mode = 'escuchar' | 'solo' | 'practicar';
export const MODES: Mode[] = ['escuchar', 'solo', 'practicar'];

/**
 * auto  = the app plays the line.
 * muted = silent.
 * me    = the player's line: silent unless tapped.
 */
export type LineState = 'auto' | 'muted' | 'me';

export function presetStates(mode: Mode, lineIds: string[], myLineId: string): Record<string, LineState> {
  const out: Record<string, LineState> = {};
  for (const id of lineIds) {
    const mine = id === myLineId;
    switch (mode) {
      case 'escuchar':
        out[id] = 'auto';
        break;
      case 'solo':
        out[id] = mine ? 'auto' : 'muted';
        break;
      case 'practicar':
        out[id] = mine ? 'me' : 'auto';
        break;
    }
  }
  return out;
}
