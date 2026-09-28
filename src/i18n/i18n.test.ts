import { describe, expect, it } from 'vitest';
import { ca } from './ca';
import { es } from './es';
import { setLang, t } from './index';

const keys = (o: object, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

describe('i18n', () => {
  it('has the same keys in Catalan and Spanish', () => {
    expect(keys(es).sort()).toEqual(keys(ca).sort());
  });

  it('switches language live through the proxy', () => {
    setLang('ca');
    expect(t.play).toBe('Tocar');
    expect(t.songs).toBe('Cançons');
    setLang('es');
    expect(t.songs).toBe('Canciones');
    setLang('ca');
  });
});
