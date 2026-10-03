#!/usr/bin/env node
// Build the site icons in public/: a white "M" and a red "E" in Archivo ExtraBold (the site's heading
// font), on the site's near-black. The letters are turned into vector paths first, so the SVG icon
// needs no font and stays sharp at any size. Run `node scripts/make-icons.mjs` to rebuild.
import { readFile, writeFile } from 'node:fs/promises';
import opentype from 'opentype.js';
import sharp from 'sharp';

const BG = '#111110';
const WHITE = '#ffffff';
const RED = '#e1251b';
const SIZE = 512; // icon canvas
const TRACKING = -0.04; // em, same letter-spacing as the "Max Exposure" wordmark in the header

const file = await readFile('node_modules/@fontsource/archivo/files/archivo-latin-800-normal.woff');
const font = opentype.parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));

// Lay out "ME" at 1000px, then scale and centre the pair on the canvas.
const FS = 1000;
const advance = (ch) => (font.charToGlyph(ch).advanceWidth * FS) / font.unitsPerEm;
const m = font.getPath('M', 0, 0, FS);
const e = font.getPath('E', advance('M') + TRACKING * FS, 0, FS);
const [a, b] = [m.getBoundingBox(), e.getBoundingBox()];
const box = { x1: Math.min(a.x1, b.x1), x2: Math.max(a.x2, b.x2), y1: Math.min(a.y1, b.y1), y2: Math.max(a.y2, b.y2) };
const scale = (SIZE * 0.68) / (box.x2 - box.x1);
const tx = (SIZE - (box.x2 - box.x1) * scale) / 2 - box.x1 * scale;
const ty = (SIZE - (box.y2 - box.y1) * scale) / 2 - box.y1 * scale;

const icon = (radius) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">
<rect width="${SIZE}" height="${SIZE}" rx="${radius}" fill="${BG}"/>
<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})">
<path d="${m.toPathData(1)}" fill="${WHITE}"/>
<path d="${e.toPathData(1)}" fill="${RED}"/>
</g>
</svg>
`;

const rounded = icon(104); // browser tabs
const square = icon(0); // iOS rounds the corners itself, so give it a full square
const png = (svg, size) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

await writeFile('public/favicon.svg', rounded);
await writeFile('public/favicon-32.png', await png(rounded, 32));
await writeFile('public/favicon-192.png', await png(rounded, 192));
await writeFile('public/apple-touch-icon.png', await png(square, 180));

// favicon.ico for older browsers: an ICO container holding 32px and 48px PNGs.
const sizes = [32, 48];
const images = await Promise.all(sizes.map((s) => png(rounded, s)));
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(images.length, 4);
let offset = 6 + 16 * images.length;
const entries = images.map((img, i) => {
	const entry = Buffer.alloc(16);
	entry.writeUInt8(sizes[i], 0); // width
	entry.writeUInt8(sizes[i], 1); // height
	entry.writeUInt16LE(1, 4); // colour planes
	entry.writeUInt16LE(32, 6); // bits per pixel
	entry.writeUInt32LE(img.length, 8);
	entry.writeUInt32LE(offset, 12);
	offset += img.length;
	return entry;
});
await writeFile('public/favicon.ico', Buffer.concat([header, ...entries, ...images]));
console.log('Wrote favicon.svg, favicon.ico, favicon-32.png, favicon-192.png, apple-touch-icon.png');
