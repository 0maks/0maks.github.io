import data from '../data/photos.json';

export interface PhotoSize {
	w: number;
	h: number;
	src: string;
}

export interface Photo {
	id: string;
	title: string;
	tags: string[];
	/** Local date and time the photo was taken, YYYY-MM-DDTHH:mm:ss */
	taken: string;
	/** Link to the photo on Flickr */
	url: string;
	/** Smallest to largest */
	sizes: PhotoSize[];
}

/** Newest first. */
export const photos = data.photos as Photo[];

/** The favourites album, in album order, at most six. */
export const favourites = data.favourites
	.map((id) => photos.find((p) => p.id === id))
	.filter((p): p is Photo => !!p)
	.slice(0, 6);

export const monthKey = (p: Photo) => p.taken.slice(0, 7);

const fmt = (key: string, opts: Intl.DateTimeFormatOptions) =>
	new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(new Date(`${key}T00:00:00Z`));

export const monthLabel = (key: string) => fmt(`${key}-01`, { month: 'short', year: 'numeric' });
export const takenLabel = (p: Photo) => fmt(p.taken.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' });

/** The size closest to `width` pixels wide. */
export const pickSize = (p: Photo, width: number) =>
	p.sizes.reduce((best, s) => (Math.abs(s.w - width) < Math.abs(best.w - width) ? s : best));

export function groupByMonth(list: Photo[]) {
	const groups: { key: string; label: string; photos: Photo[] }[] = [];
	for (const p of list) {
		const key = monthKey(p);
		let group = groups.at(-1);
		if (group?.key !== key) {
			group = { key, label: monthLabel(key), photos: [] };
			groups.push(group);
		}
		group.photos.push(p);
	}
	return groups;
}

/** Tags used by at least one photo, most used first. */
export function tagCounts(list: Photo[]) {
	const counts = new Map<string, number>();
	for (const p of list) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
	return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
