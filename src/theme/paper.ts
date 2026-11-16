/**
 * The theme's model of a paper and its stories. Everything under src/theme is
 * the reusable part: the markup, the schemas and the feed loader, written
 * against a `Paper` and knowing nothing about The Ergonomist. Kept in this repo
 * until there is a design worth sharing; it moves out as a package then.
 */
import { getCollection, type CollectionEntry } from "astro:content";

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
}

export type Staff = CollectionEntry<"staff">;

interface Bylined {
	section: string;
	slug: string;
	/** Its `authors`, looked up in the staff collection. */
	authors: Staff[];
}

/** One story as the pages see it, written here or copied from a feed. */
export type Story =
	| (Bylined & { origin: "local"; entry: CollectionEntry<"stories"> })
	| (Bylined & { origin: "feed"; entry: CollectionEntry<"wire"> });

export const storyHref = (story: Pick<Story, "section" | "slug">) => `/${story.section}/${story.slug}/`;
export const sectionHref = (section: string) => `/${section}/`;
export const staffHref = (id: string) => `/staff/${id}/`;

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
	// A byline names someone who isn't on the masthead: a typo, so fail.
	const byline = (refs: { id: string }[], what: string) =>
		refs.map(({ id }) => {
			const person = staff.get(id);
			if (!person) throw new Error(`${what} is bylined to "${id}", who isn't in src/content/staff.`);
			return person;
		});
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
			return { origin: "local", section, slug: rest.join("/"), authors, entry };
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

/** A story as an RSS item. A copy links to where it was first published. */
export const rssItem = (story: Story) => ({
	title: story.entry.data.title,
	pubDate: story.entry.data.date,
	description: story.entry.data.summary,
	link: story.origin === "feed" ? story.entry.data.canonical : storyHref(story),
	categories: [story.section],
});

/** The paper as a schema.org Organization: the publisher of every story, and
 *  the author of those under a persona's byline. */
export const organizationLd = (paper: Paper) => ({ "@type": "Organization", name: paper.name, url: paper.site });

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

export const formatDate = (date: Date) =>
	date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The issue dated `date`: No. 1 in the founding week, and one more each week. */
export const issueNumber = (paper: Paper, date: Date) =>
	Math.max(1, Math.floor((date.getTime() - new Date(paper.founded).getTime()) / WEEK_MS) + 1);
