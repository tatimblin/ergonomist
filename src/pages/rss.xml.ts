import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import paper from "../../paper.config";
import { getStories, rssItem } from "../theme/paper";

// Every story, copied ones included; those link to where they were first
// published. Each item's description is its dek; its categories, its section and tags.
export const GET: APIRoute = async () =>
	rss({
		title: paper.name,
		description: paper.tagline,
		site: paper.site,
		items: (await getStories(paper)).map(rssItem),
	});
