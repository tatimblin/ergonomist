/**
 * The theme's model of a paper and its stories. Everything under src/theme is
 * the reusable part: the markup, the schemas and the feed loader, written
 * against a `Paper` and knowing nothing about The Ergonomist. Kept in this repo
 * until there is a design worth sharing; it moves out as a package then.
 */
import { getCollection, type CollectionEntry } from "astro:content";
import { TAG } from "./schema";

export interface Section {
	id: string;
	label: string;
}

export interface Feed {
	/** A JSON Feed 1.1 (https://www.jsonfeed.org/version/1.1/) whose items
	 *  carry content_html. */
	url: string;
	/** The section its items print in. */
	section: string;
	/** Where they came from, as printed under each copied story. */
	source: string;
	/** Which of the feed's items to copy, given the raw item (extensions
	 *  included). Every item with a body, when left out. */
	include?: (item: Record<string, unknown>) => boolean;
	/** The staff id its copies are bylined to; the paper's `byline` when
	 *  left out. */
	author?: string;
}

export interface Paper {
	name: string;
	tagline: string;
	price: string;
	site: string;
	/** The first issue's date, ISO (2026-11-15). The issue number counts the
	 *  weeks since. */
	founded: string;
	/** Whether search engines may index the paper. */
	index: boolean;
	/** One line printed in every footer: what kind of paper this is. */
	disclaimer: string;
	sections: Section[];
	feeds: Feed[];
	/** The staff id a story is bylined to when it names no `authors`. */
	byline: string;
	/** The masthead's headings, in the order /staff/ prints them. Every staff
	 *  entry's `group` is one of these. */
	staffGroups: string[];
	/** The tags that are places (neighbourhoods, streets), listed at /places/. */
	places: string[];
	/** The front page's "Most Read", in order: story ids, `<section>/<slug>`. */
	mostRead: string[];
	/** The path of the paper's editorial standards, for structured data. */
	standards: string;
}

export type Staff = CollectionEntry<"staff">;
export type Series = CollectionEntry<"series">;

interface Bylined {
	section: string;
	slug: string;
	/** Its `authors`, looked up in the staff collection. */
	authors: Staff[];
	/** Its `series`, looked up in the series collection. */
	series?: Series;
}

/** One story as the pages see it, written here or copied from a feed. */
export type Story =
	| (Bylined & { origin: "local"; entry: CollectionEntry<"stories"> })
	| (Bylined & { origin: "feed"; entry: CollectionEntry<"wire"> });

export const storyHref = (story: Pick<Story, "section" | "slug">) => `/${story.section}/${story.slug}/`;
export const sectionHref = (section: string) => `/${section}/`;
export const staffHref = (id: string) => `/staff/${id}/`;
export const tagHref = (tag: string) => `/tags/${tag}/`;
export const seriesHref = (id: string) => `/series/${id}/`;
export const archiveHref = (year: number) => `/archive/${year}/`;

/** A tag as printed: "24th-street" → "24th Street". */
export const tagLabel = (tag: string) => tag.replace(/(^|-)(\w)/g, (_, dash, c: string) => (dash ? " " : "") + c.toUpperCase());

/** A tag page is noindex (and out of the sitemap) until it has this many. */
export const MIN_INDEXED_TAG = 5;

/** Everyone on the masthead, by group order, then `order`, then name. */
export async function getStaff(paper: Paper): Promise<Staff[]> {
	const rank = (s: Staff) => paper.staffGroups.indexOf(s.data.group);
	return (await getCollection("staff")).sort(
		(a, b) =>
			rank(a) - rank(b) ||
			(a.data.order ?? Infinity) - (b.data.order ?? Infinity) ||
			a.data.name.localeCompare(b.data.name),
	);
}

