import { Game } from '../game/game';
import { MODES, type Mode } from '../game/modes';
import { bindTaps } from '../input/taps';
import { Highway } from '../render/highway';
import type { Song } from '../song/types';
import { t } from '../i18n/es';
import type { AppContext } from './app';
import { h, header, laneColor } from './index';

export function playScreen(ctx: AppContext, song: Song, lineId: string): HTMLElement {
  const s = ctx.settings;
  const game = new Game(ctx.engine, song, lineId, { offsetMs: s.offsetMs, metronome: s.metronome, rate: s.rate, mode: s.mode });
  const bars = song.lengthBeats / song.beatsPerBar;
  let loopOn = false;
  let loopFrom = 1;
  let loopTo = bars;

  // --- score display
  const streakEl = h('strong', {}, '0');
  const accEl = h('strong', {}, '100%');
  const refreshScore = () => {
    streakEl.textContent = String(game.score.streak);
    accEl.textContent = `${game.score.accuracy}%`;
  };

  // --- canvas
  const canvas = h('canvas', { class: 'highway' });
  let highway: Highway | null = null;

  // --- mode selector
  const modeBtns = new Map<Mode, HTMLButtonElement>();
  const modeHelp = h('p', { class: 'hint small' }, t.modeHelp[s.mode] ?? '');
  const setMode = (m: Mode) => {
    game.setMode(m);
    s.mode = m;
    ctx.save();
    modeBtns.forEach((b, k) => b.classList.toggle('active', k === m));
    modeHelp.textContent = t.modeHelp[m] ?? '';
    refreshMixer();
  };
  const modeBar = h(
    'div',
    { class: 'segmented' },
    MODES.map((m) => {
      const b = h('button', { class: m === s.mode ? 'active' : '', onclick: () => setMode(m) }, t.modes[m] ?? m);
      modeBtns.set(m, b);
      return b;
    }),
  );

  // --- transport controls
  const playBtn = h('button', { class: 'ctl-btn primary' }, t.play);
  const updatePlayBtn = () => {
    playBtn.textContent = game.isPlaying ? t.pause : game.transport.state === 'paused' ? t.resume : t.play;
  };
  playBtn.onclick = () => {
    if (game.isPlaying) game.pause();
    else if (game.transport.state === 'paused') game.resume();
    else {
      game.start();
      refreshScore();
    }
    updatePlayBtn();
  };
  const restartBtn = h(
    'button',
    { class: 'ctl-btn', onclick: () => { game.stop(); game.start(); refreshScore(); updatePlayBtn(); } },
    t.restart,
  );

  const tempoVal = h('span', { class: 'val' }, `${Math.round(s.rate * 100)}%`);
  const tempo = h('input', { type: 'range', min: '40', max: '120', step: '5', value: String(Math.round(s.rate * 100)) }) as HTMLInputElement;
  tempo.oninput = () => {
    const rate = Number(tempo.value) / 100;
    game.setRate(rate);
    s.rate = rate;
    ctx.save();
    tempoVal.textContent = `${tempo.value}%`;
  };

  const metro = h('input', { type: 'checkbox', checked: s.metronome }) as HTMLInputElement;
  metro.onchange = () => {
    game.setMetronome(metro.checked);
    s.metronome = metro.checked;
    ctx.save();
  };
  game.setMetronome(s.metronome);

  // --- loop controls
  const loopChk = h('input', { type: 'checkbox' }) as HTMLInputElement;
  const fromSel = barSelect(bars, loopFrom);
  const toSel = barSelect(bars, loopTo);
  const applyLoop = () => {
    loopFrom = Number(fromSel.value);
    loopTo = Number(toSel.value);
    if (loopTo < loopFrom) {
      loopTo = loopFrom;
      toSel.value = String(loopTo);
    }
    loopOn = loopChk.checked;
    game.setLoop(loopOn ? { startBar: loopFrom - 1, endBar: loopTo } : null);
    updatePlayBtn();
  };
  loopChk.onchange = applyLoop;
  fromSel.onchange = applyLoop;
  toSel.onchange = applyLoop;

  // --- mixer panel
  const mixer = h('div', { class: 'mixer hidden' });
  const refreshMixer = () => {
    mixer.replaceChildren(
      ...song.lines.map((l, i) =>
        h(
          'button',
          {
            class: `mix-btn ${game.lineStates[l.id] === 'auto' ? 'on' : ''}`,
            style: { borderColor: laneColor(i) },
            onclick: () => { game.toggleLine(l.id); refreshMixer(); },
          },
          l.name,
          h('span', { class: 'state' }, game.lineStates[l.id] === 'auto' ? '🔊' : game.lineStates[l.id] === 'me' ? '🥁' : '🔇'),
        ),
      ),
    );
  };
  refreshMixer();
  const mixerBtn = h('button', { class: 'ctl-btn', onclick: () => mixer.classList.toggle('hidden') }, t.mixer);

  // --- tap buttons
  const left = h('button', { class: 'tap-btn left' }, h('span', {}, t.left), h('kbd', {}, 'V'));
  const right = h('button', { class: 'tap-btn right' }, h('span', {}, t.right), h('kbd', {}, 'N'));
  const pulse = (el: HTMLElement) => {
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  };
  const unbind = bindTaps(left, right, (hand) => {
    pulse(hand === 'left' ? left : right);
    game.tap(hand);
  });

  const myLane = song.lines.findIndex((l) => l.id === lineId);
  game.onHit = (e) => {
    highway?.flash(myLane, e.verdict);
    refreshScore();
  };

  // --- finish overlay
  const overlay = h('div', { class: 'overlay hidden' });
  game.onFinish = () => {
    updatePlayBtn();
    const sc = game.score;
    overlay.replaceChildren(
      h(
        'div',
        { class: 'card' },
        h('h2', {}, t.finished),
        h('p', {}, `${t.accuracy}: `, h('strong', {}, `${sc.accuracy}%`)),
        h('p', {}, `${t.hits}: `, h('strong', {}, String(sc.perfect + sc.good)), ` · ${t.misses}: `, h('strong', {}, String(sc.miss))),
        h('p', {}, `${t.best}: `, h('strong', {}, String(sc.bestStreak))),
        h('div', { class: 'row' },
          h('button', { class: 'ctl-btn primary', onclick: () => { overlay.classList.add('hidden'); game.start(); refreshScore(); updatePlayBtn(); } }, t.restart),
          h('button', { class: 'ctl-btn', onclick: leave }, t.back),
        ),
      ),
    );
    overlay.classList.remove('hidden');
  };

  function leave() {
    game.stop();
    highway?.stop();
    unbind();
    ctx.go.lines(song);
  }

  const screen = h(
    'div',
    { class: 'screen play' },
    header(`${song.title} · ${game.myLine.name}`, leave),
    h(
      'div',
      { class: 'scorebar' },
      h('span', {}, `${t.streak} `, streakEl),
      h('span', {}, `${t.accuracy} `, accEl),
    ),
    modeBar,
    modeHelp,
    h('div', { class: 'highway-wrap' }, canvas, overlay),
    h('div', { class: 'taps' }, left, right),
    h(
      'div',
      { class: 'controls' },
      h('div', { class: 'row' }, playBtn, restartBtn, mixerBtn),
      mixer,
      h('label', { class: 'row' }, h('span', {}, t.tempo), tempo, tempoVal),
      h(
        'div',
        { class: 'row wrap' },
        h('label', { class: 'chk' }, loopChk, ` ${t.loop}`),
        h('span', {}, t.loopFrom), fromSel, h('span', {}, t.loopTo), toSel,
        h('label', { class: 'chk' }, metro, ` ${t.metronome}`),
      ),
    ),
  );

  // start rendering once the canvas is laid out
  requestAnimationFrame(() => {
    highway = new Highway(canvas, game, { visibleSeconds: s.visibleSeconds });
    highway.start();
  });

  return screen;
}

function barSelect(bars: number, value: number): HTMLSelectElement {
  const sel = h('select', {}) as HTMLSelectElement;
  for (let i = 1; i <= bars; i++) sel.append(h('option', { value: String(i), selected: i === value }, String(i)));
  return sel;
}
