import rss from "@astrojs/rss";
import paper from "../../paper.config";
import events from "../data/jobs/events.json";
import { companyList, companyName, describeChange, localDate, daysBetween, QUIET_DAYS, teamSlug, type JobEvent } from "./jobs";

/** The Jobs desk's feed: every change in the last QUIET_DAYS, newest first; with `team`, that team's. */
export function jobsFeed(team?: { slug: string; name: string }) {
	const today = localDate(new Date().toISOString());
	const items = (events as JobEvent[])
		.filter((e) => daysBetween(localDate(e.at), today) < QUIET_DAYS)
		.filter((e) => !team || teamSlug(e.team) === team.slug)
		.sort((a, b) => b.at.localeCompare(a.at))
		.map((e) => {
			const verb = e.type === "opened" ? "New" : e.type === "closed" ? "Closed" : "Changed";
			const description =
				e.type === "changed"
					? `${companyName(e.company)} changed this role: ${describeChange(e)}.`
					: e.type === "closed"
						? `${companyName(e.company)} closed this role${e.openDays !== undefined ? ` after ${e.openDays} days` : ""}.`
						: `${companyName(e.company)} opened this role on its ${e.team} team in San Francisco.`;
			return {
				title: `${verb} at ${companyName(e.company)}: ${e.title}`,
				link: e.url,
				pubDate: new Date(e.at),
				description,
				categories: [e.team, companyName(e.company)],
				customData: `<guid isPermaLink="false">${e.company}/${e.id}/${e.type}/${e.at}</guid>`,
			};
		});
	const href = team ? `/jobs/${team.slug}/` : "/jobs/";
	return rss({
		title: `${team ? `${team.name} jobs` : "AI lab jobs"} in San Francisco — ${paper.name}`,
		description: `Roles at ${companyList()} in San Francisco as they open, change and close.`,
		site: new URL(href, paper.site).href,
		items,
	});
}
