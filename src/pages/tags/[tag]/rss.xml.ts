import type { APIRoute, GetStaticPaths } from "astro";
import paper from "../../../../paper.config";
import { rssFeed } from "../../../theme/feeds";
import { getStories, getTags, tagLabel, type Story } from "../../../theme/paper";

// One feed per tag in use: every story carrying it.
export const getStaticPaths = (async () =>
	[...getTags(await getStories(paper))].map(([tag, stories]) => ({ params: { tag }, props: { tag, stories } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
	const { tag, stories } = props as { tag: string; stories: Story[] };
	return rssFeed(paper, { title: `${tagLabel(tag)} — ${paper.name}`, description: `Stories tagged ${tagLabel(tag)}.`, stories });
};
