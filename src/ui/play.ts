import { Game } from '../game/game';
import { MODES, type Mode } from '../game/modes';
import { t } from '../i18n/index';
import { bindTaps } from '../input/taps';
import { Highway } from '../render/highway';
import { instrumentFor } from '../song/instruments';
import type { Song } from '../song/types';
import type { AppContext } from './app';
import { bolt } from './brand';
import { h, icon, mmss } from './index';

export function playScreen(ctx: AppContext, song: Song, lineId: string): HTMLElement {
  const s = ctx.settings;
  const game = new Game(ctx.engine, song, lineId, { offsetMs: s.offsetMs, metronome: s.metronome, rate: s.rate, mode: s.mode });
  game.setMetronome(s.metronome);
  const bars = song.lengthBeats / song.beatsPerBar;
  const instruments = song.lines.map((l, i) => instrumentFor(l, i));
  const myLane = song.lines.findIndex((l) => l.id === lineId);
  const mine = instruments[myLane]!;

  // --- header: pause, bolt, title + time + progress, combo card
  const playBtn = h('button', { class: 'icon-btn round' }, '❚❚');
  const updatePlayBtn = () => {
    playBtn.textContent = game.isPlaying ? '❚❚' : '▶';
    playBtn.setAttribute('aria-label', game.isPlaying ? t.pause : t.play);
  };
  playBtn.onclick = () => {
    if (game.isPlaying) game.pause();
    else if (game.transport.state === 'paused') game.resume();
    else start();
    updatePlayBtn();
  };
  const timeEl = h('span', { class: 'time' }, '00:00');
  const totalEl = h('span', { class: 'time total' }, ` / ${mmss((song.lengthBeats * 60) / song.bpm / s.rate)}`);
  const progressFill = h('div', { class: 'progress-fill' });
  const comboNum = h('div', { class: 'combo-num' }, '0');
  const comboCard = h('div', { class: 'combo-card' }, comboNum, h('div', { class: 'combo-label' }, t.combo));
  const pointsEl = h('div', { class: 'points' }, '0');

  const topbar = h(
    'div',
    { class: 'playbar' },
    playBtn,
    bolt('small'),
    h(
      'div',
      { class: 'play-title' },
      h('div', { class: 'song-title' }, `${song.title}`),
      h('div', { class: 'row tight' }, timeEl, totalEl, h('div', { class: 'progress' }, progressFill)),
    ),
    h('div', { class: 'col-right' }, comboCard, pointsEl),
  );

  const refreshScore = () => {
    comboNum.textContent = String(game.score.streak);
    pointsEl.textContent = String(game.score.points);
    comboCard.classList.toggle('hot', game.score.streak >= 10);
  };

  const refreshTime = () => {
    const tr = game.transport;
    const beat = Math.min(Math.max(tr.currentBeat(), 0), song.lengthBeats);
    timeEl.textContent = mmss(beat * tr.secondsPerBeat);
    totalEl.textContent = ` / ${mmss(song.lengthBeats * tr.secondsPerBeat)}`;
    progressFill.style.width = `${(beat / song.lengthBeats) * 100}%`;
  };
  const clock = setInterval(refreshTime, 200);

  // --- highway + lane labels
  const canvas = h('canvas', { class: 'highway' });
  let highway: Highway | null = null;
  const labels = h(
    'div',
    { class: 'lane-labels' },
    instruments.map((inst, i) => {
      const el = h('div', { class: `lane-label ${i === myLane ? 'mine' : ''}` }, icon(inst.icon, 'lane-icon'), h('span', {}, inst.name));
      el.style.color = inst.color;
      el.style.flex = String(i === myLane ? 1.6 : 1);
      return el;
    }),
  );

  // --- tap buttons
  const left = h('button', { class: 'tap-btn left' }, h('span', {}, t.left), h('kbd', {}, 'V'));
  const right = h('button', { class: 'tap-btn right' }, h('span', {}, t.right), h('kbd', {}, 'N'));
  left.style.setProperty('--c', mine.color);
  right.style.setProperty('--c', mine.color);
  const pulse = (el: HTMLElement) => {
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  };
  const unbind = bindTaps(left, right, (hand) => {
    pulse(hand === 'left' ? left : right);
    game.tap(hand);
  });

  game.onHit = (e) => {
    highway?.flash(myLane, e.verdict, e.points);
    refreshScore();
  };

  // --- compact controls: mode, restart, loop, mixer, tempo
  const modeBar = h('div', { class: 'segmented small' });
  const renderModes = () =>
    modeBar.replaceChildren(
      ...MODES.map((m: Mode) =>
        h(
          'button',
          {
            class: m === game.mode ? 'active' : '',
            onclick: () => {
              game.setMode(m);
              s.mode = m;
              ctx.save();
              renderModes();
              refreshMixer();
            },
          },
          t.modes[m] ?? m,
        ),
      ),
    );
  renderModes();

  const restartBtn = h('button', { class: 'ctl-btn', onclick: () => start() }, t.restart);

  const loopChk = h('input', { type: 'checkbox' }) as HTMLInputElement;
  const fromSel = barSelect(bars, 1);
  const toSel = barSelect(bars, bars);
  const applyLoop = () => {
    let from = Number(fromSel.value);
    let to = Number(toSel.value);
    if (to < from) {
      to = from;
      toSel.value = String(to);
    }
    game.setLoop(loopChk.checked ? { startBar: from - 1, endBar: to } : null);
    updatePlayBtn();
  };
  loopChk.onchange = applyLoop;
  fromSel.onchange = applyLoop;
  toSel.onchange = applyLoop;

  const mixer = h('div', { class: 'mixer hidden' });
  const refreshMixer = () => {
    mixer.replaceChildren(
      ...song.lines.map((l, i) => {
        const st = game.lineStates[l.id];
        const b = h(
          'button',
          { class: `mix-btn ${st === 'auto' ? 'on' : ''}`, onclick: () => { game.toggleLine(l.id); refreshMixer(); } },
          icon(instruments[i]!.icon, 'lane-icon'),
          l.name,
          h('span', { class: 'state' }, st === 'auto' ? '🔊' : st === 'me' ? '🥁' : '🔇'),
        );
        b.style.setProperty('--c', instruments[i]!.color);
        return b;
      }),
    );
  };
  refreshMixer();
  const mixerBtn = h('button', { class: 'ctl-btn', onclick: () => mixer.classList.toggle('hidden') }, t.mixer);

  const bpmOf = (rate: number) => Math.round(song.bpm * rate);
  const tempoVal = h('span', { class: 'val' }, `${bpmOf(s.rate)} ${t.bpm}`);
  const tempo = h('input', { type: 'range', min: String(bpmOf(0.4)), max: String(bpmOf(1.2)), step: '1', value: String(bpmOf(s.rate)) }) as HTMLInputElement;
  tempo.oninput = () => {
    const rate = Number(tempo.value) / song.bpm;
    game.setRate(rate);
    s.rate = rate;
    ctx.save();
    tempoVal.textContent = `${tempo.value} ${t.bpm}`;
  };

  // --- lifecycle
  function start() {
    game.stop();
    game.start();
    refreshScore();
    updatePlayBtn();
  }

  function teardown() {
    clearInterval(clock);
    game.stop();
    highway?.stop();
    unbind();
  }

  game.onFinish = () => {
    teardown();
    ctx.go.results(song, lineId, game.score);
  };

  const screen = h(
    'div',
    { class: 'screen play' },
    topbar,
    h('div', { class: 'highway-wrap' }, canvas),
    labels,
    h('div', { class: 'taps' }, left, right),
    h(
      'div',
      { class: 'controls' },
      h('div', { class: 'row' }, modeBar, restartBtn, mixerBtn),
      mixer,
      h(
        'div',
        { class: 'row wrap' },
        h('label', { class: 'chk' }, loopChk, ` ${t.loop}`),
        h('span', {}, t.loopFrom), fromSel, h('span', {}, t.loopTo), toSel,
        h('span', { class: 'grow' }),
        h('button', { class: 'ctl-btn ghost', onclick: () => { teardown(); ctx.go.setup(song); } }, `‹ ${t.back}`),
      ),
      h('label', { class: 'row' }, h('span', {}, t.tempo), tempo, tempoVal),
    ),
  );

  // start once the canvas is laid out
  requestAnimationFrame(() => {
    highway = new Highway(canvas, game, instruments, { visibleSeconds: s.visibleSeconds, hideNotes: s.hideNotes });
    highway.start();
    start();
  });

  return screen;
}

function barSelect(bars: number, value: number): HTMLSelectElement {
  const sel = h('select', {}) as HTMLSelectElement;
  for (let i = 1; i <= bars; i++) sel.append(h('option', { value: String(i), selected: i === value }, String(i)));
  return sel;
}
