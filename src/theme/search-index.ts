/**
 * The site search's index: run after `astro build` (package.json's
 * postbuild), it gives Pagefind the built pages that mark a story of the
 * paper's own with data-pagefind-body (StoryPage.astro), and writes the index
 * to dist/pagefind/. The rest — lists, staff pages and copied stories, whose
 * search result belongs to the original — stay out. (Pagefind on its own
 * indexes every page whole when no page has a data-pagefind-body, as on a
 * paper with nothing of its own published yet.)
 *
 *   bun src/theme/search-index.ts [dist]
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import * as pagefind from "pagefind";

const site = process.argv[2] ?? "dist";
const { index, errors } = await pagefind.createIndex({});
if (!index) throw new Error(`Pagefind: ${errors.join("; ")}`);

let stories = 0;
for (const file of await readdir(site, { recursive: true })) {
	if (!file.endsWith(".html")) continue;
	const content = await readFile(join(site, file), "utf8");
	if (!content.includes("data-pagefind-body")) continue;
	// The URL comes from the path: tech/desk/index.html is /tech/desk/.
	const added = await index.addHTMLFile({ sourcePath: file, content });
	if (added.errors.length) throw new Error(`Pagefind, ${file}: ${added.errors.join("; ")}`);
	stories++;
}
const written = await index.writeFiles({ outputPath: join(site, "pagefind") });
if (written.errors.length) throw new Error(`Pagefind: ${written.errors.join("; ")}`);
await pagefind.close();
console.log(`Indexed ${stories} stories for search in ${join(site, "pagefind")}.`);
