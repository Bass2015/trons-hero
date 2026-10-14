import { Game } from '../game/game';
import { MODES, type Mode } from '../game/modes';
import { t } from '../i18n/index';
import { bindTaps } from '../input/taps';
import { Highway } from '../render/highway';
import { instrumentFor } from '../song/instruments';
import { EXTRAS_KEY, mixColumns, volumeOf } from '../song/mix';
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

  // --- 0. mixer levels: global per instrument, applied on top of the mode's mutes
  const columns = mixColumns(song, t.extras);
  const extrasCol = columns.find((c) => c.key === EXTRAS_KEY) ?? null;
  const applyVolumes = () => {
    for (const col of columns) for (const id of col.lineIds) ctx.engine.setLineVolume(id, volumeOf(s, col.key));
  };
  applyVolumes();

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
  // the strip never scrolls on its own while the user is touching it (a scroll under the finger eats the tap)
  let stripBusyUntil = 0;
  const markStripBusy = () => {
    stripBusyUntil = performance.now() + 1500;
  };
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
  const sectionStrip: HTMLElement | null = song.sections.length
    ? h(
        'div',
        { class: 'sections', role: 'tablist', 'aria-label': t.sections, onpointerdown: markStripBusy, onscroll: markStripBusy },
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
    // the looped section wins while the playhead is inside it; otherwise the innermost section (inserts over parts)
    let cur: Section | null = null;
    if (looped && beat >= looped.startBeat && beat < looped.endBeat) cur = looped;
    else for (const sec of song.sections) if (beat >= sec.startBeat && beat < sec.endBeat && (!cur || sec.kind === 'insert' || cur.kind !== 'insert')) cur = sec;
    const chip = cur ? sectionChips.get(cur) ?? null : null;
    if (chip === currentChip) return;
    currentChip?.classList.remove('current');
    currentChip = chip;
    if (!chip) return;
    chip.classList.add('current');
    if (performance.now() < stripBusyUntil || !sectionStrip) return;
    const r = chip.getBoundingClientRect();
    const sr = sectionStrip.getBoundingClientRect();
    if (r.left < sr.left + 8 || r.right > sr.right - 8) chip.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
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

  // --- 4. tappable lane labels; drag up on the strip to open the mixer, drag down to close it
  const labelEls = instruments.map((inst, i) => {
    const el = h('button', { class: 'lane-label', onclick: () => switchLine(lanes[i]!.id) }, icon(inst.icon, 'lane-icon'), h('span', {}, inst.name));
    el.style.color = inst.color;
    return el;
  });
  // the extras column only exists while the mixer is open: it has no lane, so it gets a label of its own
  const extrasLabel = extrasCol ? h('div', { class: 'lane-label extra' }, icon(extrasCol.icon, 'lane-icon'), h('span', {}, extrasCol.name)) : null;
  if (extrasLabel && extrasCol) extrasLabel.style.color = extrasCol.color;

  let mixerOpen = false;
  let stripDrag: { id: number; startY: number; dragged: boolean } | null = null;
  let swallowClick = false;
  const STRIP_DRAG_PX = 12;
  const labels = h(
    'div',
    {
      class: 'lane-labels',
      title: t.mixerHint,
      onpointerdown: (e: PointerEvent) => {
        swallowClick = false;
        stripDrag = { id: e.pointerId, startY: e.clientY, dragged: false };
        // capture on the pressed label (not the strip) so a plain tap still clicks the button
        (e.target as Element).setPointerCapture?.(e.pointerId);
      },
      onpointermove: (e: PointerEvent) => {
        if (!stripDrag || e.pointerId !== stripDrag.id) return;
        const dy = e.clientY - stripDrag.startY;
        if (Math.abs(dy) < STRIP_DRAG_PX) return;
        stripDrag.dragged = true;
        if (dy < 0) openMixer();
        else closeMixer();
      },
      onpointerup: (e: PointerEvent) => {
        if (!stripDrag || e.pointerId !== stripDrag.id) return;
        swallowClick = stripDrag.dragged;
        stripDrag = null;
      },
      onpointercancel: () => {
        stripDrag = null;
      },
    },
    labelEls,
    extrasLabel,
  );
  // a drag must not also switch lines: eat the click that follows it
  labels.addEventListener(
    'click',
    (e) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
    },
    true,
  );

  /** Column boxes in % of the strip width: lanes follow the highway; the extras column, when shown, takes a slot at the right. */
  const columnGeom = (): { x0: number; w: number }[] | null => {
    const layout = highway?.targetLayout(100);
    if (!layout) return null;
    const n = lanes.length;
    const slots = n + (mixerOpen && extrasCol ? 1 : 0);
    const k = n / slots;
    const out = layout.map((g) => ({ x0: g.x0 * k, w: g.w * k }));
    if (slots > n) out.push({ x0: 100 * k, w: 100 / slots });
    return out;
  };
  const place = (el: HTMLElement, g: { x0: number; w: number } | undefined) => {
    if (!g) return;
    el.style.left = `${g.x0}%`;
    el.style.width = `${g.w}%`;
  };
  const layoutLabels = () => {
    const geom = columnGeom();
    labelEls.forEach((el, i) => {
      place(el, geom?.[i]);
      el.classList.toggle('mine', i === myLane());
    });
    if (extrasLabel) place(extrasLabel, geom?.[lanes.length]);
    faderEls.forEach((el, i) => {
      place(el, geom?.[i]);
      el.classList.toggle('mine', i === myLane());
    });
  };

  // --- 4b. mixer: one vertical fader per column, aligned under its label
  const faderEls = columns.map((col) => {
    const fill = h('div', { class: 'fader-fill' });
    const val = h('span', { class: 'fader-val' });
    const track = h('div', { class: 'fader-track' }, fill);
    const el = h('div', { class: 'fader', role: 'slider', 'aria-label': col.name, 'aria-valuemin': '0', 'aria-valuemax': '100' }, track, val);
    el.style.setProperty('--c', col.color);
    const paint = () => {
      const v = volumeOf(s, col.key);
      el.style.setProperty('--v', String(v));
      el.setAttribute('aria-valuenow', String(Math.round(v * 100)));
      el.classList.toggle('off', v === 0);
      val.textContent = String(Math.round(v * 100));
    };
    paint();
    let drag: number | null = null;
    const setFromY = (clientY: number) => {
      const r = track.getBoundingClientRect();
      if (!r.height) return;
      const v = Math.min(1, Math.max(0, 1 - (clientY - r.top) / r.height));
      s.volumes[col.key] = Math.round(v * 100) / 100;
      applyVolumes();
      paint();
    };
    el.addEventListener('pointerdown', (e) => {
      if (drag !== null) return;
      drag = e.pointerId;
      el.setPointerCapture(e.pointerId);
      setFromY(e.clientY);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId === drag) setFromY(e.clientY);
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== drag) return;
      drag = null;
      ctx.save();
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    return el;
  });
  const mixPanel = h('div', { class: 'mixer', role: 'group', 'aria-label': t.mixer }, faderEls);
  function openMixer() {
    if (mixerOpen) return;
    mixerOpen = true;
    screen.classList.add('mixing');
    mixPanel.classList.add('open');
    layoutLabels();
  }
  function closeMixer() {
    if (!mixerOpen) return;
    mixerOpen = false;
    screen.classList.remove('mixing');
    mixPanel.classList.remove('open');
    layoutLabels();
  }

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
    mixPanel,
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
