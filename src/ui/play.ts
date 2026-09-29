import { Game } from '../game/game';
import { MODES, type Mode } from '../game/modes';
import { t } from '../i18n/index';
import { bindTaps } from '../input/taps';
import { Highway } from '../render/highway';
import { instrumentFor } from '../song/instruments';
import { laneLines, soundingLines, type Song } from '../song/types';
import type { AppContext, PlayResume } from './app';
import { bolt } from './brand';
import { h, icon, mmss } from './index';

/** Size of the note pills relative to the lane width; tuned with the ensemble on the mock page. */
const NOTE_SCALE = 0.5;

export function playScreen(ctx: AppContext, song: Song, lineId: string, resume?: PlayResume): HTMLElement {
  const s = ctx.settings;
  const game = new Game(ctx.engine, song, lineId, { offsetMs: s.offsetMs, metronome: s.metronome, rate: s.rate, mode: s.mode });
  game.setMetronome(s.metronome);
  const bars = song.lengthBeats / song.beatsPerBar;
  const lanes = laneLines(song);
  const instruments = lanes.map((l, i) => instrumentFor(l, i));
  const myLane = () => lanes.findIndex((l) => l.id === game.myLineId);
  const mine = () => instruments[myLane()]!;
  let highway: Highway | null = null;

  // --- header: bolt, title, time + scrub slider, combo card
  const timeEl = h('span', { class: 'time' }, '00:00');
  const totalEl = h('span', { class: 'time total' }, mmss(game.transport.secondsBetween(0, song.lengthBeats)));
  const scrub = h('input', { type: 'range', class: 'scrub', min: '0', max: String(song.lengthBeats), step: '0.25', value: '0', 'aria-label': t.position }) as HTMLInputElement;
  const comboNum = h('div', { class: 'combo-num' }, '0');
  const comboCard = h('div', { class: 'combo-card' }, comboNum, h('div', { class: 'combo-label' }, t.combo));
  const pointsEl = h('div', { class: 'points' }, '0');
  const tempoVal = h('span', { class: 'val' }, `${Math.round(song.bpm * s.rate)} ${t.bpm}`);

  const topbar = h(
    'div',
    { class: 'playbar' },
    bolt('small'),
    h('div', { class: 'play-title' }, h('div', { class: 'song-title' }, song.title), h('div', { class: 'row tight' }, timeEl, scrub, totalEl)),
    h('div', { class: 'col-right' }, comboCard, pointsEl),
  );

  // scrubbing: silent while dragging, resumes where released
  let scrubbing = false;
  let wasPlaying = false;
  const paintScrub = (beat: number) => {
    scrub.value = String(beat);
    scrub.style.setProperty('--pct', `${(Math.max(0, beat) / song.lengthBeats) * 100}%`);
  };
  scrub.addEventListener('pointerdown', () => {
    scrubbing = true;
    wasPlaying = game.isPlaying;
    if (wasPlaying) game.pause();
    updatePlayBtn();
  });
  scrub.addEventListener('input', () => {
    const beat = Number(scrub.value);
    game.transport.seek(beat);
    paintScrub(beat);
    refreshTime();
  });
  const endScrub = () => {
    if (!scrubbing) return;
    scrubbing = false;
    game.seek(Number(scrub.value));
    if (wasPlaying) game.resume();
    refreshScore();
    updatePlayBtn();
  };
  scrub.addEventListener('pointerup', endScrub);
  scrub.addEventListener('pointercancel', endScrub);
  scrub.addEventListener('keyup', endScrub);

  const refreshScore = () => {
    comboNum.textContent = String(game.score.streak);
    pointsEl.textContent = String(game.score.points);
    comboCard.classList.toggle('hot', game.score.streak >= 10);
  };

  const refreshTime = () => {
    const tr = game.transport;
    const beat = Math.min(Math.max(tr.currentBeat(), 0), song.lengthBeats);
    timeEl.textContent = mmss(tr.secondsBetween(0, beat));
    totalEl.textContent = mmss(tr.secondsBetween(0, song.lengthBeats));
    tempoVal.textContent = `${Math.round(tr.currentBpm * tr.rate)} ${t.bpm}`;
    if (!scrubbing) paintScrub(beat);
  };
  const clock = setInterval(refreshTime, 200);

  // --- highway + tappable lane labels (absolutely positioned so they can glide with the lanes)
  const canvas = h('canvas', { class: 'highway' });
  const labelEls = instruments.map((inst, i) => {
    const el = h('button', { class: 'lane-label', onclick: () => switchLine(lanes[i]!.id) }, icon(inst.icon, 'lane-icon'), h('span', {}, inst.name));
    el.style.color = inst.color;
    return el;
  });
  const labels = h('div', { class: 'lane-labels' }, labelEls);
  const layoutLabels = () => {
    const layout = highway?.targetLayout(100);
    labelEls.forEach((el, i) => {
      const g = layout?.[i];
      if (g) {
        el.style.left = `${g.x0}%`;
        el.style.width = `${g.w}%`;
      }
      el.classList.toggle('mine', i === myLane());
    });
  };

  // --- tap buttons
  const left = h('button', { class: 'tap-btn left' }, h('span', {}, t.left), h('kbd', {}, 'V'));
  const right = h('button', { class: 'tap-btn right' }, h('span', {}, t.right), h('kbd', {}, 'N'));
  const paintTaps = () => {
    for (const el of [left, right]) el.style.setProperty('--c', mine().color);
  };
  paintTaps();
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
    highway?.flash(myLane(), e.verdict, e.points);
    refreshScore();
  };

  // --- big transport button
  const playBtn = h('button', { class: 'pause-btn' }, t.pause);
  const updatePlayBtn = () => {
    const playing = game.isPlaying;
    playBtn.textContent = playing ? `❚❚  ${t.pause}` : game.transport.state === 'paused' ? `▶  ${t.resume}` : `▶  ${t.play}`;
    playBtn.classList.toggle('playing', playing);
  };
  playBtn.onclick = () => {
    if (game.isPlaying) game.pause();
    else if (game.transport.state === 'paused') game.resume();
    else start();
    updatePlayBtn();
  };

  // --- line switch: in place, lanes glide, labels follow
  function switchLine(id: string) {
    if (id === game.myLineId) return;
    highway?.beginLaneTransition();
    game.setMyLine(id);
    s.lastLine[song.slug] = id;
    ctx.save();
    layoutLabels();
    paintTaps();
    refreshScore();
    refreshMixer();
  }

  // --- compact controls: mode, restart, mixer, metronome, loop, tempo
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

  const metro = h('input', { type: 'checkbox', checked: s.metronome }) as HTMLInputElement;
  metro.onchange = () => {
    s.metronome = metro.checked;
    ctx.save();
    game.setMetronome(metro.checked);
  };

  const loopChk = h('input', { type: 'checkbox' }) as HTMLInputElement;
  const fromSel = barSelect(bars, 1, song.firstBar);
  const toSel = barSelect(bars, bars, song.firstBar);
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
      ...soundingLines(song).map((l) => {
        const st = game.lineStates[l.id];
        const inst = instrumentFor(l, Math.max(0, lanes.indexOf(l)));
        const b = h(
          'button',
          { class: `mix-btn ${st === 'auto' ? 'on' : ''}`, onclick: () => { game.toggleLine(l.id); refreshMixer(); } },
          icon(inst.icon, 'lane-icon'),
          inst.name,
          h('span', { class: 'state' }, st === 'auto' ? '🔊' : st === 'me' ? '🥁' : '🔇'),
        );
        b.style.setProperty('--c', inst.color);
        return b;
      }),
    );
  };
  refreshMixer();
  const mixerBtn = h('button', { class: 'ctl-btn', onclick: () => mixer.classList.toggle('hidden') }, t.mixer);

  const bpmOf = (rate: number) => Math.round(song.bpm * rate);
  const tempo = h('input', { type: 'range', min: String(bpmOf(0.4)), max: String(bpmOf(1.2)), step: '1', value: String(bpmOf(s.rate)) }) as HTMLInputElement;
  tempo.oninput = () => {
    const rate = Number(tempo.value) / song.bpm;
    game.setRate(rate);
    s.rate = rate;
    ctx.save();
    refreshTime();
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
    ctx.go.results(song, game.myLineId, game.score);
  };

  const screen = h(
    'div',
    { class: 'screen play' },
    topbar,
    h('div', { class: 'highway-wrap' }, canvas),
    labels,
    h('div', { class: 'taps' }, left, right),
    playBtn,
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
        h('label', { class: 'chk' }, metro, ` ${t.metronome}`),
      ),
      h('div', { class: 'row' }, h('span', {}, t.tempo), tempo, tempoVal, h('button', { class: 'ctl-btn ghost', onclick: () => { teardown(); ctx.go.setup(song); } }, `‹ ${t.back}`)),
    ),
  );

  // start once the canvas is laid out
  requestAnimationFrame(() => {
    highway = new Highway(canvas, game, instruments, { visibleSeconds: s.visibleSeconds, hideNotes: s.hideNotes, noteScale: NOTE_SCALE });
    highway.start();
    layoutLabels();
    if (resume) {
      game.start(resume.beat);
      if (resume.paused) game.pause();
      refreshScore();
      updatePlayBtn();
    } else {
      start();
    }
  });

  return screen;
}

/** Values are app bars (1..bars); labels show the project's bar numbers. */
function barSelect(bars: number, value: number, firstBar: number): HTMLSelectElement {
  const sel = h('select', {}) as HTMLSelectElement;
  for (let i = 1; i <= bars; i++) sel.append(h('option', { value: String(i), selected: i === value }, String(i + firstBar - 1)));
  return sel;
}
