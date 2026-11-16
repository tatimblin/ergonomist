import rss from "@astrojs/rss";
import type { APIRoute, GetStaticPaths } from "astro";
import paper from "../../../../paper.config";
import { getStaff, getStories, rssItem, type Staff } from "../../../theme/paper";

// One feed per person on the staff: everything bylined to them, copies included.
export const getStaticPaths = (async () =>
	(await getStaff(paper)).map((person) => ({ params: { id: person.id }, props: { person } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
	const { person } = props as { person: Staff };
	return rss({
		title: `${person.data.name} — ${paper.name}`,
		description: person.data.short,
		site: paper.site,
		items: (await getStories(paper)).filter((s) => s.authors.some((a) => a.id === person.id)).map(rssItem),
	});
};
