import type { Loader } from "astro/loaders";
import type { Feed } from "./paper";

interface JsonFeedItem {
	id: string;
	url?: string;
	title?: string;
	summary?: string;
	content_html?: string;
	date_published?: string;
	date_modified?: string;
}

/**
 * Copies the items of JSON Feeds into a collection, a story each, with the
 * item's content_html as the rendered body. Items without a url, title, date
 * or content_html are skipped: a copy needs somewhere to point back to and
 * something to print.
 *
 * A feed that can't be fetched is a warning, not a failed build: the paper
 * still prints, without that feed's stories, rather than not at all.
 */
export function feedLoader(feeds: Feed[]): Loader {
	return {
		name: "ergonomist-feed-loader",
		async load({ store, logger, parseData, generateDigest }) {
			store.clear();
			for (const feed of feeds) {
				let items: JsonFeedItem[];
				try {
					const res = await fetch(feed.url, { headers: { accept: "application/feed+json, application/json" } });
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					items = ((await res.json()) as { items?: JsonFeedItem[] }).items ?? [];
				} catch (err) {
					logger.warn(`Skipped ${feed.url}: ${(err as Error).message}`);
					continue;
				}
				let copied = 0;
				for (const item of items) {
					const canonical = item.url ?? item.id;
					if (!URL.canParse(canonical) || !item.title || !item.date_published || !item.content_html) continue;
					if (feed.include && !feed.include(item as unknown as Record<string, unknown>)) continue;
					// The last path segment of the original URL: /txt/mega-desk/ → mega-desk.
					const slug = new URL(canonical).pathname.split("/").filter(Boolean).pop();
					if (!slug) continue;
					const id = `${feed.section}/${slug}`;
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
						},
					});
					store.set({
						id,
						data,
						rendered: { html: item.content_html },
						digest: generateDigest({ ...data, html: item.content_html }),
					});
					copied++;
				}
				logger.info(`Copied ${copied} stories from ${feed.source}.`);
			}
		},
	};
}
