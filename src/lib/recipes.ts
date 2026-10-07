import { getCollection, type CollectionEntry } from 'astro:content';
import { markMeasurements, parseIngredient, type Ingredient } from './units';

export type Recipe = CollectionEntry<'recipes'>;

/**
 * Recipes that should appear on the site, newest first.
 * `npm run dev` also shows drafts so you can write and preview; the published site never does.
 */
export async function getRecipes() {
	const all = await getCollection('recipes');
	const visible = import.meta.env.DEV ? all : all.filter((r) => !r.data.draft);
	return visible.sort(
		(a, b) => (b.data.date?.getTime() ?? 0) - (a.data.date?.getTime() ?? 0) || a.data.title.localeCompare(b.data.title),
	);
}

export const recipeUrl = (r: Recipe) => `/recipes/${r.id}/`;
export const tagUrl = (tag: string) => `/recipes/?tag=${encodeURIComponent(tag)}`;

/** 35 becomes "35 min", 75 becomes "1 h 15 min". */
export function formatTime(minutes: number) {
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes % 60);
	return m ? `${h} h ${m} min` : `${h} h`;
}

export interface IngredientGroup {
	title?: string;
	items: Ingredient[];
}

const INGREDIENTS_HEADING = /^##\s+ingredients\s*$/i;

/** The bullet list under "## Ingredients", with optional "### Sub heading" groups. */
export function parseIngredients(body: string, recipe: string): IngredientGroup[] {
	const lines = body.split(/\r?\n/);
	const start = lines.findIndex((l) => INGREDIENTS_HEADING.test(l.trim()));
	if (start === -1) return [];

	const groups: IngredientGroup[] = [];
	let current: IngredientGroup | undefined;
	for (const raw of lines.slice(start + 1)) {
		const line = raw.trim();
		if (/^##\s/.test(line)) break; // next section
		const heading = line.match(/^###\s+(.*)$/);
		if (heading) {
			current = { title: heading[1].trim(), items: [] };
			groups.push(current);
			continue;
		}
		const bullet = line.match(/^[-*]\s+(.*)$/);
		if (!bullet) continue;
		if (!current) groups.push((current = { items: [] }));
		const ingredient = parseIngredient(bullet[1]);
		if (ingredient.q !== undefined && !ingredient.item) console.warn(`[recipes] ${recipe}: could not read the ingredient "${bullet[1]}"`);
		current.items.push(ingredient);
	}
	return groups;
}

/**
 * Everything except the ingredients list, as HTML: the method and any extra sections such as notes.
 * Measurements in the text (200°C, 200ml, 2cm) are wrapped so the page can convert and scale them.
 */
export function methodHtml(recipe: Recipe) {
	let html = recipe.rendered?.html ?? '';
	// Drop the "Ingredients" section (it is shown as the interactive list) and the "Method" heading (the page has its own).
	html = html.replace(/<h2 id="ingredients"[^>]*>[\s\S]*?(?=<h2 |$)/i, '');
	html = html.replace(/^\s*<h2 id="(?:method|instructions|directions|steps)"[^>]*>[\s\S]*?<\/h2>\s*/i, '');
	return markMeasurements(html);
}
