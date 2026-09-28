import { MODES, type Mode } from '../game/modes';
import { t } from '../i18n/index';
import { instrumentFor } from '../song/instruments';
import type { Song } from '../song/types';
import type { AppContext } from './app';
import { h, header, icon } from './index';

/** Pre-play screen: instrument cards, mode, speed, toggles, start. */
export function setupScreen(ctx: AppContext, song: Song): HTMLElement {
  const s = ctx.settings;
  let lineId = s.lastLine[song.slug] ?? song.lines[0]!.id;
  if (!song.lines.some((l) => l.id === lineId)) lineId = song.lines[0]!.id;

  // --- instrument cards
  const cards = h('div', { class: 'cards' });
  const renderCards = () => {
    cards.replaceChildren(
      ...song.lines.map((l, i) => {
        const inst = instrumentFor(l, i);
        const card = h(
          'button',
          {
            class: `card ${l.id === lineId ? 'selected' : ''}`,
            style: { '--c': inst.color } as unknown as Record<string, string>,
            onclick: () => {
              lineId = l.id;
              renderCards();
            },
          },
          icon(inst.icon, 'card-icon'),
          h('span', { class: 'card-name' }, inst.name),
        );
        card.style.setProperty('--c', inst.color);
        return card;
      }),
    );
  };
  renderCards();

  // --- mode
  const modeHelp = h('p', { class: 'hint small' }, t.modeHelp[s.mode] ?? '');
  const modeBar = h('div', { class: 'segmented' });
  const renderModes = () =>
    modeBar.replaceChildren(
      ...MODES.map((m: Mode) =>
        h(
          'button',
          {
            class: m === s.mode ? 'active' : '',
            onclick: () => {
              s.mode = m;
              ctx.save();
              modeHelp.textContent = t.modeHelp[m] ?? '';
              renderModes();
            },
          },
          t.modes[m] ?? m,
        ),
      ),
    );
  renderModes();

  // --- speed: quick chips + bpm slider
  const bpmOf = (rate: number) => Math.round(song.bpm * rate);
  const tempoVal = h('span', { class: 'val' }, `${bpmOf(s.rate)} ${t.bpm}`);
  const tempo = h('input', { type: 'range', min: String(bpmOf(0.4)), max: String(bpmOf(1.2)), step: '1', value: String(bpmOf(s.rate)) }) as HTMLInputElement;
  const chips = h('div', { class: 'chips' });
  const setRate = (rate: number) => {
    s.rate = rate;
    ctx.save();
    tempo.value = String(bpmOf(rate));
    tempoVal.textContent = `${bpmOf(rate)} ${t.bpm}`;
    renderChips();
  };
  const renderChips = () =>
    chips.replaceChildren(
      ...[0.5, 0.75, 1].map((r) =>
        h('button', { class: `chip ${Math.abs(s.rate - r) < 0.005 ? 'active' : ''}`, onclick: () => setRate(r) }, `${Math.round(r * 100)}%`),
      ),
    );
  renderChips();
  tempo.oninput = () => setRate(Number(tempo.value) / song.bpm);

  // --- toggles
  const toggle = (label: string, help: string | null, value: boolean, onChange: (v: boolean) => void) => {
    const input = h('input', { type: 'checkbox', checked: value }) as HTMLInputElement;
    input.onchange = () => onChange(input.checked);
    return h(
      'label',
      { class: 'switch-row' },
      h('span', { class: 'switch-text' }, h('span', {}, label), help ? h('span', { class: 'hint small' }, help) : null),
      h('span', { class: 'switch' }, input, h('span', { class: 'knob' })),
    );
  };

  return h(
    'div',
    { class: 'screen setup' },
    header(song.title, () => ctx.go.home('songs')),
    h('h3', { class: 'caps' }, t.chooseLine),
    cards,
    h('h3', { class: 'caps' }, t.mode),
    modeBar,
    modeHelp,
    h('h3', { class: 'caps' }, t.speed),
    h('div', { class: 'row' }, chips, tempoVal),
    tempo,
    toggle(t.metronome, null, s.metronome, (v) => {
      s.metronome = v;
      ctx.save();
    }),
    toggle(t.hideNotes, t.hideNotesHelp, s.hideNotes, (v) => {
      s.hideNotes = v;
      ctx.save();
    }),
    h('div', { class: 'spacer' }),
    h('button', { class: 'big-btn wide', onclick: () => ctx.go.play(song, lineId) }, `${t.start} ›`),
  );
}
