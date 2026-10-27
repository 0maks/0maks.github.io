// Quantities, scaling and metric/imperial conversion for recipes.
// Pure functions with no Astro imports, so they run at build time and in the browser.
//
// "Imperial" here means US customary: cups, fluid ounces, ounces, pounds and degrees Fahrenheit.

export type System = 'metric' | 'imperial';
type Kind = 'mass' | 'volume' | 'spoon' | 'count' | 'temp' | 'length';

interface UnitDef {
	kind: Kind;
	/** Grams for mass, millilitres for volume, millimetres for length. */
	base?: number;
	one: string;
	many: string;
}

const UNITS: Record<string, UnitDef> = {
	g: { kind: 'mass', base: 1, one: 'g', many: 'g' },
	kg: { kind: 'mass', base: 1000, one: 'kg', many: 'kg' },
	oz: { kind: 'mass', base: 28.3495, one: 'oz', many: 'oz' },
	lb: { kind: 'mass', base: 453.592, one: 'lb', many: 'lb' },
	ml: { kind: 'volume', base: 1, one: 'ml', many: 'ml' },
	l: { kind: 'volume', base: 1000, one: 'l', many: 'l' },
	floz: { kind: 'volume', base: 29.5735, one: 'fl oz', many: 'fl oz' },
	cup: { kind: 'volume', base: 236.588, one: 'cup', many: 'cups' },
	tsp: { kind: 'spoon', one: 'tsp', many: 'tsp' },
	tbsp: { kind: 'spoon', one: 'tbsp', many: 'tbsp' },
	c: { kind: 'temp', one: '°C', many: '°C' },
	f: { kind: 'temp', one: '°F', many: '°F' },
	mm: { kind: 'length', base: 1, one: 'mm', many: 'mm' },
	cm: { kind: 'length', base: 10, one: 'cm', many: 'cm' },
	in: { kind: 'length', base: 25.4, one: 'in', many: 'in' },
};

// Things you count. They scale but never convert.
for (const [one, many] of [
	['clove', 'cloves'],
	['pinch', 'pinches'],
	['dash', 'dashes'],
	['tin', 'tins'],
	['can', 'cans'],
	['slice', 'slices'],
	['piece', 'pieces'],
	['bunch', 'bunches'],
	['handful', 'handfuls'],
	['sprig', 'sprigs'],
	['stick', 'sticks'],
	['stalk', 'stalks'],
	['knob', 'knobs'],
	['head', 'heads'],
	['sheet', 'sheets'],
	['rasher', 'rashers'],
	['fillet', 'fillets'],
	['pack', 'packs'],
	['jar', 'jars'],
	['bag', 'bags'],
] as const) {
	UNITS[one] = { kind: 'count', one, many };
}

const ALIASES: Record<string, string> = {
	gram: 'g', grams: 'g', gr: 'g',
	kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
	ounce: 'oz', ounces: 'oz',
	lbs: 'lb', pound: 'lb', pounds: 'lb',
	millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml',
	litre: 'l', litres: 'l', liter: 'l', liters: 'l',
	cups: 'cup',
	teaspoon: 'tsp', teaspoons: 'tsp', tsps: 'tsp',
	tablespoon: 'tbsp', tablespoons: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp',
};
for (const def of Object.values(UNITS)) if (def.kind === 'count') ALIASES[def.many] = Object.keys(UNITS).find((k) => UNITS[k] === def)!;

/** The unit key for a word like "tbsp", "Tablespoons" or "cloves", or undefined if it is not a unit. */
export function lookupUnit(word: string): string | undefined {
	const w = word.toLowerCase().replace(/\.$/, '');
	if (UNITS[w] && !['c', 'f', 'in'].includes(w)) return w;
	return ALIASES[w];
}

// ---------- numbers ----------

