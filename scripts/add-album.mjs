#!/usr/bin/env node
// Create an "album of the week" entry. Neither source needs an API key.
//
//   npm run add-album -- "Artist" "Album" [--week=2026-09-28] [--cover-url=https://...] [--dry-run]
//
// Looks the album up on iTunes first, then on MusicBrainz (which also knows brand-new and delisted
// releases; covers come from the Cover Art Archive). Writes src/content/albums/<week>-<slug>.md and
// downloads the cover to src/assets/covers/<slug>.jpg. Fill in the blurb, highlights and any
// Bandcamp/Spotify links by hand afterwards.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const flags = Object.fromEntries(
	args
		.filter((a) => a.startsWith('--'))
		.map((a) => {
			const i = a.indexOf('=');
			return i === -1 ? [a.slice(2), 'true'] : [a.slice(2, i), a.slice(i + 1)];
		}),
);
const [artist, album] = positional;

if (!artist || !album) {
	console.error('Usage: npm run add-album -- "Artist" "Album" [--week=YYYY-MM-DD] [--cover-url=URL] [--dry-run]');
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

const has = (a, b) => a.toLowerCase().includes(b.toLowerCase());

// Each lookup returns candidates in a common shape: { title, artist, year, genre?, coverUrl?, link? }.

async function searchItunes() {
	const query = new URLSearchParams({ term: `${artist} ${album}`, entity: 'album', limit: '5', country: 'gb' });
	const res = await fetch(`https://itunes.apple.com/search?${query}`);
	if (!res.ok) throw new Error(`iTunes search failed: ${res.status}`);
	const { results } = await res.json();
	return results.map((r) => ({
		title: r.collectionName.replace(/ - (EP|Single)$/, ''),
		artist: r.artistName,
		year: r.releaseDate?.slice(0, 4),
		genre: r.primaryGenreName?.toLowerCase(),
		coverUrl: r.artworkUrl100.replace(/\d+x\d+bb/, '1200x1200bb'),
		link: r.collectionViewUrl.split('?')[0],
		source: 'iTunes',
	}));
}

async function searchMusicBrainz() {
	const q = `releasegroup:"${album.replace(/"/g, '')}" AND artist:"${artist.replace(/"/g, '')}"`;
	let res;
	// MusicBrainz allows about one request a second and answers 503 when you go faster, so retry.
	for (let attempt = 0; attempt < 4; attempt++) {
		res = await fetch(`https://musicbrainz.org/ws/2/release-group/?${new URLSearchParams({ query: q, fmt: 'json', limit: '8' })}`, {
			// MusicBrainz asks API users to identify themselves.
			headers: { 'User-Agent': 'MaxExposureSite/0.1 (https://0maks.github.io)' },
		});
		if (res.status !== 503) break;
		await new Promise((r) => setTimeout(r, 2000));
	}
	if (!res.ok) throw new Error(`MusicBrainz search failed: ${res.status}`);
	const { 'release-groups': groups = [] } = await res.json();
	// Prefer full albums over singles when titles match.
	const rank = { Album: 0, EP: 1 };
	return groups
		.filter((g) => g.score >= 80)
		.sort((a, b) => (rank[a['primary-type']] ?? 2) - (rank[b['primary-type']] ?? 2))
		.map((g) => ({
			title: g.title,
			artist: g['artist-credit']?.map((a) => a.name).join(', ') ?? artist,
			year: g['first-release-date']?.slice(0, 4),
			genre: [...(g.tags ?? [])].sort((a, b) => b.count - a.count)[0]?.name,
			coverUrl: `https://coverartarchive.org/release-group/${g.id}/front-1200`,
			type: g['primary-type'],
			source: 'MusicBrainz',
		}));
}

let candidates = await searchItunes().catch((e) => (console.warn(e.message), []));
let match = candidates.find((r) => has(r.artist, artist) && has(r.title, album));
if (!match) {
	console.log('No exact match on iTunes, trying MusicBrainz…');
	const mb = await searchMusicBrainz().catch((e) => (console.warn(e.message), []));
	candidates = [...mb, ...candidates];
	match = mb.find((r) => has(r.artist, artist) && has(r.title, album)) ?? candidates[0];
}
if (!match) {
	console.error('No matches found. Check the spelling, or create the file by hand.');
	process.exit(1);
}

console.log('Candidates:');
for (const r of candidates) {
	console.log(`${r === match ? '→' : ' '} ${r.artist} – ${r.title}${r.type ? ` [${r.type}]` : ''} (${r.year ?? '?'}) via ${r.source}`);
}
if (flags['dry-run']) process.exit(0);

const file = `src/content/albums/${week}-${slug}.md`;
if (existsSync(file)) {
	console.error(`${file} already exists, not overwriting.`);
	process.exit(1);
}

// A missing cover is not fatal: the site draws a placeholder from the colour and artist initials.
let cover;
const coverUrl = flags['cover-url'] ?? match.coverUrl;
try {
	const art = await fetch(coverUrl, { headers: { 'User-Agent': 'MaxExposureSite/0.1 (https://0maks.github.io)' } });
	if (!art.ok) throw new Error(`${art.status}`);
	cover = Buffer.from(await art.arrayBuffer());
} catch (e) {
	console.warn(`No cover downloaded (${e.message}). Use --cover-url=... or add one to src/assets/covers/ by hand.`);
}

let colour;
if (cover) {
	const { dominant } = await sharp(cover).stats();
	colour = '#' + [dominant.r, dominant.g, dominant.b].map((n) => n.toString(16).padStart(2, '0')).join('');
	await mkdir('src/assets/covers', { recursive: true });
	await writeFile(`src/assets/covers/${slug}.jpg`, cover);
}

const q = (s) => JSON.stringify(s);
const lines = [
	'---',
	`title: ${q(match.title)}`,
	`artist: ${q(match.artist)}`,
	`weekOf: ${week}`,
	...(match.year ? [`year: ${match.year}`] : []),
	...(cover ? [`cover: ../../assets/covers/${slug}.jpg`, `colour: ${q(colour)}`] : []),
	`tags: [${match.genre ? q(match.genre) : ''}]`,
	'# highlights:',
	'#   - "Track name"',
	...(match.link
		? ['links:', `  appleMusic: ${match.link}`, '#  bandcamp: https://', '#  spotify: https://']
		: ['# links:', '#   bandcamp: https://', '#   spotify: https://']),
	'---',
	'',
	'Why this one?',
	'',
];
await writeFile(file, lines.join('\n'));
console.log(`\nCreated ${file}`);
if (cover) console.log(`Cover:   src/assets/covers/${slug}.jpg (${(cover.length / 1024).toFixed(0)} KB), colour ${colour}`);
