import { getCollection } from 'astro:content';

const LONDON = 'Europe/London';

export const formatDate = (d: Date, opts: Intl.DateTimeFormatOptions) =>
	new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, ...opts }).format(d);

/** YYYY-MM-DD for the London calendar day, so a gig tonight still counts as today. */
export const londonDay = (d: Date) =>
	new Intl.DateTimeFormat('en-CA', { timeZone: LONDON, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/** Whole pounds, rounded up (so £20.02 shows as £21). The exact price stays in the data. */
export const formatPrice = (p?: number) => (p === undefined ? '' : p === 0 ? 'Free' : `£${Math.ceil(Number(p.toFixed(2)))}`);

/** Upcoming gigs, soonest first. Past gigs drop off at build time. */
export async function upcomingGigs() {
	const today = londonDay(new Date());
	return (await getCollection('gigs'))
		.filter((g) => londonDay(g.data.date) >= today)
		.sort((a, b) => a.data.date.getTime() - b.data.date.getTime());
}

export type Gig = Awaited<ReturnType<typeof upcomingGigs>>[number];

/** Short name for where the tickets are sold, from the link. */
export function ticketLabel(url: string) {
	const host = new URL(url).hostname.replace(/^www\./, '');
	if (host.endsWith('dice.fm')) return 'Dice';
	if (host.includes('ticketmaster')) return 'Ticketmaster';
	return 'Tickets';
}

/** Whole days from today to `d`, by London calendar day. */
export function daysUntil(d: Date) {
	const day = (x: Date) => new Date(`${londonDay(x)}T00:00:00Z`).getTime();
	return Math.round((day(d) - day(new Date())) / 86_400_000);
}

/** "Today", "Tomorrow", "In 5 days" for the coming week, otherwise nothing. */
export function soonLabel(d: Date) {
	const n = daysUntil(d);
	if (n === 0) return 'Today';
	if (n === 1) return 'Tomorrow';
	return n > 1 && n <= 7 ? `In ${n} days` : undefined;
}

/** Upcoming gigs grouped by month, soonest first. */
export function groupByMonth(gigs: Gig[]) {
	const groups: { key: string; label: string; gigs: Gig[] }[] = [];
	for (const g of gigs) {
		const key = londonDay(g.data.date).slice(0, 7);
		let group = groups.at(-1);
		if (group?.key !== key) {
			group = { key, label: formatDate(g.data.date, { month: 'long', year: 'numeric' }), gigs: [] };
			groups.push(group);
		}
		group.gigs.push(g);
	}
	return groups;
}
