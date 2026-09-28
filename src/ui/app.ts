import { AudioEngine } from '../audio/engine';
import { listSongs, loadSong } from '../song/loader';
import type { Song } from '../song/types';
import { loadSettings, saveSettings, type Settings } from '../state/settings';
import { t } from '../i18n/es';
import { h, mount } from './dom';
import { header, laneColor } from './common';
import { playScreen } from './play';
import { settingsScreen } from './settings';

export interface AppContext {
  root: HTMLElement;
  engine: AudioEngine;
  settings: Settings;
  save(): void;
  go: {
    songs(): void;
    lines(song: Song): void;
    play(song: Song, lineId: string): void;
    settings(back: () => void): void;
  };
}

export function startApp(root: HTMLElement) {
  const settings = loadSettings();
  let engine: AudioEngine | null = null;

  const ctx: AppContext = {
    root,
    get engine() {
      if (!engine) throw new Error('Audio no iniciado');
      return engine;
    },
    settings,
    save: () => saveSettings(settings),
    go: {
      songs: () => void showSongs(),
      lines: (song) => showLines(song),
      play: (song, lineId) => {
        settings.lastSong = song.slug;
        settings.lastLine[song.slug] = lineId;
        saveSettings(settings);
        mount(root, playScreen(ctx, song, lineId));
      },
      settings: (back) => mount(root, settingsScreen(ctx, back)),
    },
  };

  const showStart = () => {
    const btn = h(
      'button',
      {
        class: 'big-btn',
        onclick: async () => {
          btn.disabled = true;
          engine = new AudioEngine();
          await engine.unlock();
          await showSongs();
        },
      },
      t.tapToStart,
    );
    mount(
      root,
      h(
        'div',
        { class: 'screen center' },
        h('h1', { class: 'logo' }, t.appName),
        btn,
        h('p', { class: 'hint' }, t.startHint),
        isIos() && !isStandalone() ? h('p', { class: 'hint' }, t.installHint) : null,
      ),
    );
  };

  const showSongs = async () => {
    mount(root, h('div', { class: 'screen center' }, h('p', {}, t.loading)));
    try {
      const songs = await listSongs();
      mount(
        root,
        h(
          'div',
          { class: 'screen' },
          header(t.chooseSong, null, () => ctx.go.settings(() => void showSongs())),
          h(
            'div',
            { class: 'list' },
            songs.map((s) =>
              h(
                'button',
                {
                  class: 'list-btn',
                  onclick: async () => {
                    mount(root, h('div', { class: 'screen center' }, h('p', {}, t.loading)));
                    const song = await loadSong(s.slug);
                    await ctx.engine.loadSong(song);
                    showLines(song);
                  },
                },
                s.title,
              ),
            ),
          ),
        ),
      );
    } catch (e) {
      mount(root, h('div', { class: 'screen center' }, h('h2', {}, t.error), h('p', { class: 'hint' }, String(e))));
    }
  };

  const showLines = (song: Song) => {
    mount(
      root,
      h(
        'div',
        { class: 'screen' },
        header(t.chooseLine, () => void showSongs()),
        h('p', { class: 'hint' }, song.title),
        h(
          'div',
          { class: 'list' },
          song.lines.map((l, i) =>
            h(
              'button',
              { class: 'list-btn', style: { borderLeftColor: laneColor(i) }, onclick: () => ctx.go.play(song, l.id) },
              l.name,
            ),
          ),
        ),
      ),
    );
  };

  showStart();
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
