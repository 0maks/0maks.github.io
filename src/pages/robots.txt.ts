import type { APIRoute } from 'astro';

// Built from `site` in astro.config.mjs, so it follows the custom domain automatically.
export const GET: APIRoute = ({ site }) =>
	new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap-index.xml', site)}\n`, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
