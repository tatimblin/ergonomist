import type { APIRoute } from "astro";
import paper from "../../paper.config";

// Crawling stays open even while the paper isn't indexed: a crawler has to
// fetch a page to read its noindex.
export const GET: APIRoute = () =>
	new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL("/sitemap.xml", paper.site).href}\n`, {
		headers: { "content-type": "text/plain" },
	});
