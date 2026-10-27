import flickr from './data/flickr.json';

export const site = {
	name: 'Max Exposure',
	tagline: 'Music, photos and the odd blog post.',
	flickr,
	// Controls whether posts, tag pages and the RSS feed are built. Drafts never are.
	blog: { published: false },
	// Controls whether recipe pages are built. Drafts never are. `npm run dev` shows everything.
	recipes: { published: false },
	nav: [
		{ href: '/music/', label: 'Music' },
		{ href: '/photos/', label: 'Photos' },
		{ href: '/recipes/', label: 'Recipes' },
		{ href: '/blog/', label: 'Blog' },
	],
} as const;
