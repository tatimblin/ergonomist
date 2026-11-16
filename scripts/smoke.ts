/**
 * A smoke test of the build (`bun run test:smoke [dist]`):
 *
 * - The pages every build has are there: the front page, /latest/, /staff/,
 *   /about/, /standards/, /feeds/, /search/, the 404, the sitemap, robots.txt
 *   and the paper's two feeds.
 * - Every story in src/content/stories has its page (a headline, its anchor
 *   in the Newswire), and a recipe its card; a draft only when the build had
 *   INCLUDE_DRAFTS=1 (run this with the build's INCLUDE_DRAFTS), and no
 *   draft's page otherwise.
 * - At least one copied story in /columns/. Only a warning outside CI: a
 *   build without the network has none. In CI, the feed loader fails the
 *   build before it gets here when it can't read a feed, so none is a fault.
 * - Every page has one <h1> and one <main id="main">.
 * - Every page but the 404 has a canonical link: to itself, or (a copy) to
 *   somewhere else, and then it's noindex. The 404 is always noindex.
 * - The robots meta, as the README says: on every page while the paper
 *   isn't indexed (paper.index); otherwise only on pages noindex in their own
 *   right (Layout's data-noindex="page").
 * - The sitemap lists only pages that are there, by their canonical URL, and
 *   none that's noindex in its own right; robots.txt names it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { attr, DIST, fileOf, filesIn, htmlFiles, page, paper, pathOf, report, select } from "./dist";

const { fail, warn, done } = report("smoke");
const drafts = process.env.INCLUDE_DRAFTS === "1";
const site = (path: string) => new URL(path, paper.site).href;

// The pages and files every build has.
const core = ["/", "/latest/", "/staff/", "/about/", "/standards/", "/feeds/", "/search/", "/404.html", "/sitemap.xml", "/robots.txt", "/rss.xml", "/feed.json"];
for (const path of core) if (!fileOf(path)) fail(path, "missing from the build");

// Every story written here, by its frontmatter.
const stories = filesIn("src/content/stories", /^[^/]+\/[^_/][^/]*\.md$/).map((file) => {
	const source = readFileSync(join("src/content/stories", file), "utf8");
	const frontmatter = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? "";
	const field = (name: string) => new RegExp(`^${name}:\\s*(\\S+)`, "m").exec(frontmatter)?.[1];
	const [section, name] = file.split("/");
	return { file, section, slug: name.replace(/\.md$/, ""), kind: field("kind") ?? "article", draft: field("draft") === "true" };
});
const newswire = fileOf("/newswire/") ? select(page(fileOf("/newswire/")!), (el) => el.properties.id !== undefined).map((el) => attr(el, "id")) : [];
for (const story of stories) {
	const where = `src/content/stories/${story.file}`;
	const expected = !story.draft || drafts;
	const path = story.kind === "headline" ? `/newswire/#${story.slug}` : `/${story.section}/${story.slug}/`;
	const there = story.kind === "headline" ? newswire.includes(story.slug) : !!fileOf(path);
	if (expected && !there) fail(where, `a ${story.kind}${story.draft ? " (draft)" : ""}, isn't at ${path}`);
	if (!expected && there) fail(where, `a draft, is at ${path}, in a build without INCLUDE_DRAFTS=1`);
	if (expected && there && story.kind === "recipe") {
		const tree = page(fileOf(path)!);
		if (!select(tree, (el) => attr(el, "id") === "recipe").length) fail(path, "a recipe with no #recipe card");
	}
}

// The copies of the feeds' posts.
const columns = htmlFiles.filter((f) => /^columns\/.+\/index\.html$/.test(f));
if (!columns.length) {
	const message = "no copied stories in /columns/ (is the feed reachable?)";
	process.env.CI ? fail("/columns/", message) : warn("/columns/", message);
}

// Every page.
const pages = new Map<string, { canonical?: string; noindex?: string }>();
for (const file of htmlFiles) {
	const path = pathOf(file);
	const tree = page(file);
	const h1 = select(tree, (el) => el.tagName === "h1").length;
	if (h1 !== 1) fail(path, `${h1} <h1>s; a page has one`);
	const main = select(tree, (el) => el.tagName === "main");
	if (main.length !== 1 || attr(main[0], "id") !== "main") fail(path, `needs one <main id="main"> (the skip link's target), not ${main.length}`);

	const canonicals = select(tree, (el) => el.tagName === "link" && attr(el, "rel") === "canonical").map((el) => attr(el, "href"));
	const robots = select(tree, (el) => el.tagName === "meta" && attr(el, "name") === "robots");
	if (robots.length > 1) fail(path, `${robots.length} robots metas`);
	const content = robots[0] && attr(robots[0], "content");
	if (robots[0] && content !== "noindex, follow") fail(path, `robots meta is "${content}", not "noindex, follow"`);
	const noindex = robots[0] && attr(robots[0], "dataNoindex");
	if (robots[0] && noindex !== "page" && noindex !== "paper") fail(path, `robots meta has no data-noindex of "page" or "paper"`);
	pages.set(path, { canonical: canonicals[0], noindex });

	if (!paper.index && !robots.length) fail(path, "no robots noindex, while paper.index is off");
	if (paper.index && noindex === "paper") fail(path, "noindex for the whole paper, while paper.index is on");
	if (file === "404.html") {
		if (canonicals.length) fail(path, "the 404 has a canonical link; it's served at every missing URL");
		if (noindex !== "page") fail(path, "the 404 isn't noindex in its own right");
		continue;
	}
	if (canonicals.length !== 1) {
		fail(path, `${canonicals.length} canonical links; a page has one`);
		continue;
	}
	const canonical = canonicals[0]!;
	if (!/^https?:\/\//.test(canonical)) fail(path, `canonical "${canonical}" isn't absolute`);
	else if (canonical.startsWith(`${new URL(paper.site).origin}/`)) {
		if (canonical !== site(path)) fail(path, `canonical is ${canonical}, not the page itself`);
	} else if (noindex !== "page") fail(path, `canonical is elsewhere (${canonical}), so it's a copy, but it isn't noindex`);
}

// robots.txt and the sitemap.
const robotsTxt = readFileSync(join(DIST, "robots.txt"), "utf8");
if (!robotsTxt.includes(`Sitemap: ${site("/sitemap.xml")}`)) fail("/robots.txt", "doesn't name the sitemap");
const sitemap = readFileSync(join(DIST, "sitemap.xml"), "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
if (!locs.length) fail("/sitemap.xml", "lists nothing");
for (const loc of locs) {
	const url = new URL(loc);
	if (url.origin !== new URL(paper.site).origin) {
		fail("/sitemap.xml", `lists ${loc}, which isn't on ${paper.site}`);
		continue;
	}
	const info = pages.get(url.pathname);
	if (!info) fail("/sitemap.xml", `lists ${loc}, which isn't in the build`);
	else if (info.noindex === "page") fail("/sitemap.xml", `lists ${loc}, which is noindex`);
	else if (info.canonical !== loc) fail("/sitemap.xml", `lists ${loc}, whose canonical is ${info.canonical}`);
}

// The paper's feeds.
const rss = readFileSync(join(DIST, "rss.xml"), "utf8");
if (!/^<\?xml[^>]*\?>\s*<rss[\s>]/.test(rss)) fail("/rss.xml", "isn't an RSS document");
try {
	const feed = JSON.parse(readFileSync(join(DIST, "feed.json"), "utf8"));
	if (feed.version !== "https://jsonfeed.org/version/1.1") fail("/feed.json", `version is ${feed.version}, not JSON Feed 1.1`);
	if (!Array.isArray(feed.items)) fail("/feed.json", "has no items list");
} catch (e) {
	fail("/feed.json", `isn't JSON: ${(e as Error).message}`);
}

done(
	`${htmlFiles.length} pages, ${stories.filter((s) => !s.draft || drafts).length} stories, ${columns.length} columns, ${locs.length} sitemap URLs${drafts ? " (drafts included)" : ""}`,
);
