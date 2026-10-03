#!/usr/bin/env node
// Build the site icons in public/ from scripts/icon-source.jpg (the GitHub profile picture).
// Run `node scripts/make-icons.mjs` after replacing the source image.
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const SOURCE = 'scripts/icon-source.jpg';
const { width, height } = await sharp(SOURCE).metadata();
const side = Math.min(width, height);
const square = () =>
	sharp(SOURCE).extract({
		left: Math.floor((width - side) / 2),
		top: Math.floor((height - side) / 2),
		width: side,
		height: side,
	});
const png = (size) => square().resize(size, size, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer();

await writeFile('public/favicon-32.png', await png(32));
await writeFile('public/favicon-192.png', await png(192));
await writeFile('public/apple-touch-icon.png', await png(180));

// favicon.ico for older browsers: an ICO container holding 32px and 48px PNGs.
const sizes = [32, 48];
const images = await Promise.all(sizes.map(png));
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(images.length, 4);
let offset = 6 + 16 * images.length;
const entries = images.map((img, i) => {
	const e = Buffer.alloc(16);
	e.writeUInt8(sizes[i], 0); // width
	e.writeUInt8(sizes[i], 1); // height
	e.writeUInt16LE(1, 4); // colour planes
	e.writeUInt16LE(32, 6); // bits per pixel
	e.writeUInt32LE(img.length, 8);
	e.writeUInt32LE(offset, 12);
	offset += img.length;
	return e;
});
await writeFile('public/favicon.ico', Buffer.concat([header, ...entries, ...images]));
console.log('Wrote favicon.ico, favicon-32.png, favicon-192.png, apple-touch-icon.png');
