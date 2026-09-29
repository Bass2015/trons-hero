/**
 * Dev-only mock: the play screen frozen at a chosen position, with sliders for
 * the song position and the note size. Not part of the production build.
 * Open http://localhost:5173/trons-hero/mock.html while `npm run dev` runs.
 */
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import './style.css';
import { AudioEngine } from './audio/engine';
import { Game } from './game/game';
import { setLang, t } from './i18n/index';
import { Highway } from './render/highway';
import { laneOrder } from './render/laneOrder';
import { INSTRUMENTS, instrumentFor } from './song/instruments';
import type { Line, Note, Song } from './song/types';
import { bolt, logo } from './ui/brand';
import { h, icon, mmss } from './ui/index';

setLang('ca');

// --- a dense synthetic song with the whole lineup ------------------------------
const BARS = 8;
const BPB = 4;
const pattern = (id: string, hits: number[]): Line => {
  const inst = INSTRUMENTS.find((i) => i.id === id)!;
  const notes: Note[] = [];
  for (let bar = 0; bar < BARS; bar++) for (const b of hits) notes.push({ lineId: id, beat: bar * BPB + b, durationBeats: 0.1, velocity: 1 });
  return { id, name: inst.name, file: '', sound: inst.sound, notes };
};
const song: Song = {
  slug: 'mock',
  title: 'Samba del Baró',
  bpm: 120,
  beatsPerBar: BPB,
  lengthBeats: BARS * BPB,
  firstBar: 1,
  baseUrl: '',
  lines: [
    pattern('surdo', [0, 2]),
    pattern('contra', [1, 3]),
    pattern('goliat', [0, 1.5, 2, 3.5]),
    pattern('mig', [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]),
    pattern('repe', [0, 0.75, 1.5, 2, 2.75, 3.5]),
    pattern('caixa', Array.from({ length: 16 }, (_, i) => i / 4)),
  ],
};
const MY = 'caixa';
const instruments = song.lines.map((l, i) => instrumentFor(l, i));
const myLane = song.lines.findIndex((l) => l.id === MY);
const mine = instruments[myLane]!;

// --- game frozen at a position -------------------------------------------------
const engine = new AudioEngine(); // never unlocked: no sound
const game = new Game(engine, song, MY, { offsetMs: 0, metronome: false, rate: 1, mode: 'practicar' });
const seek = (beat: number) => {
  game.transport.play(beat);
  game.transport.pause();
};
seek(4.5);

// --- screen ---------------------------------------------------------------------
const canvas = h('canvas', { class: 'highway' });
const labels = h(
  'div',
  { class: 'lane-labels' },
  laneOrder(instruments.length, myLane).map((i) => {
    const inst = instruments[i]!;
    const el = h('div', { class: `lane-label ${i === myLane ? 'mine' : ''}` }, icon(inst.icon, 'lane-icon'), h('span', {}, inst.name));
    el.style.color = inst.color;
    el.style.flex = String(i === myLane ? 1.6 : 1);
    return el;
  }),
);
const left = h('button', { class: 'tap-btn left' }, h('span', {}, t.left), h('kbd', {}, 'V'));
const right = h('button', { class: 'tap-btn right' }, h('span', {}, t.right), h('kbd', {}, 'N'));
left.style.setProperty('--c', mine.color);
right.style.setProperty('--c', mine.color);

const playbar = h(
  'div',
  { class: 'playbar' },
  h('button', { class: 'icon-btn round' }, '❚❚'),
  bolt('small'),
  h(
    'div',
    { class: 'play-title' },
    h('div', { class: 'song-title' }, song.title),
    h('div', { class: 'row tight' }, h('span', { class: 'time' }, '00:09'), h('span', { class: 'time total' }, ` / ${mmss((song.lengthBeats * 60) / song.bpm)}`), h('div', { class: 'progress' }, h('div', { class: 'progress-fill', style: { width: '28%' } }))),
  ),
  h('div', { class: 'col-right' }, h('div', { class: 'combo-card hot' }, h('div', { class: 'combo-num' }, '24'), h('div', { class: 'combo-label' }, t.combo)), h('div', { class: 'points' }, '3450')),
);

// --- sliders ----------------------------------------------------------------------
const START_SCALE = 0.5;
const posVal = h('strong', { class: 'mock-val' }, '');
const pos = h('input', { type: 'range', min: '0', max: String(song.lengthBeats), step: '0.05', value: '4.5' }) as HTMLInputElement;
const sizeVal = h('strong', { class: 'mock-val big' }, START_SCALE.toFixed(2));
const size = h('input', { type: 'range', min: '0.3', max: '1.2', step: '0.05', value: String(START_SCALE) }) as HTMLInputElement;
const px = h('span', { class: 'hint small' }, '');

let highway: Highway | null = null;
const refresh = () => {
  const beat = Number(pos.value);
  seek(beat);
  posVal.textContent = `compàs ${Math.floor(beat / BPB) + 1} · pols ${(beat % BPB + 1).toFixed(2)}  (beat ${beat.toFixed(2)})`;
  const scale = Number(size.value);
  if (highway) highway.opts.noteScale = scale;
  sizeVal.textContent = scale.toFixed(2);
  // pixel widths at the strike line
  const total = instruments.length - 1 + 1.6;
  const w = canvas.getBoundingClientRect().width;
  const mineW = ((w * 1.6) / total) * 0.7 * scale;
  const otherW = (w / total) * 0.62 * scale;
  px.textContent = `amplada a la línia: Caixa ${mineW.toFixed(0)} px · altres ${otherW.toFixed(0)} px (alçada = 42 % de l'amplada)`;
};
pos.oninput = refresh;
size.oninput = refresh;

const controls = h(
  'section',
  { class: 'mock-controls' },
  h('h3', { class: 'caps' }, 'Posició'),
  h('label', { class: 'row' }, pos),
  posVal,
  h('h3', { class: 'caps' }, 'Mida de les notes (noteScale)'),
  h('label', { class: 'row' }, size, sizeVal),
  px,
);

const style = document.createElement('style');
style.textContent = `
  .mock-val { font-family: var(--display); font-size: 16px; }
  .mock-val.big { font-size: 34px; color: var(--orange); min-width: 80px; text-align: right; }
  .mock-controls { margin-top: 4px; }
  .screen.mock { overflow-y: auto; }
  .mock .highway-wrap { flex: none; height: 46vh; }
  .mock .logo-wrap .logo-img { max-height: 64px; filter: none; }
`;
document.head.append(style);

document.getElementById('app')!.append(
  h(
    'div',
    { class: 'screen play mock' },
    logo(),
    playbar,
    h('div', { class: 'highway-wrap' }, canvas),
    labels,
    h('div', { class: 'taps' }, left, right),
    controls,
  ),
);

requestAnimationFrame(() => {
  highway = new Highway(canvas, game, instruments, { visibleSeconds: 1.6, hideNotes: false, noteScale: START_SCALE });
  highway.start();
  refresh();
});
