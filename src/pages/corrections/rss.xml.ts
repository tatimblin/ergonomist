import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import paper from "../../../paper.config";
import { correctionHref, getCorrections, getStories } from "../../theme/paper";

// Every correction, newest first: titled for its story, dated when it was
// made, linked (absolutely, so the anchor keeps no trailing slash) to its
// place on the story's page, which is also its guid.
export const GET: APIRoute = async () =>
	rss({
		title: `Corrections — ${paper.name}`,
		description: `Every correction ${paper.name} has made, newest first.`,
		site: paper.site,
		items: getCorrections(await getStories(paper)).map((c) => ({
			title: `Correction: ${c.story.entry.data.title}`,
			pubDate: c.date,
			description: c.text,
			link: new URL(correctionHref(c), paper.site).href,
		})),
	});
