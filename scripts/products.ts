/**
 * The products there are to write into a recipe: `bun run products [word]`
 * lists each one in src/content/products, its id (a recipe ingredient's
 * `product`), name, size and price, its nutrition's serving size (what an
 * ingredient's `servings` counts), and the recipes that use it. A word
 * narrows the list to the products whose id or name has it.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const word = process.argv[2]?.toLowerCase();

/** A top-level or nutrition field from a product's frontmatter. */
const field = (text: string, name: string) => text.match(new RegExp(`^\\s*${name}: "?([^"\\n]*)"?$`, "m"))?.[1];

// Every recipe file's text, to find what uses each product.
const storiesDir = "src/content/stories";
const recipes = readdirSync(storiesDir, { recursive: true, encoding: "utf8" })
	.filter((f) => f.endsWith(".md") && !f.split("/").pop()!.startsWith("_"))
	.map((f) => ({ id: f.replace(/\.md$/, ""), text: readFileSync(join(storiesDir, f), "utf8") }));

const dir = "src/content/products";
const rows = readdirSync(dir)
	.filter((f) => f.endsWith(".md"))
	.sort()
	.map((f) => {
		const id = f.slice(0, -3);
		const text = readFileSync(join(dir, f), "utf8");
		const usedBy = recipes.filter((r) => new RegExp(`product: ${id}\\s*$`, "m").test(r.text)).map((r) => r.id);
		return {
			id,
			name: field(text, "name") ?? id,
			size: field(text, "size") ?? "",
			price: field(text, "price"),
			serving: field(text, "servingSize"),
			usedBy,
		};
	})
	.filter((r) => !word || r.id.includes(word) || r.name.toLowerCase().includes(word));

if (!rows.length) {
	console.log(word ? `No product matches "${word}". Add one: bun run product <Trader Joe's URL>` : "No products yet.");
	process.exit(0);
}
for (const r of rows) {
	console.log(`${r.id}`);
	console.log(`  ${r.name}, ${r.size}${r.price ? `, $${r.price}` : ""}`);
	console.log(`  servings of ${r.serving ?? "(no nutrition facts)"}`);
	console.log(`  used by ${r.usedBy.length ? r.usedBy.join(", ") : "no recipe yet"}`);
}
