import { getCollection, type CollectionEntry } from 'astro:content';

export type Album = CollectionEntry<'albums'>;

const DAY = 86_400_000;

/** All albums, newest week first. */
export async function getAlbums() {
	return (await getCollection('albums')).sort((a, b) => b.data.weekOf.getTime() - a.data.weekOf.getTime());
}

/** Monday (UTC midnight) of the week containing `d`. */
export function mondayOf(d: Date) {
	const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
	return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY);
}

export interface WeekCell {
	monday: Date;
	album?: Album;
}

export interface MonthColumn {
	key: string;
	label: string;
	year: number;
	weeks: WeekCell[];
}

/**
 * Weeks grouped into months (by the week's Monday), oldest first.
 * Runs from the week of the oldest album to the week of the newest, so there are no
 * empty weeks before the first album or after the last. Gaps in between stay.
 */
export function monthColumns(albums: Album[]): MonthColumn[] {
	if (albums.length === 0) return [];
	const byWeek = new Map(albums.map((a) => [mondayOf(a.data.weekOf).getTime(), a]));
	const weeks = [...byWeek.keys()];
	const newest = Math.max(...weeks);
	let t = Math.min(...weeks);

	const columns: MonthColumn[] = [];
	for (; t <= newest; t += 7 * DAY) {
		const monday = new Date(t);
		const key = `${monday.getUTCFullYear()}-${monday.getUTCMonth()}`;
		let col = columns.at(-1);
		if (col?.key !== key) {
			col = {
				key,
				label: formatWeek(monday, { month: 'short' }),
				year: monday.getUTCFullYear(),
				weeks: [],
			};
			columns.push(col);
		}
		col.weeks.push({ monday, album: byWeek.get(t) });
	}
	return columns;
}

/** Black or white, whichever reads better on the given hex colour. */
export function textOn(hex: string) {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#111110' : '#ffffff';
}

export const initials = (name: string) =>
	name
		.replace(/^the\s+/i, '')
		.split(/\s+/)
		.slice(0, 2)
		.map((w) => w[0])
		.join('')
		.toUpperCase();

export const albumUrl = (a: Album) => `/music/albums/${a.id}/`;

export const formatWeek = (d: Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
	new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(d);
