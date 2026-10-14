import { describe, expect, it } from 'vitest';
import { EXTRAS_KEY, mixColumns, volumeOf } from './mix';
import type { Line } from './types';

const line = (id: string, extra: Partial<Line> = {}): Line => ({ id, name: id, file: 'x.mid', sound: 'generic', notes: [], ...extra });

describe('mixColumns', () => {
  it('makes one column per lane keyed by the lineup instrument, in lane order', () => {
    const cols = mixColumns({ lines: [line('surdo'), line('Caixa', { name: 'Caixa 1' })] }, 'Extres');
    expect(cols.map((c) => c.key)).toEqual(['surdo', 'caixa']);
    expect(cols.map((c) => c.lineIds)).toEqual([['surdo'], ['Caixa']]);
    expect(cols[1]!.name).toBe('Caixa 1');
  });

  it('groups every hidden line into a single trailing extras column and skips the click', () => {
    const song = {
      lines: [line('goliat'), line('rocar', { role: 'hidden' }), line('ferro', { role: 'hidden' }), line('click', { role: 'click' })],
    };
    const cols = mixColumns(song, 'Extres');
    expect(cols.map((c) => c.key)).toEqual(['goliat', EXTRAS_KEY]);
    expect(cols[1]).toMatchObject({ name: 'Extres', lineIds: ['rocar', 'ferro'] });
  });

  it('has no extras column when every sounding line is a lane', () => {
    expect(mixColumns({ lines: [line('surdo'), line('click', { role: 'click' })] }, 'x')).toHaveLength(1);
  });
});

describe('volumeOf', () => {
  it('defaults to full volume and clamps stored values', () => {
    expect(volumeOf({ volumes: {} }, 'caixa')).toBe(1);
    expect(volumeOf({ volumes: { caixa: 0.3 } }, 'caixa')).toBe(0.3);
    expect(volumeOf({ volumes: { caixa: 7 } }, 'caixa')).toBe(1);
    expect(volumeOf({ volumes: { caixa: -1 } }, 'caixa')).toBe(0);
  });
});