/** Every published story, newest first. Drafts show on the dev server only. */
export async function getStories(paper: Paper): Promise<Story[]> {
	const known = new Set(paper.sections.map((s) => s.id));
	const staff = new Map((await getCollection("staff")).map((s) => [s.id, s]));
	const series = new Map((await getCollection("series")).map((s) => [s.id, s]));
	// A byline names someone who isn't on the masthead: a typo, so fail.
	const byline = (refs: { id: string }[], what: string) =>
		refs.map(({ id }) => {
			const person = staff.get(id);
			if (!person) throw new Error(`${what} is bylined to "${id}", who isn't in src/content/staff.`);
			return person;
		});
	for (const place of paper.places) {
		if (!TAG.test(place)) throw new Error(`paper.places has "${place}", which isn't written as a tag ("24th-street").`);
	}
	const local = (await getCollection("stories", (e) => import.meta.env.DEV || !e.data.draft)).map(
		(entry): Story => {
			// "mission/taqueria-closes" → section "mission", slug "taqueria-closes".
			const [section, ...rest] = entry.id.split("/");
			if (!rest.length || !known.has(section)) {
				throw new Error(
					`Story "${entry.id}" must sit in a section folder (${[...known].join(", ")}).`,
				);
			}
			const authors = byline(entry.data.authors, `Story "${entry.id}"`);
			const ref = entry.data.series?.id;
			if (ref && !series.has(ref)) throw new Error(`Story "${entry.id}" is in series "${ref}", which isn't in src/content/series.`);
			return { origin: "local", section, slug: rest.join("/"), authors, series: ref ? series.get(ref) : undefined, entry };
		},
	);
	// A copy and a story of our own at one URL would be one page lost.
	const ours = new Set(local.map(storyHref));
	const copied = (await getCollection("wire")).map((entry): Story => {
		const authors = byline(entry.data.authors, `The copy of ${entry.data.canonical}`);
		const story: Story = { origin: "feed", section: entry.data.section, slug: entry.data.slug, authors, entry };
		if (ours.has(storyHref(story))) {
			throw new Error(`The copy of ${entry.data.canonical} would print over our own story at ${storyHref(story)}.`);
		}
		return story;
	});
	return [...local, ...copied].sort((a, b) => b.entry.data.date.getTime() - a.entry.data.date.getTime());
}

/** The rubric above a story's headline: its `kicker`, else its series' name. */
export const kickerOf = (story: Story) => (story.origin === "local" ? story.entry.data.kicker : undefined) ?? story.series?.data.name;

/** A story's tags; a copy has none. */
export const tagsOf = (story: Story) => (story.origin === "local" ? story.entry.data.tags : []);

/**
 * Whether a story is satire or reported, and what a reported one is based on.
 * A copy is a column: the real author's own post, neither a bit nor
 * reporting. Its source is the original.
 */
export const veracityOf = (story: Story): { veracity: "satire" | "reported" | "column"; source?: string } =>
	story.origin === "local"
		? { veracity: story.entry.data.veracity, source: story.entry.data.source }
		: { veracity: "column", source: story.entry.data.canonical };

/** When a story last changed: its `updated` (a copy's `modified`), else its date. */
export const modifiedOf = (story: Story) =>
	(story.origin === "local" ? story.entry.data.updated : story.entry.data.modified) ?? story.entry.data.date;

/** The newest change among some stories, for a sitemap's lastmod. */
export const lastModified = (stories: Story[]) =>
	stories.reduce<Date | undefined>((max, s) => (!max || modifiedOf(s) > max ? modifiedOf(s) : max), undefined);

const WORDS_PER_MINUTE = 230;

/** Minutes to read the body, at least one. A copy's body is its HTML. */
export function readingMinutes(story: Story): number {
	const text = story.origin === "local" ? (story.entry.body ?? "") : (story.entry.rendered?.html ?? "").replace(/<[^>]*>/g, " ");
	return Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / WORDS_PER_MINUTE));
}

/** Every tag in use, with its stories (newest first), in alphabetical order. */
export function getTags(stories: Story[]): Map<string, Story[]> {
	const tags = new Map<string, Story[]>();
	for (const story of stories) for (const tag of tagsOf(story)) tags.set(tag, [...(tags.get(tag) ?? []), story]);
	return new Map([...tags].sort(([a], [b]) => a.localeCompare(b)));
}

/** Every year with a story in it, newest first, with its stories. */
export function getYears(stories: Story[]): Map<number, Story[]> {
	const years = new Map<number, Story[]>();
	for (const story of stories) {
		const year = story.entry.data.date.getUTCFullYear();
		years.set(year, [...(years.get(year) ?? []), story]);
	}
	return new Map([...years].sort(([a], [b]) => b - a));
}

/**
 * Up to `n` stories to read next: the rest of its series first, then those
 * sharing the most tags with it, then the rest of its section; newest first
 * within each.
 */
