/**
 * A product's file from its saved page: `bun run product inbox/<page>.html…`
 * reads a Trader Joe's product page saved from a browser (into inbox/, which
 * isn't committed) and writes src/content/products/<id>.md: its name, link,
 * image (on their site), price and size as of today, category, ingredients,
 * serving size and calories. A file that's already there is refused, so a
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

	// all-natural-shaved-beef-steak-057721 → all-natural-shaved-beef-steak.
	const id = url!.split("/").pop()!.replace(/-\d+$/, "");
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
		servingSize && `servingSize: ${yaml(servingSize)}`,
		calories && /^\d+$/.test(calories) && `calories: ${calories}`,
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
