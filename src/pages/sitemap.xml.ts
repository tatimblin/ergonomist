import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import paper from "../../paper.config";
import {
	archiveHref,
	getCorrections,
	getStaff,
	getStories,
	getTags,
	getYears,
	isHeadline,
	lastModified,
	MIN_INDEXED_TAG,
	modifiedOf,
	sectionHref,
	seriesHref,
	staffHref,
	storyHref,
	tagHref,
	type Story,
} from "../theme/paper";

// Every indexable page this paper is the original of: the front page, the
// sections with stories, its own stories but the tidbits (noindex) and the
// headlines (no page; they're in the Newswire), its staff, the tags with
// MIN_INDEXED_TAG stories or more, its series, the Newswire, its own pages
// (/about/, the standards, /tips/, and /corrections/ once there's one), the
// latest, the archive and /feeds/. A copied story's canonical is elsewhere, so it isn't ours to list.
// A page's lastmod is the newest change (`updated`) among its stories.
export const GET: APIRoute = async () => {
	const all = await getStories(paper);
	const stories = all.filter((s) => s.origin === "local");
	const headlines = stories.filter(isHeadline);
	const staff = await getStaff(paper);
	const series = await getCollection("series");
	const corrections = getCorrections(stories);
	const list = (path: string, of: Story[]) => ({ path, lastmod: lastModified(of) });
	const urls = [
		list("/", all),
		...paper.sections
			.map((s) => ({ id: s.id, of: all.filter((t) => t.section === s.id) }))
			.filter(({ of }) => of.length > 0)
			.map(({ id, of }) => list(sectionHref(id), of)),
		...stories
			.filter((s) => s.origin === "local" && s.entry.data.kind !== "tidbit" && !isHeadline(s))
			.map((s) => ({ path: storyHref(s), lastmod: modifiedOf(s) })),
		...(headlines.length ? [list("/newswire/", headlines)] : []),
		{ path: "/staff/", lastmod: undefined },
		...staff.map((p) => list(staffHref(p.id), stories.filter((s) => s.authors.some((a) => a.id === p.id)))),
		...[...getTags(stories)].filter(([, of]) => of.length >= MIN_INDEXED_TAG).map(([tag, of]) => list(tagHref(tag), of)),
		...series
			.map((s) => ({ id: s.id, of: stories.filter((t) => t.series?.id === s.id) }))
			.filter(({ of }) => of.length > 0)
			.map(({ id, of }) => list(seriesHref(id), of)),
		{ path: "/about/", lastmod: undefined },
		{ path: paper.standards, lastmod: undefined },
		{ path: "/tips/", lastmod: undefined },
		...(corrections.length ? [{ path: "/corrections/", lastmod: corrections[0].date }] : []),
		list("/latest/", all),
		list("/archive/", all),
		{ path: "/feeds/", lastmod: undefined },
		...[...getYears(all)].map(([year, of]) => list(archiveHref(year), of)),
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
