import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Imported data often writes `null` for "none". Treat that the same as leaving the field out.
const optional = <T extends z.ZodType>(schema: T) => schema.nullish().transform((v) => v ?? undefined);

const gigs = defineCollection({
	loader: file('src/data/gigs.json'),
	schema: z.object({
		artist: z.string(),
		date: z.coerce.date(),
		venue: optional(z.string()),
		// First half of the postcode only, e.g. "NW1"
		postcode: optional(z.string()),
		// Doors or start time, e.g. "19:30".
		time: optional(z.string().regex(/^\d{2}:\d{2}$/)),
		// Pounds. 0 means free.
		price: optional(z.number()),
		ticketUrl: optional(z.url()),
		// Shown on the ticket button instead of where the tickets are sold.
		soldOut: optional(z.boolean()),
		// The artist's profile on each service
		links: z
			.object({
				spotify: optional(z.url()),
				tidal: optional(z.url()),
			})
			.default({}),
		note: optional(z.string()),
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
