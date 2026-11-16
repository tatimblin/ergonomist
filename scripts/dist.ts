/**
 * What the checks over a build share (`bun run test`; scripts/smoke.ts,
 * links.ts and jsonld.ts): the built site in dist/ (or the directory given as
 * the first argument), its pages parsed, the files a URL is served from, and
 * a report that fails the run with every problem found, not just the first.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Element, Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import { visit } from "unist-util-visit";
import paper from "../paper.config";

export { paper };

export const DIST = process.argv[2] ?? "dist";

if (!existsSync(join(DIST, "index.html"))) {
	console.error(`There's no ${DIST}/index.html; run \`bun run build\` first.`);
	process.exit(1);
}

/** The files under a directory whose paths (relative to it) match, sorted. */
export const filesIn = (dir: string, match: RegExp) =>
	readdirSync(dir, { recursive: true, encoding: "utf8" })
		.filter((f) => match.test(f) && statSync(join(dir, f)).isFile())
		.sort();

/** Every HTML file in the build, as paths relative to it. */
export const htmlFiles = filesIn(DIST, /\.html$/);

/** The URL path a file is served at: about/index.html → /about/. */
export const pathOf = (file: string) => `/${file.replace(/(^|\/)index\.html$/, "$1")}`;

/** The file a URL path is served from, or undefined when there's none. A
 *  directory needs its trailing slash (links match the build's); /about would
 *  only be redirected there. */
export function fileOf(path: string): string | undefined {
	const rel = decodeURIComponent(path).replace(/^\//, "");
	const file = rel === "" || rel.endsWith("/") ? `${rel}index.html` : rel;
	const full = join(DIST, file);
	return existsSync(full) && statSync(full).isFile() ? file : undefined;
}

/** A URL on the paper's own site as a path (with its query and #fragment), or
 *  undefined for anywhere else. A relative URL is resolved against `from`. */
export function internal(url: string, from: string): string | undefined {
	if (/^(mailto|tel|javascript|data):/i.test(url)) return undefined;
	const base = new URL(paper.site);
	const resolved = new URL(url, new URL(from, base));
	if (resolved.origin !== base.origin) return undefined;
	return resolved.pathname + resolved.search + resolved.hash;
}

const parsed = new Map<string, Root>();

/** A page of the build, parsed. */
export function page(file: string): Root {
	let tree = parsed.get(file);
	if (!tree) {
		tree = fromHtml(readFileSync(join(DIST, file), "utf8"));
		parsed.set(file, tree);
	}
	return tree;
}

/** The elements of a page that match. */
export function select(tree: Root, match: (el: Element) => boolean): Element[] {
	const found: Element[] = [];
	visit(tree, "element", (el: Element) => {
		if (match(el)) found.push(el);
	});
	return found;
}

/** An attribute as written in the HTML; hast keeps a class list or rel as an array. */
export function attr(el: Element, name: string): string | undefined {
	const value = el.properties[name];
	if (value === undefined || value === null || value === false) return undefined;
	return Array.isArray(value) ? value.join(" ") : String(value);
}

/** An element's text, all of it. */
export function text(node: Root | Element | Root["children"][number]): string {
	if (node.type === "text") return node.value;
	return "children" in node ? node.children.map(text).join("") : "";
}

/** Every id on a page (and every <a name>): the #fragments that land on it. */
export function anchors(file: string): Set<string> {
	const ids = select(page(file), (el) => el.properties.id !== undefined || (el.tagName === "a" && el.properties.name !== undefined));
	return new Set(ids.flatMap((el) => [attr(el, "id"), el.tagName === "a" ? attr(el, "name") : undefined].filter((s) => s !== undefined)));
}

/** The JSON-LD blocks on a page, as written. */
export const jsonLdBlocks = (file: string) =>
	select(page(file), (el) => el.tagName === "script" && attr(el, "type") === "application/ld+json").map(text);

/** A check's report: every problem, then exit 1 if there were any. */
export function report(name: string) {
	const problems: string[] = [];
	const warnings: string[] = [];
	return {
		fail: (where: string, message: string) => void problems.push(`${where}: ${message}`),
		warn: (where: string, message: string) => void warnings.push(`${where}: ${message}`),
		done(checked: string) {
			for (const w of warnings) console.warn(`warning: ${w}`);
			for (const p of problems) console.error(`✗ ${p}`);
			if (problems.length) {
				console.error(`${name}: ${problems.length} problem${problems.length === 1 ? "" : "s"} in ${DIST}/.`);
				process.exit(1);
			}
			console.log(`${name}: ${checked}, all fine.`);
		},
	};
}
