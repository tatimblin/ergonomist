import type { APIRoute, GetStaticPaths } from "astro";
import events from "../../../data/jobs/events.json";
import { jobsFeed } from "../../../jobs/feed";
import { teamSlug, type JobEvent } from "../../../jobs/jobs";

// One team's changes (src/jobs/feed.ts).
export const getStaticPaths = (() => {
	const teams = new Map<string, string>();
	for (const e of events as JobEvent[]) teams.set(teamSlug(e.team), e.team);
	return [...teams].map(([slug, name]) => ({ params: { team: slug }, props: { slug, name } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => jobsFeed(props as { slug: string; name: string });
