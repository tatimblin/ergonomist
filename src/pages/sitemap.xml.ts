import type { APIRoute } from "astro";
import paper from "../../paper.config";
import { getStaff, getStories, sectionHref, staffHref, storyHref } from "../theme/paper";

// Every page this paper is the original of: the front page, the sections, its
// own stories and its staff. A copied story's canonical is elsewhere, so it
// isn't ours to list.
export const GET: APIRoute = async () => {
	const stories = (await getStories(paper)).filter((s) => s.origin === "local");
	const staff = await getStaff(paper);
	const urls = [
		{ path: "/", lastmod: stories[0]?.entry.data.date },
		...paper.sections.map((s) => ({ path: sectionHref(s.id), lastmod: stories.find((t) => t.section === s.id)?.entry.data.date })),
		...stories.map((s) => ({ path: storyHref(s), lastmod: s.entry.data.date })),
		{ path: "/staff/", lastmod: undefined },
		...staff.map((p) => ({
			path: staffHref(p.id),
			lastmod: stories.find((s) => s.authors.some((a) => a.id === p.id))?.entry.data.date,
		})),
	];
	const body = urls
		.map(({ path, lastmod }) => {
			const loc = `<loc>${new URL(path, paper.site).href}</loc>`;
			return `<url>${loc}${lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : ""}</url>`;
		})
		.join("");
	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`,
		{ headers: { "content-type": "application/xml" } },
	);
};
