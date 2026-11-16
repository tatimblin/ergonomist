import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import paper from "../../paper.config";
import type { WireItem } from "../theme/feed-loader";

// The last good copy of every feed: the stories copied into this build, as a
// JSON Feed. A CI build whose feed can't be fetched prints these instead
// (feed-loader.ts), so a feed being down doesn't empty a section.
export const GET: APIRoute = async () => {
	const items = (await getCollection("wire")).map(
		({ data, rendered }): WireItem => ({
			id: data.canonical,
			url: data.canonical,
			title: data.title,
			summary: data.dek,
			content_html: rendered?.html,
			date_published: data.date.toISOString(),
			date_modified: data.modified?.toISOString(),
			_ergonomist: { section: data.section, source: data.source },
		}),
	);
	return new Response(
		JSON.stringify({
			version: "https://jsonfeed.org/version/1.1",
			title: `${paper.name}: copied stories`,
			home_page_url: paper.site,
			feed_url: new URL("/wire.json", paper.site).href,
			items,
		}),
		{ headers: { "content-type": "application/feed+json" } },
	);
};
