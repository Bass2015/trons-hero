import { ca, type Dict } from './ca';
import { es } from './es';

export type Lang = 'ca' | 'es';
export const LANGS: Record<Lang, string> = { ca: 'Català', es: 'Castellano' };

const dicts: Record<Lang, Dict> = { ca, es };
let current: Lang = 'ca';

export function detectLang(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return nav.toLowerCase().startsWith('ca') ? 'ca' : 'es';
}

export function setLang(lang: Lang) {
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

export function getLang(): Lang {
  return current;
}

/** Live view of the active dictionary: `t.play` always reads the current language. */
export const t: Dict = new Proxy({} as Dict, {
  get: (_target, key) => dicts[current][key as keyof Dict],
  ownKeys: () => Reflect.ownKeys(dicts[current]),
  getOwnPropertyDescriptor: (_t, key) => Reflect.getOwnPropertyDescriptor(dicts[current], key),
});
