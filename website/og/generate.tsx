import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

import Card, { HEIGHT, WIDTH } from './card';

const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const svg = await satori(<Card />, {
  width: WIDTH,
  height: HEIGHT,
  fonts: [
    { name: 'Nunito', weight: 800, style: 'normal', data: await readFile(local('./fonts/nunito-800.ttf')) },
    { name: 'DM Sans', weight: 800, style: 'normal', data: await readFile(local('./fonts/dm-sans-800.ttf')) },
    { name: 'IBM Plex Mono', weight: 500, style: 'normal', data: await readFile(local('./fonts/ibm-plex-mono-500.ttf')) }
  ]
});

const png = new Resvg(svg).render().asPng();
const out = process.argv[2] ?? local('../build/client/brand/og.png');

await writeFile(out, png);
console.log(`og card -> ${out} (${png.length} bytes)`);
