import { LANGS, getLang, setLang, t, type Lang } from '../i18n/index';
import type { AppContext } from './app';
import { h } from './index';

/** Settings tab content: language, calibration with a tap-along test, scroll speed. */
export function settingsPanel(ctx: AppContext, rerender: () => void): HTMLElement {
  const s = ctx.settings;
  const engine = ctx.engine;

  // --- language
  const langBar = h(
    'div',
    { class: 'segmented' },
    (Object.keys(LANGS) as Lang[]).map((l) =>
      h(
        'button',
        {
          class: l === getLang() ? 'active' : '',
          onclick: () => {
            setLang(l);
            s.lang = l;
            ctx.save();
            rerender();
          },
        },
        LANGS[l],
      ),
    ),
  );

  // --- calibration
  const offsetVal = h('span', { class: 'val' }, `${s.offsetMs} ${t.ms}`);
  const offset = h('input', { type: 'range', min: '-200', max: '200', step: '5', value: String(s.offsetMs) }) as HTMLInputElement;
  offset.oninput = () => {
    s.offsetMs = Number(offset.value);
    offsetVal.textContent = `${s.offsetMs} ${t.ms}`;
    ctx.save();
  };

  const BPM = 100;
  const spb = 60 / BPM;
  let timer: ReturnType<typeof setInterval> | null = null;
  let nextClick = 0;
  const deltas: number[] = [];
  const measured = h('strong', {}, '—');
  const useBtn = h('button', { class: 'ctl-btn', disabled: true }, t.useMeasured);
  const testBtn = h('button', { class: 'tap-btn test' }, t.calibrationTest);
  const stopTest = () => {
    if (timer) clearInterval(timer);
    timer = null;
    testBtn.classList.remove('running');
  };
  testBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!timer) {
      deltas.length = 0;
      nextClick = engine.now + 0.5;
      testBtn.classList.add('running');
      timer = setInterval(() => {
        while (nextClick < engine.now + 0.15) {
          engine.playClick(nextClick, false);
          nextClick += spb;
        }
      }, 25);
      return;
    }
    const heard = engine.now - engine.outputLatency;
    const phase = (((heard - nextClick) % spb) + spb) % spb;
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
        stopTest();
      };
    }
  });
  // stop the click when the panel is removed from the page
  const observer = new MutationObserver(() => {
    if (!document.body.contains(panel)) {
      stopTest();
      observer.disconnect();
    }
  });
  queueMicrotask(() => observer.observe(document.body, { childList: true, subtree: true }));

  // --- visible bars
  const barsVal = h('span', { class: 'val' }, String(s.visibleBars));
  const barsIn = h('input', { type: 'range', min: '1', max: '4', step: '0.5', value: String(s.visibleBars) }) as HTMLInputElement;
  barsIn.oninput = () => {
    s.visibleBars = Number(barsIn.value);
    barsVal.textContent = String(s.visibleBars);
    ctx.save();
  };

  const panel = h(
    'div',
    { class: 'panel' },
    h('section', {}, h('h3', { class: 'caps' }, t.language), langBar),
    h(
      'section',
      {},
      h('h3', { class: 'caps' }, t.calibration),
      h('p', { class: 'hint small' }, t.calibrationHelp),
      h('label', { class: 'row' }, offset, offsetVal),
      testBtn,
      h('p', { class: 'row' }, `${t.calibrationMeasured}: `, measured, h('span', { class: 'grow' }), useBtn),
    ),
    h('section', {}, h('h3', { class: 'caps' }, t.visibleBars), h('label', { class: 'row' }, barsIn, barsVal)),
  );
  return panel;
}
