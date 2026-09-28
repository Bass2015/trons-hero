import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

const BG = '#0b0b10';
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname;
mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true });

const candidates = ['bolt.svg', 'bolt.png'].map((f) => new URL(`../public/branding/${f}`, import.meta.url));
const boltFile = candidates.find((u) => existsSync(u));
const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url));

/** Dark square with the bolt centred at ~72% of the size, so maskable icons keep their margins. */
async function icon(size) {
  if (boltFile) {
    const inner = Math.round(size * 0.72);
    const bolt = await sharp(readFileSync(boltFile), { limitInputPixels: false }).resize(inner, inner, { fit: 'inside' }).png().toBuffer();
    return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
      .composite([{ input: bolt, gravity: 'centre' }])
      .png();
  }
  return sharp(svg).resize(size, size).png();
}

await Promise.all([
  icon(192).then((i) => i.toFile(out('icon-192.png'))),
  icon(512).then((i) => i.toFile(out('icon-512.png'))),
  icon(180).then((i) => i.toFile(out('apple-touch-icon.png'))),
]);
console.log(`icons generated from ${boltFile ? boltFile.pathname.split('/public/')[1] : 'icons/icon.svg'}`);
