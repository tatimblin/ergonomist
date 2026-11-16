import type { APIRoute } from "astro";
import paper from "../../paper.config";
import { jsonFeed } from "../theme/feeds";
import { getStories } from "../theme/paper";

// The paper's RSS feed as a JSON Feed: every story, the paper's own in full.
export const GET: APIRoute = async () =>
	jsonFeed(paper, { title: paper.name, description: paper.tagline, path: "/feed.json", stories: await getStories(paper) });
