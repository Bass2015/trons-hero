import { h } from './dom';

const BASE = import.meta.env.BASE_URL;

/** Inline lightning bolt in the brand colours, used when bolt.png is missing and for thumbnails. */
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

/** Full logo: uses public/branding/logo.png, falls back to a CSS wordmark. */
export function logo(cls = ''): HTMLElement {
  const wrap = h('div', { class: `logo-wrap ${cls}` });
  const img = h('img', { src: `${BASE}branding/logo.png`, alt: 'Trons del Baró', class: 'logo-img' }) as HTMLImageElement;
  img.onerror = () => wrap.replaceChildren(wordmark());
  wrap.append(img);
  return wrap;
}

/** Bolt only: uses public/branding/bolt.png, falls back to the inline SVG. */
export function bolt(cls = ''): HTMLElement {
  const wrap = h('span', { class: `bolt ${cls}` });
  const img = h('img', { src: `${BASE}branding/bolt.png`, alt: '' }) as HTMLImageElement;
  img.onerror = () => {
    wrap.innerHTML = BOLT_SVG;
  };
  wrap.append(img);
  return wrap;
}
