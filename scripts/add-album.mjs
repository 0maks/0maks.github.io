#!/usr/bin/env node
// Create an "album of the week" entry from the iTunes Search API (no key needed).
//
//   npm run add-album -- "Artist" "Album" [--week=2026-09-28] [--dry-run]
//
// Writes src/content/albums/<week>-<slug>.md and downloads the cover to src/assets/covers/<slug>.jpg.
// Fill in the blurb, highlights and any Bandcamp/Spotify links by hand afterwards.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const flags = Object.fromEntries(
	args.filter((a) => a.startsWith('--')).map((a) => {
		const [k, v = 'true'] = a.slice(2).split('=');
		return [k, v];
	}),
);
const [artist, album] = positional;

if (!artist || !album) {
	console.error('Usage: npm run add-album -- "Artist" "Album" [--week=YYYY-MM-DD] [--dry-run]');
	process.exit(1);
}

const DAY = 86_400_000;
const londonToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const mondayOf = (iso) => {
	const d = new Date(`${iso}T00:00:00Z`);
	return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);
};
const week = flags.week ?? mondayOf(londonToday);
if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
	console.error(`--week must look like 2026-09-28, got "${week}"`);
	process.exit(1);
}

const slug = `${artist}-${album}`
	.normalize('NFKD')
	.replace(/[̀-ͯ]/g, '')
	.toLowerCase()
	.replace(/[^a-z0-9]+/g, '-')
	.replace(/^-|-$/g, '');

const query = new URLSearchParams({ term: `${artist} ${album}`, entity: 'album', limit: '5', country: 'gb' });
const res = await fetch(`https://itunes.apple.com/search?${query}`);
if (!res.ok) throw new Error(`iTunes search failed: ${res.status}`);
const { results } = await res.json();
if (!results.length) {
	console.error('No matches found. Check the spelling, or create the file by hand.');
	process.exit(1);
}

const has = (a, b) => a.toLowerCase().includes(b.toLowerCase());
const match = results.find((r) => has(r.artistName, artist) && has(r.collectionName, album)) ?? results[0];

console.log('Candidates:');
for (const r of results) {
	console.log(`${r === match ? '→' : ' '} ${r.artistName} – ${r.collectionName} (${r.releaseDate?.slice(0, 4)})`);
}
if (flags['dry-run']) process.exit(0);

const file = `src/content/albums/${week}-${slug}.md`;
if (existsSync(file)) {
	console.error(`${file} already exists, not overwriting.`);
	process.exit(1);
}

const art = await fetch(match.artworkUrl100.replace(/\d+x\d+bb/, '1200x1200bb'));
if (!art.ok) throw new Error(`Cover download failed: ${art.status}`);
const buf = Buffer.from(await art.arrayBuffer());
const { dominant } = await sharp(buf).stats();
const colour = '#' + [dominant.r, dominant.g, dominant.b].map((n) => n.toString(16).padStart(2, '0')).join('');

await mkdir('src/assets/covers', { recursive: true });
await writeFile(`src/assets/covers/${slug}.jpg`, buf);

const q = (s) => JSON.stringify(s);
const lines = [
	'---',
	`title: ${q(match.collectionName.replace(/ - (EP|Single)$/, ''))}`,
	`artist: ${q(match.artistName)}`,
	`weekOf: ${week}`,
	`year: ${match.releaseDate.slice(0, 4)}`,
	`cover: ../../assets/covers/${slug}.jpg`,
	`colour: ${q(colour)}`,
	`tags: [${match.primaryGenreName ? q(match.primaryGenreName.toLowerCase()) : ''}]`,
	'# highlights:',
	'#   - "Track name"',
	'links:',
	`  appleMusic: ${match.collectionViewUrl.split('?')[0]}`,
	'#  bandcamp: https://',
	'#  spotify: https://',
	'---',
	'',
	'Why this one?',
	'',
];
await writeFile(file, lines.join('\n'));
console.log(`\nCreated ${file}\nCover:   src/assets/covers/${slug}.jpg (${(buf.length / 1024).toFixed(0)} KB), colour ${colour}`);
