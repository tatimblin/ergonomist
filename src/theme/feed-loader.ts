import type { DataStore, Loader } from "astro/loaders";
import type { Element, Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import { visit } from "unist-util-visit";
import type { Feed, Paper } from "./paper";

interface JsonFeedItem {
	id: string;
	url?: string;
	title?: string;
	summary?: string;
	content_html?: string;
	date_published?: string;
	date_modified?: string;
}

/** A copy as /wire.json prints it: a JSON Feed item, plus where it was filed. */
export interface WireItem extends JsonFeedItem {
	_ergonomist: { section: string; source: string };
}

const TIMEOUT_MS = 10_000;

/** A failure no retry or fallback can fix: the paper's config is wrong. */
class ConfigError extends Error {}

/**
 * Copies the items of JSON Feeds into a collection, a story each, with the
 * item's content_html as the rendered body. Items without a url, title, date
 * or content_html are skipped: a copy needs somewhere to point back to and
 * something to print.
 *
 * A feed that can't be fetched (an error status, no answer in 10 s after one
 * retry, or a body that isn't JSON) is a warning on the dev server: the paper
 * still prints, without that feed's new stories. In CI it falls back to the
 * last good copy, the deployed paper's /wire.json, and fails the build if that
 * can't be had either, rather than deploy a paper with a section gone; a 404
 * there means the URL is wrong, and fails without the fallback. A feed filed
 * under a section that doesn't exist and two copies with the same slug fail
 * the build everywhere.
 */
export function feedLoader(paper: Paper): Loader {
	const strict = !!process.env.CI;
	return {
		name: "ergonomist-feed-loader",
		async load({ store, logger, parseData, generateDigest }) {
			const known = new Set(paper.sections.map((s) => s.id));
			for (const feed of paper.feeds) {
				if (!known.has(feed.section)) {
					throw new Error(`The feed ${feed.url} files into section "${feed.section}", which isn't in paper.sections.`);
				}
			}

			// Fetch everything first: the store keeps its last copies until a
			// feed's new ones are in hand.
			const fetched: { feed: Feed; items: JsonFeedItem[] }[] = [];
			let wire: Promise<WireItem[]> | undefined;
			for (const feed of paper.feeds) {
				try {
					const items = ((await fetchJson(feed.url, true)) as { items?: unknown }).items ?? [];
					if (!Array.isArray(items)) throw new Error("`items` isn't a list");
					const included = (items as JsonFeedItem[]).filter(
						(item) => !feed.include || feed.include(item as unknown as Record<string, unknown>),
					);
					fetched.push({ feed, items: included });
				} catch (err) {
					const reason = `${feed.url}: ${(err as Error).message}`;
					if (!strict) {
						logger.warn(`Skipped ${reason}`);
						continue;
					}
					if (err instanceof ConfigError) throw new Error(`Feed ${reason}`);
					// The last good copy is already filtered by `include`.
					const lastGood = new URL("/wire.json", paper.site).href;
					try {
						wire ??= fetchJson(lastGood, false).then((body) => (body as { items?: WireItem[] }).items ?? []);
						const items = (await wire).filter(
							(i) => i._ergonomist?.section === feed.section && i._ergonomist?.source === feed.source,
						);
						logger.error(
							`FEED FAILED (${reason}). Printing the last good copy instead: ${items.length} stories from ${lastGood}.`,
						);
						fetched.push({ feed, items });
					} catch (fallbackErr) {
						throw new Error(`Feed ${reason}; the last good copy at ${lastGood} failed too: ${(fallbackErr as Error).message}`);
					}
				}
			}

			const entries: Parameters<DataStore["set"]>[0][] = [];
			const ids = new Map<string, string>();
			for (const { feed, items } of fetched) {
				for (const item of items) {
					const canonical = item.url ?? item.id;
					if (!URL.canParse(canonical) || !item.title || !item.date_published || !item.content_html) continue;
					// The last path segment of the original URL: /txt/mega-desk/ → mega-desk.
					const slug = new URL(canonical).pathname.split("/").filter(Boolean).pop();
					if (!slug) continue;
					const id = `${feed.section}/${slug}`;
					if (ids.has(id)) throw new Error(`Two copied stories would print at /${id}/: ${ids.get(id)} and ${canonical}.`);
					ids.set(id, canonical);
					const html = cleanHtml(item.content_html, canonical);
					const data = await parseData({
						id,
						data: {
							title: item.title,
							date: item.date_published,
							modified: item.date_modified,
							summary: item.summary,
							section: feed.section,
							slug,
							canonical,
							source: feed.source,
							authors: [feed.author ?? paper.byline],
						},
					});
					entries.push({ id, data, rendered: { html }, digest: generateDigest({ ...data, html }) });
				}
			}

			// Replace the copies of the feeds that came back; a skipped feed's stay.
			const refreshed = new Set(fetched.map(({ feed }) => `${feed.section} ${feed.source}`));
			for (const [id, { data }] of store.entries()) {
				if (refreshed.has(`${data.section} ${data.source}`)) store.delete(id);
			}
			for (const entry of entries) store.set(entry);
			for (const { feed } of fetched) {
				logger.info(`Copied ${entries.filter((e) => e.data.source === feed.source).length} stories from ${feed.source}.`);
			}
		},
	};
}

/** A JSON body, waiting 10 s for it and retrying once after a timeout, a
 *  network error or a 5xx. With `notFoundIsConfig`, a 404 means the URL in
 *  the config is wrong, and isn't retried. */
async function fetchJson(url: string, notFoundIsConfig: boolean): Promise<unknown> {
	for (let attempt = 1; ; attempt++) {
		let res: Response;
		try {
			res = await fetch(url, {
				headers: { accept: "application/feed+json, application/json" },
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
		} catch (err) {
			if (attempt < 2) continue;
			throw err;
		}
		if (res.status === 404 && notFoundIsConfig) throw new ConfigError("HTTP 404; is the url in paper.config.ts right?");
		if (res.status >= 500 && attempt < 2) continue;
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		try {
			return await res.json();
		} catch {
			throw new Error("the body isn't JSON");
		}
	}
}

// Attributes that hold a URL, as hast names them.
const URL_PROPS = ["href", "src", "poster", "cite"];

/**
 * A feed item's content_html, made fit to print inside a story page: an <h1>
 * becomes an <h2> (the page's headline is its only h1), and relative links and
 * images are resolved against the original, where they point. A link to an
 * anchor on the page itself (#notes) is left alone.
 */
export function cleanHtml(html: string, base: string): string {
	const tree: Root = fromHtml(html, { fragment: true });
	const resolve = (value: string) => (value.startsWith("#") || !URL.canParse(value, base) ? value : new URL(value, base).href);
	visit(tree, "element", (node: Element) => {
		if (node.tagName === "h1") node.tagName = "h2";
		for (const prop of URL_PROPS) {
			const value = node.properties[prop];
			if (typeof value === "string") node.properties[prop] = resolve(value);
		}
		// srcset is a list of candidates, "a.png 1x": resolve each URL, keep its descriptor.
		const srcset = node.properties.srcSet;
		if (srcset != null) {
			// A string or a list, depending on the parser; String() joins a list with commas.
			node.properties.srcSet = String(srcset)
				.split(",")
				.map((c) => c.trim().replace(/^\S+/, resolve))
				.join(", ");
		}
	});
	return toHtml(tree);
}
