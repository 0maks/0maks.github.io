#!/usr/bin/env node
// Draw the default social preview image (public/og.png, 1200x630). Run `node scripts/make-og.mjs` to redo it.
import sharp from 'sharp';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
	<rect width="1200" height="630" fill="#f6f4ee"/>
	<rect x="72" y="72" width="1056" height="10" fill="#111110"/>
	<text x="72" y="335" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="800" font-size="168" letter-spacing="-8" fill="#111110">Max</text>
	<text x="72" y="495" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="800" font-size="168" letter-spacing="-8" fill="#e1251b">Exposure</text>
	<text x="1128" y="580" text-anchor="end" font-family="Menlo, Courier New, monospace" font-size="30" letter-spacing="2" fill="#6a6862">MUSIC · PHOTOS · YAP</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('public/og.png');
console.log('Wrote public/og.png');
