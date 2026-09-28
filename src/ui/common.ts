import { t } from '../i18n/index';
import { h } from './dom';

/** Top bar: back button (or spacer), title, optional element on the right. */
export function header(title: string, onBack: (() => void) | null, right?: HTMLElement | null) {
  return h(
    'div',
    { class: 'header' },
    onBack ? h('button', { class: 'icon-btn', onclick: onBack, 'aria-label': t.back }, '‹') : h('span', { class: 'icon-btn' }),
    h('h2', {}, title),
    right ?? h('span', { class: 'icon-btn' }),
  );
}

export function mmss(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

/** Element whose innerHTML is an SVG icon string. */
export function icon(svg: string, cls = 'icon'): HTMLElement {
  const el = h('span', { class: cls });
  el.innerHTML = svg;
  return el;
}
