import rss from '@astrojs/rss';
import type { APIContext, GetStaticPaths } from 'astro';
import { site } from '../../site.config';
import { getPosts, postUrl } from '../../lib/blog';

// Only generate the feed once there is something to put in it.
export const getStaticPaths = (async () => ((await getPosts()).length > 0 ? [{ params: { feed: 'rss' } }] : [])) satisfies GetStaticPaths;

export async function GET(context: APIContext) {
	const posts = await getPosts();
	return rss({
		title: `${site.name} blog`,
		description: site.tagline,
		site: context.site!,
		items: posts.map((p) => ({
			title: p.data.title,
			pubDate: p.data.date,
			description: p.data.summary,
			link: postUrl(p),
		})),
	});
}
