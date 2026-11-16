/**
 * The internal link check (`bun run test:links [dist]`): every link on every
 * page to the paper's own site (an href, a src or srcset, a form's action,
 * the og:url and og:image, and every URL in its JSON-LD), relative or
 * absolute, is served from a file in the build, and its #fragment, if it has
 * one, is an id on that page. Links to anywhere else aren't checked.
 */
import { anchors, attr, fileOf, htmlFiles, internal, jsonLdBlocks, page, pathOf, report, select } from "./dist";

const { fail, done } = report("links");
let checked = 0;

/** Every string in a JSON value. */
const strings = (value: unknown): string[] =>
	typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];

for (const file of htmlFiles) {
	const from = pathOf(file);
	const urls: [string, string][] = [];
	for (const el of select(page(file), () => true)) {
		for (const name of ["href", "src", "action"]) {
			const value = attr(el, name);
			if (value !== undefined) urls.push([`<${el.tagName} ${name}>`, value]);
		}
		const srcset = attr(el, "srcSet");
		if (srcset) for (const candidate of srcset.split(",")) urls.push([`<${el.tagName} srcset>`, candidate.trim().split(/\s+/)[0]]);
		const property = attr(el, "property");
		if (el.tagName === "meta" && (property === "og:url" || property === "og:image")) urls.push([`<meta ${property}>`, attr(el, "content") ?? ""]);
	}
	for (const block of jsonLdBlocks(file)) {
		try {
			for (const s of strings(JSON.parse(block))) if (/^https?:\/\//.test(s)) urls.push(["JSON-LD", s]);
		} catch {
			// Invalid JSON-LD is jsonld.ts's to report.
		}
	}

	for (const [where, url] of urls) {
		const path = internal(url, from);
		if (path === undefined) continue;
		checked++;
		const [rest, fragment] = path.split("#", 2);
		const target = fileOf(rest.split("?")[0]);
		if (!target) {
			fail(from, `${where} ${url}: nothing in the build is served there`);
			continue;
		}
		if (fragment && target.endsWith(".html") && !anchors(target).has(decodeURIComponent(fragment))) {
			fail(from, `${where} ${url}: there's no #${fragment} on ${pathOf(target)}`);
		}
	}
}

done(`${checked} internal links on ${htmlFiles.length} pages`);
