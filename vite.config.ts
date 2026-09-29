import { defineConfig, type Plugin } from 'vite';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { VitePWA } from 'vite-plugin-pwa';

/** The Ableton project files are the songs' source of truth in the repo, but they are not needed by the app. */
function dropAbletonProjects(): Plugin {
  return {
    name: 'drop-ableton-projects',
    apply: 'build',
    closeBundle() {
      const songs = join('dist', 'songs');
      for (const slug of readdirSync(songs, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
        for (const f of readdirSync(join(songs, slug))) if (f.endsWith('.als') || f === 'import.json') rmSync(join(songs, slug, f));
      }
    },
  };
}

export default defineConfig({
  base: '/trons-hero/',
  plugins: [
    dropAbletonProjects(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png', 'branding/*'],
      manifest: {
        name: 'Trons del Baró',
        short_name: 'Trons',
        description: 'Practica les línies de la batucada tocant al ritme.',
        lang: 'ca',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0b10',
        theme_color: '#0b0b10',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,json,mid,wav,woff2}'],
        navigateFallback: '/trons-hero/index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0]);
