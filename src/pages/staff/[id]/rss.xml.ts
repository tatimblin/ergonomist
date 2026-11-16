import type { APIRoute, GetStaticPaths } from "astro";
import paper from "../../../../paper.config";
import { rssFeed } from "../../../theme/feeds";
import { getStaff, getStories, type Staff } from "../../../theme/paper";

// One feed per person on the staff: everything bylined to them, copies included.
export const getStaticPaths = (async () =>
	(await getStaff(paper)).map((person) => ({ params: { id: person.id }, props: { person } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
	const { person } = props as { person: Staff };
	return rssFeed(paper, {
		title: `${person.data.name} — ${paper.name}`,
		description: person.data.short,
		stories: (await getStories(paper)).filter((s) => s.authors.some((a) => a.id === person.id)),
	});
};
