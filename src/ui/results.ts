import type { Score } from '../game/score';
import { t } from '../i18n/index';
import { instrumentFor } from '../song/instruments';
import type { Song } from '../song/types';
import type { AppContext } from './app';
import { h, header, icon } from './index';

export function gradeFor(accuracy: number): string {
  if (accuracy >= 97) return 'S';
  if (accuracy >= 90) return 'A';
  if (accuracy >= 80) return 'B';
  if (accuracy >= 65) return 'C';
  return 'D';
}

export function resultsScreen(ctx: AppContext, song: Song, lineId: string, score: Score): HTMLElement {
  const idx = Math.max(0, song.lines.findIndex((l) => l.id === lineId));
  const inst = instrumentFor(song.lines[idx]!, idx);
  const acc = score.accuracy;
  const grade = gradeFor(acc);

  // ring: conic gradient of the brand colours, masked to a ring, filled to the accuracy
  const ring = h('div', { class: 'grade-ring' }, h('div', { class: 'grade-letter' }, grade));
  ring.style.setProperty('--pct', `${acc}%`);

  const total = Math.max(1, score.judged);
  const seg = (n: number, cls: string) => {
    const d = h('div', { class: `seg ${cls}` });
    d.style.width = `${(n / total) * 100}%`;
    return d;
  };

  const stat = (value: string, label: string) => h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, value), h('div', { class: 'stat-label caps' }, label));

  return h(
    'div',
    { class: 'screen results' },
    header(song.title, () => ctx.go.home('songs')),
    h('div', { class: 'results-hero' }, ring, h('div', { class: 'stats' }, stat(`${acc}%`, t.accuracy), stat(String(score.bestStreak), t.best), stat(String(score.miss), t.misses), stat(String(score.points), t.points))),
    h(
      'section',
      {},
      h('div', { class: 'row' }, icon(inst.icon, 'lane-icon'), h('strong', { style: { color: inst.color } }, inst.name)),
      h('div', { class: 'breakdown' }, seg(score.perfect, 'perfect'), seg(score.good, 'good'), seg(score.miss, 'miss')),
      h(
        'div',
        { class: 'row wrap legend' },
        h('span', { class: 'dot perfect' }), `${t.perfect.replace(/[!¡]/g, '')} ${score.perfect}`,
        h('span', { class: 'dot good' }), `${t.good} ${score.good}`,
        h('span', { class: 'dot miss' }), `${t.miss} ${score.miss}`,
      ),
    ),
    h('div', { class: 'spacer' }),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'ctl-btn big', onclick: () => ctx.go.play(song, lineId) }, `↻ ${t.playAgain}`),
      h('button', { class: 'big-btn grow', onclick: () => ctx.go.home('songs') }, `☰ ${t.mainMenu}`),
    ),
  );
}
