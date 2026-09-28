import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/trons-hero/',
  plugins: [
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
        globPatterns: ['**/*.{js,css,html,svg,png,json,mid,wav,woff2}'],
        navigateFallback: '/trons-hero/index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0]);
