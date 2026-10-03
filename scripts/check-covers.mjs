#!/usr/bin/env node
// Before a build, make sure every album cover URL in src/data/albums.json still works.
// URLs that fail are written to src/data/broken-covers.json and the site shows the placeholder cover
// for them, so one dead link can never break the nightly build.
import { readFile, writeFile } from 'node:fs/promises';

const OUT = 'src/data/broken-covers.json';
const albums = JSON.parse(await readFile('src/data/albums.json', 'utf8'));
const urls = [...new Set(albums.map((a) => a.cover).filter(Boolean))];

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
