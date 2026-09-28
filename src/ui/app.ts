import { AudioEngine } from '../audio/engine';
import type { Score } from '../game/score';
import { detectLang, setLang, t } from '../i18n/index';
import { instrumentFor } from '../song/instruments';
import { listSongs, loadSong } from '../song/loader';
import type { Song } from '../song/types';
import { loadSettings, saveSettings, type Settings } from '../state/settings';
import { BOLT_SVG, logo } from './brand';
import { h, header, icon, mmss, mount } from './index';
import { playScreen } from './play';
import { resultsScreen } from './results';
import { settingsPanel } from './settings';
import { setupScreen } from './setup';

export type HomeTab = 'songs' | 'settings';

export interface AppContext {
  root: HTMLElement;
  engine: AudioEngine;
  settings: Settings;
  save(): void;
  go: {
    home(tab?: HomeTab): void;
    setup(song: Song): void;
    play(song: Song, lineId: string): void;
    results(song: Song, lineId: string, score: Score): void;
  };
}

export function startApp(root: HTMLElement) {
  const settings = loadSettings();
  setLang(settings.lang ?? detectLang());
  let engine: AudioEngine | null = null;
  let songs: Song[] = [];

  const ctx: AppContext = {
    root,
    get engine() {
      if (!engine) throw new Error('Audio not started');
      return engine;
    },
    settings,
    save: () => saveSettings(settings),
    go: {
      home: (tab = 'songs') => showHome(tab),
      setup: (song) => mount(root, setupScreen(ctx, song)),
      play: (song, lineId) => {
        settings.lastSong = song.slug;
        settings.lastLine[song.slug] = lineId;
        saveSettings(settings);
        mount(root, playScreen(ctx, song, lineId));
      },
      results: (song, lineId, score) => mount(root, resultsScreen(ctx, song, lineId, score)),
    },
  };

  // --- splash: load the song list while showing the logo, then wait for the gesture that unlocks audio
  const showSplash = () => {
    const bar = h('div', { class: 'progress' }, h('div', { class: 'progress-fill' }));
    const status = h('p', { class: 'hint caps' }, t.loading);
    const startBtn = h('button', { class: 'big-btn hidden' }, t.tapToStart);
    startBtn.onclick = async () => {
      startBtn.disabled = true;
      engine = new AudioEngine();
      await engine.unlock();
      showHome('songs');
    };
    mount(
      root,
      h(
        'div',
        { class: 'screen splash' },
        h('div', { class: 'splash-glow' }),
        logo('splash-logo'),
        bar,
        status,
        startBtn,
        h('p', { class: 'hint small' }, t.startHint),
        isIos() && !isStandalone() ? h('p', { class: 'hint small' }, t.installHint) : null,
      ),
    );
    listSongs()
      .then((list) => {
        songs = list;
        bar.classList.add('done');
        status.classList.add('hidden');
        startBtn.classList.remove('hidden');
      })
      .catch((e) => {
        status.textContent = `${t.error}: ${String(e)}`;
      });
  };

  // --- home: tabs
  const showHome = (tab: HomeTab) => {
    const tabs = h(
      'div',
      { class: 'tabs' },
      (['songs', 'settings'] as HomeTab[]).map((k) =>
        h('button', { class: `tab ${k === tab ? 'active' : ''}`, onclick: () => showHome(k) }, t[k]),
      ),
    );
    const body = tab === 'songs' ? songList() : settingsPanel(ctx, () => showHome('settings'));
    mount(root, h('div', { class: 'screen home' }, h('div', { class: 'home-header' }, logo('home-logo'), tabs), body));
  };

  const songList = () =>
    h(
      'div',
      { class: 'list' },
      songs.map((song) => {
        const first = instrumentFor(song.lines[0] ?? { id: 'x', name: '' }, 0);
        const thumb = icon(BOLT_SVG, 'thumb');
        thumb.style.background = `linear-gradient(135deg, ${first.color}, #0b0b10 90%)`;
        return h(
          'button',
          {
            class: 'song-row',
            onclick: async () => {
              mount(root, h('div', { class: 'screen center' }, h('p', { class: 'hint caps' }, t.loading)));
              await ctx.engine.loadSong(song);
              ctx.go.setup(song);
            },
          },
          thumb,
          h('div', { class: 'song-meta' }, h('div', { class: 'song-title' }, song.title), h('div', { class: 'hint small' }, `${t.groupName} · ${song.lines.length} ${t.lines}`)),
          h('div', { class: 'song-dur' }, mmss((song.lengthBeats * 60) / song.bpm)),
        );
      }),
    );

  showSplash();

  // keep the loader in scope for a manual refresh if a song fails
  void loadSong;
  void header;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
