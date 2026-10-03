import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const gigs = defineCollection({
	loader: file('src/data/gigs.yaml'),
	schema: z.object({
		artist: z.string(),
		date: z.coerce.date(),
		venue: z.string().optional(),
		// First half of the postcode only, e.g. "NW1"
		postcode: z.string().optional(),
		// Doors or start time, e.g. "19:30".
		time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
		// Pounds. 0 means free.
		price: z.number().optional(),
		ticketUrl: z.url().optional(),
		note: z.string().optional(),
		tags: z.array(z.string()).default([]),
	}),
});

const albums = defineCollection({
	loader: glob({ pattern: '*.md', base: 'src/content/albums' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			artist: z.string(),
			// Monday of the week this was album of the week
			weekOf: z.coerce.date(),
			year: z.number().int().optional(),
			cover: image().optional(),
			// Hex colour used for the heatmap and the fallback cover. Defaults to the site accent.
			colour: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
			tags: z.array(z.string()).default([]),
			// Standout tracks, shown like added lines in a diff
			highlights: z.array(z.string()).default([]),
			links: z
				.object({
					bandcamp: z.url().optional(),
					spotify: z.url().optional(),
					appleMusic: z.url().optional(),
				})
				.default({}),
		}),
});

const blog = defineCollection({
	loader: glob({ pattern: '*.md', base: 'src/content/blog' }),
	schema: z.object({
		title: z.string(),
		date: z.coerce.date(),
		summary: z.string(),
		tags: z.array(z.string()).default([]),
		// Drafts never reach the production build.
		draft: z.boolean().default(false),
	}),
});

export const collections = { gigs, albums, blog };
