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
}

export interface Paper {
	name: string;
	tagline: string;
	price: string;
	site: string;
	sections: Section[];
	feeds: Feed[];
}

/** One story as the pages see it, written here or copied from a feed. */
export type Story =
	| { origin: "local"; section: string; slug: string; entry: CollectionEntry<"stories"> }
	| { origin: "feed"; section: string; slug: string; entry: CollectionEntry<"wire"> };

export const storyHref = (story: Pick<Story, "section" | "slug">) => `/${story.section}/${story.slug}/`;
export const sectionHref = (section: string) => `/${section}/`;

/** Every published story, newest first. Drafts show on the dev server only. */
export async function getStories(paper: Paper): Promise<Story[]> {
	const known = new Set(paper.sections.map((s) => s.id));
	const local = (await getCollection("stories", (e) => import.meta.env.DEV || !e.data.draft)).map(
		(entry): Story => {
			// "mission/taqueria-closes" → section "mission", slug "taqueria-closes".
			const [section, ...rest] = entry.id.split("/");
			if (!rest.length || !known.has(section)) {
				throw new Error(
					`Story "${entry.id}" must sit in a section folder (${[...known].join(", ")}).`,
				);
			}
			return { origin: "local", section, slug: rest.join("/"), entry };
		},
	);
	const copied = (await getCollection("wire")).map(
		(entry): Story => ({ origin: "feed", section: entry.data.section, slug: entry.data.slug, entry }),
	);
	return [...local, ...copied].sort((a, b) => b.entry.data.date.getTime() - a.entry.data.date.getTime());
}

export const formatDate = (date: Date) =>
	date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