const GLYPH_VALUE: Record<string, number> = { '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8 };
const FRACTION_GLYPHS = Object.keys(GLYPH_VALUE).join('');
const NUM = `(?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+(?:\\.\\d+)?[${FRACTION_GLYPHS}]?|[${FRACTION_GLYPHS}])`;
const QTY_RE = new RegExp(`^(${NUM})(?:\\s*(?:-|–|to)\\s*(${NUM}))?`);

/** "1 1/2", "1½", "½", "1/2" and "1.5" all become numbers. */
export function parseNumber(text: string): number {
	const t = text.trim();
	let m = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
	if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
	m = t.match(/^(\d+)\/(\d+)$/);
	if (m) return Number(m[1]) / Number(m[2]);
	m = t.match(new RegExp(`^(\\d+(?:\\.\\d+)?)?([${FRACTION_GLYPHS}])?$`));
	if (m) return (m[1] ? Number(m[1]) : 0) + (m[2] ? GLYPH_VALUE[m[2]] : 0);
	return Number(t);
}

/** The nearest whole-plus-fraction value, e.g. 1.3 with [0, 1/4, 1/3, 1/2, ...] gives 1.333. */
function nearest(n: number, steps: number[]): number {
	const whole = Math.floor(n);
	const frac = n - whole;
	let best = steps[0];
	for (const s of steps) if (Math.abs(s - frac) < Math.abs(best - frac)) best = s;
	return whole + best;
}

/** That value written with fraction glyphs, e.g. "1⅓". */
function fraction(n: number, steps: number[]): string {
	const value = nearest(n, steps);
	const whole = Math.floor(value + 1e-9);
	const frac = value - whole;
	if (frac < 1e-9) return String(whole);
	const glyph = Object.entries(GLYPH_VALUE).find(([, v]) => Math.abs(v - frac) < 1e-9)?.[0] ?? '';
	return whole === 0 ? glyph : `${whole}${glyph}`;
}

const QUARTERS = [0, 1 / 4, 1 / 2, 3 / 4, 1];
const HALVES = [0, 1 / 2, 1];
const KITCHEN = [0, 1 / 8, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1];
const EIGHTHS = [0, 1 / 8, 1 / 4, 3 / 8, 1 / 2, 5 / 8, 3 / 4, 7 / 8, 1];
const THIRDS_EIGHTHS = [0, 1 / 8, 1 / 4, 1 / 3, 3 / 8, 1 / 2, 5 / 8, 2 / 3, 3 / 4, 7 / 8, 1];

const decimals = (n: number, places: number) => String(Number(n.toFixed(places)));

/** Grams or millilitres, rounded the way a person would measure them. */
function roundMetric(n: number): string {
	if (n < 10) return decimals(Math.round(n * 2) / 2, 1);
	if (n < 50) return String(Math.round(n));
	if (n < 500) return String(Math.round(n / 5) * 5);
	return String(Math.round(n / 10) * 10);
}

// ---------- ingredient lines ----------

export interface Ingredient {
	/** Quantity as written (and its upper end for a range like "2-3"). Missing for "salt, to taste". */
	q?: number;
	q2?: number;
	unit?: string;
	/** What it is. May contain "(s)", "(es)" or "(a|b)" so it can follow the quantity: "egg(s)". */
	item: string;
	/** Everything after the first comma, e.g. "finely diced". */
	note?: string;
	/** Written like "2 x 400g tins": the "x" belongs to the quantity, so it is shown as "2 ×". */
	times?: boolean;
}

/** "400g spaghetti", "1 1/2 tbsp olive oil", "2 cloves garlic, minced", "Salt, to taste". */
export function parseIngredient(line: string): Ingredient {
	const text = line.trim();
	const m = text.match(QTY_RE);
	if (!m) return { item: text };

	const q = parseNumber(m[1]);
	const q2 = m[2] ? parseNumber(m[2]) : undefined;
	let rest = text.slice(m[0].length).trimStart();

	let unit: string | undefined;
	const word = rest.match(/^([a-zA-Z]+)\.?(?![a-zA-Z])/);
	if (word) {
		const fl = word[1].toLowerCase() === 'fl' ? rest.match(/^fl\.?\s*oz\.?(?![a-zA-Z])/i) : null;
		if (fl) {
			unit = 'floz';
			rest = rest.slice(fl[0].length).trimStart();
		} else {
			unit = lookupUnit(word[1]);
			if (unit) rest = rest.slice(word[0].length).trimStart();
		}
	}
	if (/^of\s/i.test(rest) && unit) rest = rest.slice(3).trimStart(); // "2 cups of flour"

	let times = false;
	if (!unit && /^[x×]\s+\S/i.test(rest)) {
		times = true;
		rest = rest.replace(/^[x×]\s+/i, '');
	}

	const comma = rest.indexOf(',');
	const item = (comma === -1 ? rest : rest.slice(0, comma)).trim();
	const note = comma === -1 ? undefined : rest.slice(comma + 1).trim();
	return { q, q2, unit, item, note: note || undefined, times: times || undefined };
}

/** Picks "egg" or "eggs" for "egg(s)" depending on the quantity. */
export function resolveItem(item: string, q?: number): string {
	const plural = q !== undefined && q > 1;
	return item
		.replace(/\(([^()|]*)\|([^()|]*)\)/g, (_, one, many) => (plural ? many : one))
		.replace(/\((es|s)\)/g, (_, suffix) => (plural ? suffix : ''));
}

// ---------- formatting a quantity in a unit system ----------

/** Whether a unit's amount grows with the number of portions. */
export const scales = (unit?: string) => !unit || !['temp', 'length'].includes(UNITS[unit]?.kind ?? '');

/**
 * Formats `q` of `unit` for the given system, e.g. (400, 'g', 'imperial') is "14 oz".
 * `factor` is portions wanted divided by portions in the recipe.
 */
export function formatAmount(q: number, unit: string | undefined, system: System, factor = 1, q2?: number): string {
	if (q2 !== undefined) {
		// A range uses one unit, chosen from its upper end.
		const hi = formatParts(q2 * (scales(unit) ? factor : 1), unit, system);
		const lo = formatParts(q * (scales(unit) ? factor : 1), unit, system, hi.unit);
		return hi.unit === 'lb' ? `${lo.text}–${hi.text}` : `${lo.text}–${hi.text}${hi.suffix}`;
	}
	const p = formatParts(q * (scales(unit) ? factor : 1), unit, system);
	return `${p.text}${p.suffix}`;
}

interface Parts {
	text: string;
	/** Unit label, with its leading space. */
	suffix: string;
	unit?: string;
}

function formatParts(q: number, unit: string | undefined, system: System, forceUnit?: string): Parts {
	if (!unit) return { text: fraction(q, q < 2 ? QUARTERS : HALVES), suffix: '' };
	const def = UNITS[unit];
	const label = (u: string, n: number) => ` ${n <= 1 ? UNITS[u].one : UNITS[u].many}`;

	switch (def.kind) {
		case 'count': {
			const steps = q < 2 ? QUARTERS : q < 10 ? HALVES : [0, 1];
			return { text: fraction(q, steps), suffix: label(unit, nearest(q, steps)), unit };
		}

		case 'spoon': {
			if (unit === 'tsp' && q >= 3) return formatParts(q / 3, 'tbsp', system);
			return { text: fraction(q, KITCHEN), suffix: label(unit, nearest(q, KITCHEN)), unit };
		}

		case 'mass': {
			const g = q * def.base!;
			if (system === 'metric') {
				if (forceUnit === 'g' || (forceUnit === undefined && g < 1000)) return { text: roundMetric(g), suffix: ' g', unit: 'g' };
				return { text: decimals(g / 1000, 2), suffix: ' kg', unit: 'kg' };
			}
			const oz = g / UNITS.oz.base!;
			if (forceUnit === 'oz' || (forceUnit === undefined && oz < 16)) {
				return { text: fraction(oz, oz < 4 ? QUARTERS : HALVES), suffix: ' oz', unit: 'oz' };
			}
			const total = Math.round(oz * 2) / 2;
			const lb = Math.floor(total / 16);
			const rest = total - lb * 16;
			return { text: rest > 0 ? `${lb} lb ${fraction(rest, HALVES)} oz` : `${lb} lb`, suffix: '', unit: 'lb' };
		}

		case 'volume': {
			const ml = q * def.base!;
			if (system === 'metric') {
				if (forceUnit === 'ml' || (forceUnit === undefined && ml < 1000)) return { text: roundMetric(ml), suffix: ' ml', unit: 'ml' };
				return { text: decimals(ml / 1000, 2), suffix: ' l', unit: 'l' };
			}
			if (forceUnit === 'floz' || (forceUnit === undefined && ml < 59)) {
				return { text: fraction(ml / UNITS.floz.base!, HALVES), suffix: ' fl oz', unit: 'floz' };
			}
			const cups = ml / UNITS.cup.base!;
			return { text: fraction(cups, THIRDS_EIGHTHS), suffix: label('cup', nearest(cups, THIRDS_EIGHTHS)), unit: 'cup' };
		}

		case 'temp': {
			// Stored as degrees C or F; shown in the system's own scale.
			const c = unit === 'c' ? q : (q - 32) * (5 / 9);
			if (system === 'metric') return { text: String(Math.round(c)), suffix: '°C', unit: 'c' };
			const f = c * (9 / 5) + 32;
			const rounded = f >= 300 ? Math.round(f / 25) * 25 : Math.round(f / 5) * 5;
			return { text: String(rounded), suffix: '°F', unit: 'f' };
		}

		case 'length': {
			const mm = q * def.base!;
			if (system === 'metric') {
				return mm < 10 ? { text: decimals(mm, 0), suffix: ' mm', unit: 'mm' } : { text: decimals(mm / 10, 1), suffix: ' cm', unit: 'cm' };
			}
			const inches = mm / 25.4;
			return { text: fraction(inches, inches < 1 ? EIGHTHS : QUARTERS), suffix: ' in', unit: 'in' };
		}
	}
}

// ---------- measurements inside the method text ----------

const METHOD_RE = /(?<![\w.])(\d+(?:\.\d+)?)\s?(°\s?[CF]|º\s?[CF]|kg|g|ml|l|cm|mm)(?![a-zA-Z])/g;

/** Wraps "200°C", "200ml" and "2cm" in the method so they can be scaled and converted in the browser. */
export function markMeasurements(html: string): string {
	return html
		.split(/(<[^>]+>)/)
		.map((part) => {
			if (part.startsWith('<')) return part;
			return part.replace(METHOD_RE, (_, num: string, rawUnit: string) => {
				const unit = /[CF]$/i.test(rawUnit) && /[°º]/.test(rawUnit) ? rawUnit.slice(-1).toLowerCase() : rawUnit;
				const shown = formatAmount(Number(num), unit, 'metric');
				return `<span class="meas" data-q="${num}" data-u="${unit}">${shown}</span>`;
			});
		})
		.join('');
}
