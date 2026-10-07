#!/usr/bin/env node
// Before a build, make sure every album cover URL (src/data/albums.json) and recipe photo URL
// (the `photo:` line in src/content/recipes/*.md) still works.
// URLs that fail are written to src/data/broken-covers.json and the site shows the placeholder instead,
// so one dead link can never break the nightly build.
import { readdir, readFile, writeFile } from 'node:fs/promises';

const OUT = 'src/data/broken-covers.json';
const albums = JSON.parse(await readFile('src/data/albums.json', 'utf8'));

const RECIPES = 'src/content/recipes';
const recipePhotos = [];
for (const file of (await readdir(RECIPES).catch(() => [])).filter((f) => f.endsWith('.md'))) {
	const front = (await readFile(`${RECIPES}/${file}`, 'utf8')).match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
	const url = front.match(/^photo:\s*["']?([^"'\s]+)["']?\s*$/m)?.[1];
	if (url) recipePhotos.push(url);
}

const urls = [...new Set([...albums.map((a) => a.cover), ...recipePhotos].filter(Boolean))];

const broken = [];
for (const url of urls) {
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
		const type = res.headers.get('content-type') ?? '';
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		if (!type.startsWith('image/')) throw new Error(`not an image (${type || 'no content-type'})`);
		await res.body?.cancel();
	} catch (err) {
		broken.push(url);
		console.warn(`Cover failed, using the placeholder: ${url}\n  ${err.message}`);
	}
}

await writeFile(OUT, JSON.stringify(broken, null, '\t') + '\n');
console.log(`Covers: ${urls.length - broken.length}/${urls.length} OK`);
