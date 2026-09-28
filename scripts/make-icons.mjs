import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url));
mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true });
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname;

await Promise.all([
  sharp(svg).resize(192, 192).png().toFile(out('icon-192.png')),
  sharp(svg).resize(512, 512).png().toFile(out('icon-512.png')),
  sharp(svg).resize(180, 180).png().toFile(out('apple-touch-icon.png')),
]);
console.log('icons generated');
