import { t } from '../i18n/es';
import { LANE_COLORS } from '../render/highway';
import { h } from './dom';

export function header(title: string, onBack: (() => void) | null, onSettings?: () => void) {
  return h(
    'div',
    { class: 'header' },
    onBack ? h('button', { class: 'icon-btn', onclick: onBack, 'aria-label': t.back }, '‹') : h('span', { class: 'icon-btn' }),
    h('h2', {}, title),
    onSettings ? h('button', { class: 'icon-btn', onclick: onSettings, 'aria-label': t.settings }, '⚙') : h('span', { class: 'icon-btn' }),
  );
}

export function laneColor(i: number) {
  return LANE_COLORS[i % LANE_COLORS.length]!;
}
