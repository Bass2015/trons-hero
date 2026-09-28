import { describe, expect, it } from 'vitest';
import { INSTRUMENTS, instrumentFor } from './instruments';

describe('instrumentFor', () => {
  it('resolves by explicit instrument, then by id', () => {
    expect(instrumentFor({ id: 'x', name: 'Contra 2', instrument: 'contra' }, 0).color).toBe('#22d3ee');
    expect(instrumentFor({ id: 'Caixa', name: 'Caixa' }, 0).id).toBe('caixa');
  });

  it('keeps the song\'s display name and sound override', () => {
    const i = instrumentFor({ id: 'surdo', name: 'Surdo 1', sound: 'generic' }, 0);
    expect(i.name).toBe('Surdo 1');
    expect(i.sound).toBe('generic');
  });

  it('falls back to a positional colour for unknown lines', () => {
    const i = instrumentFor({ id: 'agogo', name: 'Agogô' }, 7);
    expect(i.id).toBe('agogo');
    expect(i.color).toBe(INSTRUMENTS[1]!.color);
  });
});