export function relatedStories(story: Story, stories: Story[], n = 3): Story[] {
	const tags = new Set(tagsOf(story));
	const shared = (s: Story) => tagsOf(s).filter((t) => tags.has(t)).length;
	const rank = (s: Story) =>
		story.series && s.series?.id === story.series.id ? 2 : shared(s) > 0 ? 1 : s.section === story.section ? 0 : -1;
	return stories
		.filter((s) => s !== story && rank(s) >= 0)
		.map((s, i) => ({ s, i, rank: rank(s), shared: shared(s) }))
		// stories is newest first already: i breaks the ties.
		.sort((a, b) => b.rank - a.rank || b.shared - a.shared || a.i - b.i)
		.slice(0, n)
		.map(({ s }) => s);
}

/** The stories either side of this one in its section: the one before it
 *  (older) and the one after it (newer). */
export function sectionNeighbours(story: Story, stories: Story[]): { previous?: Story; next?: Story } {
	const section = stories.filter((s) => s.section === story.section);
	const i = section.indexOf(story);
	return { previous: section[i + 1], next: i > 0 ? section[i - 1] : undefined };
}

/** paper.mostRead as stories. An id that names no story, ours or copied, is a
 *  typo and fails the build; a draft's is skipped outside the dev server. */
export async function getMostRead(paper: Paper, stories: Story[]): Promise<Story[]> {
	const byId = new Map(stories.map((s) => [`${s.section}/${s.slug}`, s]));
	const drafts = new Set((await getCollection("stories", (e) => e.data.draft)).map((e) => e.id));
	return paper.mostRead.flatMap((id) => {
		const story = byId.get(id);
		if (!story && !drafts.has(id)) throw new Error(`paper.mostRead has "${id}", which is no story (it's <section>/<slug>).`);
		return story ? [story] : [];
	});
}

/** A story as an RSS item. A copy links to where it was first published. */
export const rssItem = (story: Story) => ({
	title: story.entry.data.title,
	pubDate: story.entry.data.date,
	description: story.entry.data.dek,
	link: story.origin === "feed" ? story.entry.data.canonical : storyHref(story),
	categories: [story.section, ...tagsOf(story)],
});

/** The paper as a schema.org NewsMediaOrganization: the publisher of every
 *  story, and the author of those under a persona's byline. */
export const organizationLd = (paper: Paper) => ({ "@type": "NewsMediaOrganization", name: paper.name, url: paper.site });

/** A real person on the staff as a schema.org Person. */
export const personLd = (paper: Paper, person: Staff) => ({
	"@type": "Person",
	name: person.data.name,
	url: new URL(staffHref(person.id), paper.site).href,
	...(person.data.links?.length && { sameAs: person.data.links }),
});

/**
 * A byline as schema.org `author`: a Person for each real author, and the
 * paper for the personas, so no one fictional is ever passed off as a Person
 * in structured data.
 */
export function authorLd(paper: Paper, authors: Staff[]) {
	const real = authors.filter((a) => a.data.real).map((a) => personLd(paper, a));
	const all = real.length < authors.length ? [...real, organizationLd(paper)] : real;
	return all.length === 1 ? all[0] : all;
}

/** The trail to a page as a schema.org BreadcrumbList: [name, path] pairs,
 *  the front page first. */
export const breadcrumbLd = (paper: Paper, trail: [string, string][]) => ({
	"@type": "BreadcrumbList",
	itemListElement: trail.map(([name, path], i) => ({
		"@type": "ListItem",
		position: i + 1,
		name,
		item: new URL(path, paper.site).href,
	})),
});

/** A list page (a section, a tag, a series, the latest) as a schema.org
 *  CollectionPage of its stories. */
export const collectionLd = (paper: Paper, name: string, path: string, stories: Story[]) => ({
	"@type": "CollectionPage",
	name,
	url: new URL(path, paper.site).href,
	isPartOf: { "@type": "WebSite", name: paper.name, url: paper.site },
	mainEntity: {
		"@type": "ItemList",
		itemListElement: stories.map((s, i) => ({
			"@type": "ListItem",
			position: i + 1,
			url: s.origin === "feed" ? s.entry.data.canonical : new URL(storyHref(s), paper.site).href,
		})),
	},
});

export const formatDate = (date: Date) =>
	date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The issue dated `date`: No. 1 in the founding week, and one more each week. */
export const issueNumber = (paper: Paper, date: Date) =>
	Math.max(1, Math.floor((date.getTime() - new Date(paper.founded).getTime()) / WEEK_MS) + 1);
