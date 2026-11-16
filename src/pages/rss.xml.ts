import type { APIRoute } from "astro";
import paper from "../../paper.config";
import { rssFeed } from "../theme/feeds";
import { getStories } from "../theme/paper";

// Every story, copied ones and headlines included (feeds.ts): the paper's own
// in full, the copies linked to where they were first published, the
// headlines to their place in the Newswire. Each item's description is its
// dek (a headline has none); its categories, its section and tags.
export const GET: APIRoute = async () =>
	rssFeed(paper, { title: paper.name, description: paper.tagline, stories: await getStories(paper) });
