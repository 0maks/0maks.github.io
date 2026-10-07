// Written by scripts/check-covers.mjs before each build: image URLs that could not be fetched.
const broken = new Set<string>(
	Object.values(import.meta.glob<string[]>('../data/broken-covers.json', { eager: true, import: 'default' })).flat(),
);

/** The URL, unless it is missing or known to be dead (then the page shows its placeholder instead). */
export const usableImage = (url?: string) => (url && !broken.has(url) ? url : undefined);
