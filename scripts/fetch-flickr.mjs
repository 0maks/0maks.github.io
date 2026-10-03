#!/usr/bin/env node
// Fetch photos and the favourites album from Flickr into src/data/photos.json.
//
// With FLICKR_API_KEY set: uses the Flickr API (every public photo, all sizes, tags, dates).
// Without it (Flickr now only gives API keys to Pro accounts): falls back to Flickr's public feeds.
// A feed only returns the latest ~20 photos, so in that mode new photos are merged into the existing
// photos.json instead of replacing it, and any albums in `extraAlbumIds` (src/data/flickr.json) are
// included too. Run `npm run photos` now and then and commit the result to keep older photos.
// If anything fails, the existing photos.json is kept so the site never publishes an empty gallery.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

const OUT = 'src/data/photos.json';
const { userId, favouritesAlbumId, extraAlbumIds = [] } = JSON.parse(await readFile('src/data/flickr.json', 'utf8'));
const key = process.env.FLICKR_API_KEY;

const getJson = async (url) => {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url.replace(/api_key=[^&]+/, 'api_key=…')}`);
	return res.json();
};
const pageUrl = (id) => `https://www.flickr.com/photos/${userId}/${id}/`;
const idFromLink = (link) => link.match(/\/photos\/[^/]+\/(\d+)/)?.[1];
const tagList = (s) => (s ?? '').split(/\s+/).filter(Boolean);

/** Sizes the API can report, with the extras field that asks for each. */
const SUFFIXES = ['n', 'z', 'c', 'l'];

async function fromApi() {
	const call = (method, params) =>
		getJson(
			`https://api.flickr.com/services/rest/?${new URLSearchParams({
				method,
				api_key: key,
				format: 'json',
				nojsoncallback: '1',
				...params,
			})}`,
		).then((r) => {
			if (r.stat !== 'ok') throw new Error(`${method}: ${r.message}`);
			return r;
		});

	const extras = ['date_taken', 'tags', ...SUFFIXES.map((s) => `url_${s}`)].join(',');
	const photos = [];
	for (let page = 1, pages = 1; page <= pages; page++) {
		const r = await call('flickr.people.getPublicPhotos', { user_id: userId, extras, per_page: '500', page: String(page) });
		pages = r.photos.pages;
		for (const p of r.photos.photo) {
			const sizes = SUFFIXES.filter((s) => p[`url_${s}`]).map((s) => ({
				w: Number(p[`width_${s}`]),
				h: Number(p[`height_${s}`]),
				src: p[`url_${s}`],
			}));
			if (sizes.length === 0) continue;
			photos.push({ id: p.id, title: p.title, tags: tagList(p.tags), taken: p.datetaken.replace(' ', 'T'), url: pageUrl(p.id), sizes });
		}
	}

	const album = await call('flickr.photosets.getPhotos', { photoset_id: favouritesAlbumId, user_id: userId, per_page: '500' });
	return { source: 'api', photos, favourites: album.photoset.photo.map((p) => p.id) };
}

/** Long-edge widths of the sizes we synthesise from a feed's _m URL. Flickr serves these for most photos. */
const FEED_SIZES = [
	['n', 320],
	['z', 640],
	['b', 1024],
];

function fromFeedItem(item) {
	const m = item.media.m;
	const id = idFromLink(item.link);
	const dims = item.description.match(/width="(\d+)" height="(\d+)"/);
	if (!id || !dims) return undefined;
	const [mw, mh] = [Number(dims[1]), Number(dims[2])];
	const long = Math.max(mw, mh);
	const sizes = FEED_SIZES.map(([suffix, edge]) => ({
		w: Math.round((mw / long) * edge),
		h: Math.round((mh / long) * edge),
		src: m.replace('_m.jpg', `_${suffix}.jpg`),
	}));
	return {
		id,
		title: item.title,
		tags: tagList(item.tags),
		taken: item.date_taken.slice(0, 19),
		url: pageUrl(id),
		sizes,
	};
}

const albumFeed = (set) =>
	getJson(`https://api.flickr.com/services/feeds/photoset.gne?${new URLSearchParams({ set, nsid: userId, format: 'json', nojsoncallback: '1' })}`);

async function previouslyFetched() {
	try {
		return JSON.parse(await readFile(OUT, 'utf8')).photos ?? [];
	} catch {
		return [];
	}
}

async function fromFeeds() {
	const feed = await getJson(`https://www.flickr.com/services/feeds/photos_public.gne?${new URLSearchParams({ id: userId, format: 'json', nojsoncallback: '1' })}`);
	const favourites = await albumFeed(favouritesAlbumId);

	// Oldest first, so anything fetched fresh overrides what was saved before.
	const byId = new Map((await previouslyFetched()).map((p) => [p.id, p]));
	const items = [...feed.items, ...favourites.items];
	for (const set of extraAlbumIds) items.push(...(await albumFeed(set)).items);
	for (const item of items) {
		const p = fromFeedItem(item);
		if (p) byId.set(p.id, p);
	}
	return {
		source: 'feed',
		photos: [...byId.values()],
		favourites: favourites.items.map((i) => idFromLink(i.link)).filter(Boolean),
	};
}

try {
	const result = await (key ? fromApi() : fromFeeds());
	result.photos.sort((a, b) => b.taken.localeCompare(a.taken));
	if (result.photos.length === 0) throw new Error('Flickr returned no photos');
	await writeFile(OUT, JSON.stringify(result, null, '\t') + '\n');
	console.log(`Flickr (${result.source}): ${result.photos.length} photos, ${result.favourites.length} favourites`);
	if (!key) console.log('No FLICKR_API_KEY set: used the public feeds (latest ~20 photos plus anything saved earlier).');
} catch (err) {
	console.warn(`Flickr fetch failed: ${err.message}`);
	if (existsSync(OUT)) {
		console.warn(`Keeping the existing ${OUT}.`);
	} else {
		await writeFile(OUT, JSON.stringify({ source: 'none', photos: [], favourites: [] }, null, '\t') + '\n');
		console.warn(`Wrote an empty ${OUT}.`);
	}
}
