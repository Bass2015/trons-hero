import { t } from '../i18n/es';
import type { AppContext } from './app';
import { h, header } from './index';

/** Calibration offset with a tap-along test, and scroll speed. */
export function settingsScreen(ctx: AppContext, back: () => void): HTMLElement {
  const s = ctx.settings;
  const engine = ctx.engine;

  const offsetVal = h('span', { class: 'val' }, `${s.offsetMs} ${t.ms}`);
  const offset = h('input', { type: 'range', min: '-200', max: '200', step: '5', value: String(s.offsetMs) }) as HTMLInputElement;
  offset.oninput = () => {
    s.offsetMs = Number(offset.value);
    offsetVal.textContent = `${s.offsetMs} ${t.ms}`;
    ctx.save();
  };

  const speedVal = h('span', { class: 'val' }, `${s.visibleSeconds.toFixed(1)} s`);
  const speed = h('input', { type: 'range', min: '0.8', max: '3', step: '0.1', value: String(s.visibleSeconds) }) as HTMLInputElement;
  speed.oninput = () => {
    s.visibleSeconds = Number(speed.value);
    speedVal.textContent = `${s.visibleSeconds.toFixed(1)} s`;
    ctx.save();
  };

  // --- tap test: metronome at 100 bpm, measure the mean tap offset
  const BPM = 100;
  const spb = 60 / BPM;
  let timer: ReturnType<typeof setInterval> | null = null;
  let nextClick = 0;
  const deltas: number[] = [];
  const measured = h('strong', {}, '—');
  const useBtn = h('button', { class: 'ctl-btn', disabled: true }, t.useMeasured);
  const testBtn = h('button', { class: 'tap-btn test' }, t.calibrationTest);

  const startTest = () => {
    deltas.length = 0;
    nextClick = engine.now + 0.5;
    timer = setInterval(() => {
      while (nextClick < engine.now + 0.15) {
        engine.playClick(nextClick, false);
        nextClick += spb;
      }
    }, 25);
  };
  const stopTest = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  testBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!timer) {
      startTest();
      return;
    }
    // distance from the tap to the nearest click, positive = late
    const heard = engine.now - engine.outputLatency;
    const phase = ((heard - nextClick) % spb + spb) % spb; // time since last click
    const delta = phase > spb / 2 ? phase - spb : phase;
    deltas.push(delta * 1000);
    if (deltas.length > 12) deltas.shift();
    if (deltas.length >= 4) {
      const mean = Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
      measured.textContent = `${mean} ${t.ms}`;
      useBtn.disabled = false;
      useBtn.onclick = () => {
        s.offsetMs = Math.max(-200, Math.min(200, Math.round(mean / 5) * 5));
        offset.value = String(s.offsetMs);
        offsetVal.textContent = `${s.offsetMs} ${t.ms}`;
        ctx.save();
      };
    }
  });

  return h(
    'div',
    { class: 'screen' },
    header(t.settings, () => { stopTest(); back(); }),
    h('section', {},
      h('h3', {}, t.calibration),
      h('p', { class: 'hint small' }, t.calibrationHelp),
      h('label', { class: 'row' }, offset, offsetVal),
      testBtn,
      h('p', {}, `${t.calibrationMeasured}: `, measured, ' ', useBtn),
    ),
    h('section', {},
      h('h3', {}, t.scrollSpeed),
      h('label', { class: 'row' }, h('span', {}, t.fast), speed, h('span', {}, t.slow), speedVal),
    ),
  );
}
