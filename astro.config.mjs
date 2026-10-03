// @ts-check
import { defineConfig } from 'astro/config';

// Served from the root of https://0maks.github.io (repo: 0maks/0maks.github.io).
// When the custom domain is live, change `site` to it and add public/CNAME.
export default defineConfig({
	site: 'https://0maks.github.io',
	markdown: {
		// Code blocks follow the visitor's light/dark setting (see .astro-code in global.css).
		shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
	},
});
