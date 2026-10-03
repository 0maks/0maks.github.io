import { getCollection, type CollectionEntry } from 'astro:content';
import { site } from '../site.config';

export type Post = CollectionEntry<'blog'>;

/**
 * Posts that should appear on the site.
 *
 * In `npm run dev` every post shows, drafts included, so you can write and preview.
 * In a production build nothing shows until `site.blog.published` is true, and drafts never do.
 */
export async function getPosts() {
	const all = await getCollection('blog');
	const visible = import.meta.env.DEV ? all : site.blog.published ? all.filter((p) => !p.data.draft) : [];
	return visible.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export const postUrl = (p: Post) => `/blog/${p.id}/`;
export const tagUrl = (tag: string) => `/blog/tags/${encodeURIComponent(tag)}/`;

export const allTags = (posts: Post[]) => [...new Set(posts.flatMap((p) => p.data.tags))].sort();

export const formatPostDate = (d: Date) =>
	new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
