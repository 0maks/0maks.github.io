import flickr from './data/flickr.json';

export const site = {
	name: 'Max Exposure',
	tagline: 'Music, photos and the odd blog post.',
	flickr,
	// Controls whether posts, tag pages and the RSS feed are built. Drafts never are.
	blog: { published: false },
	nav: [
		{ href: '/music/', label: 'Music' },
		{ href: '/photos/', label: 'Photos' },
		{ href: '/blog/', label: 'Blog' },
	],
} as const;
