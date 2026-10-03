import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const gigs = defineCollection({
	loader: file('src/data/gigs.json'),
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
		// The artist's profile on each service
		links: z
			.object({
				spotify: z.url().optional(),
				tidal: z.url().optional(),
			})
			.default({}),
		note: z.string().optional(),
		tags: z.array(z.string()).default([]),
	}),
});

const albums = defineCollection({
	loader: file('src/data/albums.json'),
	schema: z.object({
		title: z.string(),
		artist: z.string(),
		// Monday of the week this was album of the week, e.g. "2026-09-28"
		weekOf: z.coerce.date(),
		year: z.number().int().optional(),
		// Link to the cover image. It is fetched and resized at build time.
		cover: z.url().optional(),
		// Hex colour for the placeholder cover shown when there is no image. Defaults to the site accent.
		colour: z
			.string()
			.regex(/^#[0-9a-fA-F]{6}$/)
			.optional(),
		tags: z.array(z.string()).default([]),
		// Standout tracks
		highlights: z.array(z.string()).default([]),
		links: z
			.object({
				bandcamp: z.url().optional(),
				spotify: z.url().optional(),
				tidal: z.url().optional(),
				appleMusic: z.url().optional(),
			})
			.default({}),
		// A few words on why. Separate paragraphs with a blank line ("\n\n").
		blurb: z.string().optional(),
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
