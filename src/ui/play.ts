import { Game } from '../game/game';
import { MODES, type Mode } from '../game/modes';
import { t } from '../i18n/index';
import { bindTaps } from '../input/taps';
import { Highway } from '../render/highway';
import { instrumentFor } from '../song/instruments';
import { laneLines, type Section, type Song } from '../song/types';
import type { AppContext, PlayResume } from './app';
import { bolt } from './brand';
import { h, icon, mmss } from './index';

/** Size of the note pills relative to the lane width; tuned with the ensemble on the mock page. */
const NOTE_SCALE = 0.5;

const METRONOME_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 3h7l3 18h-13l3-18z"/><path d="M12 15l4.5-9"/><circle cx="16.5" cy="6" r="1.6" fill="currentColor"/></svg>`;

export function playScreen(ctx: AppContext, song: Song, lineId: string, resume?: PlayResume): HTMLElement {
  const s = ctx.settings;
  const game = new Game(ctx.engine, song, lineId, { offsetMs: s.offsetMs, metronome: s.metronome, rate: s.rate, mode: s.mode });
  game.setMetronome(s.metronome);
  const lanes = laneLines(song);
  const instruments = lanes.map((l, i) => instrumentFor(l, i));
  const myLane = () => lanes.findIndex((l) => l.id === game.myLineId);
  const mine = () => instruments[myLane()]!;
  let highway: Highway | null = null;

  // --- 1. mode row
  const modeBar = h('div', { class: 'segmented' });
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
            },
          },
          t.modes[m] ?? m,
        ),
      ),
    );
  renderModes();

  // --- 2. header: back, bolt, title + time, combo
  const timeEl = h('span', { class: 'time' }, '00:00');
  const totalEl = h('span', { class: 'time total' }, ` / ${mmss(game.transport.secondsBetween(0, song.lengthBeats))}`);
  const comboNum = h('div', { class: 'combo-num' }, '0');
  const comboCard = h('div', { class: 'combo-card' }, comboNum, h('div', { class: 'combo-label' }, t.combo));
  const pointsEl = h('div', { class: 'points' }, '0');
  const tempoVal = h('span', { class: 'val' }, `${Math.round(song.bpm * s.rate)} ${t.bpm}`);
  const header = h(
    'div',
    { class: 'playbar' },
    h('button', { class: 'icon-btn', 'aria-label': t.back, onclick: () => { teardown(); ctx.go.setup(song); } }, '‹'),
    bolt('small'),
    h('div', { class: 'play-title' }, h('div', { class: 'song-title' }, song.title), h('div', { class: 'row tight' }, timeEl, totalEl)),
    h('div', { class: 'col-right' }, comboCard, pointsEl),
  );

  // --- 2b. section chips: tap to loop a section (jumps to its count-in), tap again to clear
  const sectionChips = new Map<Section | null, HTMLButtonElement>();
  let looped: Section | null = null;
  let currentChip: HTMLButtonElement | null = null;
  const barOf = (beat: number) => Math.floor(beat / song.beatsPerBar) + song.firstBar;
  const chooseSection = (sec: Section | null) => {
    looped = sec && looped === sec ? null : sec;
    game.loopSection(looped);
    sectionChips.forEach((chip, key) => chip.classList.toggle('active', key === looped || (looped === null && key === null)));
    updatePlayBtn();
    refreshScore();
  };
  const sectionStrip = song.sections.length
    ? h(
        'div',
        { class: 'sections', role: 'tablist', 'aria-label': t.sections },
        [null, ...song.sections].map((sec) => {
          const chip = h(
            'button',
            { class: `chip-sec ${sec ? sec.kind : 'all active'}`, onclick: () => chooseSection(sec) },
            h('span', { class: 'sec-name' }, sec ? sec.name : t.wholeSong),
            sec ? h('span', { class: 'sec-bar' }, String(barOf(sec.startBeat))) : null,
          );
          sectionChips.set(sec, chip);
          return chip;
        }),
      )
    : null;
  const refreshCurrentSection = () => {
    if (!song.sections.length) return;
    const beat = game.transport.currentBeat();
    // innermost section containing the playhead: prefer inserts over parts
    let cur: Section | null = null;
    for (const sec of song.sections) if (beat >= sec.startBeat && beat < sec.endBeat && (!cur || sec.kind === 'insert' || cur.kind !== 'insert')) cur = sec;
    const chip = cur ? sectionChips.get(cur) ?? null : null;
    if (chip === currentChip) return;
    currentChip?.classList.remove('current');
    currentChip = chip;
    if (chip) {
      chip.classList.add('current');
      chip.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  };

  const refreshScore = () => {
    comboNum.textContent = String(game.score.streak);
    pointsEl.textContent = String(game.score.points);
    comboCard.classList.toggle('hot', game.score.streak >= 10);
  };
  const refreshTime = () => {
    const tr = game.transport;
    const beat = Math.min(Math.max(tr.currentBeat(), 0), song.lengthBeats);
    timeEl.textContent = mmss(tr.secondsBetween(0, beat));
    totalEl.textContent = ` / ${mmss(tr.secondsBetween(0, song.lengthBeats))}`;
    tempoVal.textContent = `${Math.round(tr.currentBpm * tr.rate)} ${t.bpm}`;
    refreshCurrentSection();
  };
  const clock = setInterval(refreshTime, 200);

  // --- 3. highway with drag-to-scroll
  const canvas = h('canvas', { class: 'highway', 'aria-label': t.position });
  let scrubFrom = 0;
  const scrubStart = () => {
    // dragging pauses; the song stays paused after release so several drags can home in on a spot
    if (game.isPlaying) game.pause();
    scrubFrom = game.transport.currentBeat();
    updatePlayBtn();
  };
  const scrubMove = (deltaBeats: number) => {
    const beat = Math.min(song.lengthBeats, Math.max(0, scrubFrom + deltaBeats));
    game.transport.seek(beat);
    refreshTime();
  };
  const scrubEnd = () => {
    game.seek(game.transport.currentBeat());
    refreshScore();
    updatePlayBtn();
  };

  // --- 4. tappable lane labels
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

  // --- 5. pads with the pause button in the middle
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
  const playBtn = h('button', { class: 'pause-btn', 'aria-label': t.pause }, '❚❚');
  const updatePlayBtn = () => {
    const playing = game.isPlaying;
    playBtn.textContent = playing ? '❚❚' : '▶';
    playBtn.setAttribute('aria-label', playing ? t.pause : game.transport.state === 'paused' ? t.resume : t.play);
    playBtn.classList.toggle('playing', playing);
  };
  playBtn.onclick = () => {
    if (game.isPlaying) game.pause();
    else if (game.transport.state === 'paused') game.resume();
    else start();
    updatePlayBtn();
  };

  game.onHit = (e) => {
    highway?.flash(myLane(), e.verdict, e.points);
    refreshScore();
  };

  function switchLine(id: string) {
    if (id === game.myLineId) return;
    highway?.beginLaneTransition();
    game.setMyLine(id);
    s.lastLine[song.slug] = id;
    ctx.save();
    layoutLabels();
    paintTaps();
    refreshScore();
  }

  // --- 6. tempo slider + metronome toggle
  const bpmOf = (rate: number) => Math.round(song.bpm * rate);
  const tempo = h('input', { type: 'range', min: String(bpmOf(0.4)), max: String(bpmOf(1.2)), step: '1', value: String(bpmOf(s.rate)) }) as HTMLInputElement;
  tempo.oninput = () => {
    const rate = Number(tempo.value) / song.bpm;
    game.setRate(rate);
    s.rate = rate;
    ctx.save();
    refreshTime();
  };
  const metroBtn = h('button', { class: `icon-toggle ${s.metronome ? 'on' : ''}`, 'aria-label': t.metronome, 'aria-pressed': String(s.metronome) });
  metroBtn.innerHTML = METRONOME_SVG;
  metroBtn.onclick = () => {
    s.metronome = !s.metronome;
    ctx.save();
    game.setMetronome(s.metronome);
    metroBtn.classList.toggle('on', s.metronome);
    metroBtn.setAttribute('aria-pressed', String(s.metronome));
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
    modeBar,
    header,
    sectionStrip,
    h('div', { class: 'highway-wrap' }, canvas),
    labels,
    h('div', { class: 'taps' }, left, playBtn, right),
    h('div', { class: 'row tempo-row' }, h('span', {}, t.tempo), tempo, tempoVal, metroBtn),
  );

  requestAnimationFrame(() => {
    highway = new Highway(canvas, game, instruments, {
      visibleBars: s.visibleBars,
      hideNotes: s.hideNotes,
      noteScale: NOTE_SCALE,
      onScrubStart: scrubStart,
      onScrub: scrubMove,
      onScrubEnd: scrubEnd,
    });
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
