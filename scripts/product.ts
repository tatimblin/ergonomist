/**
 * A product's file from its saved page: `bun run product inbox/<page>.html…`
 * reads a Trader Joe's product page saved from a browser (into inbox/, which
 * isn't committed) and writes src/content/products/<id>.md: its name, link,
 * image (on their site), price and size as of today, category, ingredients,
 * and nutrition facts per serving. A file that's already there is refused, so a
 * price is only ever updated by hand (or by deleting the file).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const fail = (message: string): never => {
	console.error(message);
	process.exit(1);
};

const files = process.argv.slice(2);
if (!files.length) fail("Usage: bun run product inbox/<saved page>.html…");

const decode = (s: string) =>
	s
		.replace(/<[^>]+>/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&#x27;|&rsquo;/g, "’")
		.replace(/&nbsp;/g, " ")
		.replace(/\s+/g, " ")
		.trim();

/** The text of the first element whose class starts with `name`. */
const byClass = (html: string, name: string) => {
	const m = html.match(new RegExp(`class="${name}[^"]*"[^>]*>([\\s\\S]*?)</`));
	return m ? decode(m[1]) : undefined;
};

/** Every match of `re`'s first group, as text. */
const all = (html: string, re: RegExp) => [...html.matchAll(re)].map((m) => decode(m[1]));

/** A characteristic in the nutrition facts: "serving size" → "4 oz (112g)". */
const characteristic = (html: string, title: string) => {
	const m = html.match(
		new RegExp(`Item_characteristics__title[^"]*">${title}</div><div class="Item_characteristics__text[^"]*">([\\s\\S]*?)</div>`, "i"),
	);
	return m ? decode(m[1]).replace(/\s*\(/, " (") : undefined;
};

/** The nutrition table's rows by our field name, per serving; grams, or
 *  milligrams for cholesterol and sodium. "Less than 1 g" is 0.5. */
const ROWS: [RegExp, string][] = [
	[/^Total Fat/, "fat"],
	[/^Saturated Fat/, "saturatedFat"],
	[/^Trans Fat/, "transFat"],
	[/^Cholesterol/, "cholesterol"],
	[/^Sodium/, "sodium"],
	[/^Total Carbohydrate/, "carbohydrate"],
	[/^Dietary Fiber/, "fiber"],
	[/^Total Sugars/, "sugar"],
	[/Added Sugars/, "addedSugar"],
	[/^Protein/, "protein"],
];
const nutrients = (html: string) => {
	const table = html.match(/Item_table__body[\s\S]*?<\/tbody>/)?.[0] ?? "";
	const found: [string, number][] = [];
	for (const [, row] of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
		const cells = [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((m) => decode(m[1]));
		const text = cells.slice(0, 2).join(" ");
		const field = ROWS.find(([re]) => re.test(cells[0]) || (re.source === "Added Sugars" && re.test(text)))?.[1];
		const amount = text.match(/(less than\s*)?(\d+(?:\.\d+)?)\s*m?g/i);
		if (field && amount && !found.some(([f]) => f === field)) found.push([field, amount[1] ? Number(amount[2]) / 2 : Number(amount[2])]);
	}
	return found;
};

// Today, in local time: the date the price was seen.
const now = new Date();
const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, "0")).join("-");

for (const file of files) {
	const html = readFileSync(file, "utf8");
	const url = html.match(/property="og:url" content="([^"]+)"/)?.[1];
	if (!url?.includes("traderjoes.com/home/products/pdp/")) fail(`${file}: not a saved Trader Joe's product page (no og:url to one).`);
	const name = byClass(html, "ProductDetails_main__title") ?? fail(`${file}: no product name found.`);
	const price = byClass(html, "ProductPrice_productPrice__price")?.replace("$", "");
	const size = byClass(html, "ProductPrice_productPrice__unit")?.replace(/^\//, "");
	// Their image, at the 640px size their own page uses.
	// The first picture in the page's own carousel (the package), else its
	// og:image; the rendition the page uses, at 640px.
	const carousel = html.match(/<img[^>]*fetchpriority="high"[^>]*>/)?.[0].match(/\ssrc="(\/content\/dam\/[^"]+)"/)?.[1];
	const og = html.match(/property="og:image" content="([^"]+)"/)?.[1];
	const image = carousel
		? `https://www.traderjoes.com${carousel.replace(/\.1280\.1280/, ".640.640")}`
		: og && `${og}/jcr:content/renditions/cq5dam.web.640.640.jpeg`;
	const crumbs = all(html, /Breadcrumbs_list__link[^"]*"[^>]*>([^<]*)</g);
	const ingredients = all(html, /IngredientsList_ingredientsList__item[^"]*">([\s\S]*?)<\/li>/g);
	const servingSize = characteristic(html, "serving size");
	const calories = characteristic(html, "calories per serving");

	// From the name, as their URL's slug is (all-natural-shaved-beef-steak),
	// but keeping an accented letter's letter: their "Jalapeño" is "jalapeo".
	const id = name
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[̀-ͯ'’"“”]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
	const yaml = (s: string) => JSON.stringify(s);
	const lines = [
		"---",
		`name: ${yaml(name)}`,
		`store: "Trader Joe's"`,
		`url: ${url}`,
		image && `image: ${image}`,
		price && `price: ${price}`,
		size && `size: ${yaml(size)}`,
		`priced: ${today}`,
		crumbs.length > 1 && `category: ${yaml(crumbs[crumbs.length - 1])}`,
		ingredients.length && `ingredients: [${ingredients.map(yaml).join(", ")}]`,
		...(servingSize && calories && /^\d+$/.test(calories)
			? [
					"nutrition:          # per serving, from the label",
					`  servingSize: ${yaml(servingSize)}`,
					`  calories: ${calories}`,
					...nutrients(html).map(([field, n]) => `  ${field}: ${n}`),
				]
			: []),
		"---",
		"",
	].filter(Boolean);

	const dir = "src/content/products";
	const out = `${dir}/${id}.md`;
	if (existsSync(out)) {
		console.error(`${out} is already there; skipped.`);
		continue;
	}
	mkdirSync(dir, { recursive: true });
	writeFileSync(out, lines.join("\n"), { flag: "wx" });
	console.log(out);
}
