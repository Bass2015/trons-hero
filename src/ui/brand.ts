import { h } from './dom';

const BASE = import.meta.env.BASE_URL;

/** Inline lightning bolt in the brand colours, used when no bolt file exists and for thumbnails. */
export const BOLT_SVG = `<svg viewBox="0 0 64 72" xmlns="http://www.w3.org/2000/svg">
  <path d="M35 4 L11 42 H29 L23 68 L55 26 H37 L46 4 Z" fill="#ff2fb3" transform="translate(3,3)"/>
  <path d="M35 4 L11 42 H29 L23 68 L55 26 H37 L46 4 Z" fill="#22d3ee" transform="translate(-3,-2)"/>
  <path d="M35 4 L11 42 H29 L23 68 L55 26 H37 L46 4 Z" fill="#ff8c1a" stroke="#e5261f" stroke-width="3" stroke-linejoin="round"/>
</svg>`;

function wordmark(): HTMLElement {
  const wm = h('div', { class: 'wordmark' });
  wm.innerHTML = `<div class="wm-bolt">${BOLT_SVG}</div><div class="wm-trons">Trons</div><div class="wm-del">del Baró</div>`;
  return wm;
}

/** Tries each candidate file in order; calls `fallback` when none loads. */
function tryImages(wrap: HTMLElement, files: string[], alt: string, cls: string, fallback: () => void) {
  const next = (i: number) => {
    const file = files[i];
    if (!file) return fallback();
    const img = h('img', { src: `${BASE}branding/${file}`, alt, class: cls }) as HTMLImageElement;
    img.onerror = () => next(i + 1);
    wrap.replaceChildren(img);
  };
  next(0);
}

/** Full logo: public/branding/logo.svg or logo.png, falls back to a CSS wordmark. */
export function logo(cls = ''): HTMLElement {
  const wrap = h('div', { class: `logo-wrap ${cls}` });
  tryImages(wrap, ['logo.svg', 'logo.png'], 'Trons del Baró', 'logo-img', () => wrap.replaceChildren(wordmark()));
  return wrap;
}

/** Bolt only: public/branding/bolt.svg or bolt.png, falls back to the inline SVG. */
export function bolt(cls = ''): HTMLElement {
  const wrap = h('span', { class: `bolt ${cls}` });
  tryImages(wrap, ['bolt.svg', 'bolt.png'], '', '', () => {
    wrap.innerHTML = BOLT_SVG;
  });
  return wrap;
}
