import type { APIRoute, GetStaticPaths } from "astro";
import paper from "../../../paper.config";
import { rssFeed } from "../../theme/feeds";
import { getStories, type Section, type Story } from "../../theme/paper";

// One feed per section: its stories, copies and headlines included.
export const getStaticPaths = (async () => {
	const stories = await getStories(paper);
	return paper.sections.map((section) => ({
		params: { section: section.id },
		props: { section, stories: stories.filter((s) => s.section === section.id) },
	}));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
	const { section, stories } = props as { section: Section; stories: Story[] };
	return rssFeed(paper, { title: `${section.label} — ${paper.name}`, description: `${section.label} in ${paper.name}.`, stories });
};
