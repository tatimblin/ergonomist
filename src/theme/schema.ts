import { reference, type SchemaContext } from "astro:content";
import { z } from "astro/zod";
import type { Paper } from "./paper";

/** A list of staff ids, as frontmatter writes them: `authors: [jane-doe]`. */
const authors = () => z.array(reference("staff")).min(1);

/** A tag as it's written and as its URL prints it: lowercase words joined by
 *  hyphens, "24th-street". */
export const TAG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A story written for the paper, in src/content/stories/<section>/<slug>.md.
 * `kind` decides how it prints:
 *   article — a headline, a dek and a body, on its own page.
 *   tidbit  — a brief: a headline and a paragraph or two, printed whole on the
 *             front page as well as on its own page. Needs no `dek`.
 *   recipe  — an article with `ingredients` (and optionally `serves`, `time`)
 *             printed above the method, which is the body.
 * `authors` are staff ids; a story that names none is the paper's `byline`.
 * Everything is satire unless it says `veracity: reported`, and then it must
 * link its `source`.
 */
export const storySchema =
	(paper: Paper) =>
	({ image }: SchemaContext) =>
		z
			.object({
				title: z.string(),
				date: z.coerce.date(),
				kind: z.enum(["article", "tidbit", "recipe"]).default("article"),
				// The rubric above the headline; the series' name when left out.
				kicker: z.string().optional(),
				// One line under the headline and in the lists.
				dek: z.string().optional(),
				// Where it was filed, "Mission District, S.F.": printed in caps,
				// with a dash, at the head of the body.
				dateline: z.string().optional(),
				authors: authors().prefault([paper.byline]),
				// The lead image, a file next to the story's.
				image: z
					.object({ src: image(), alt: z.string(), caption: z.string().optional(), credit: z.string().optional() })
					.strict()
					.optional(),
				updated: z.coerce.date().optional(),
				// What the update changed, printed at the foot of the story.
				updateNote: z.string().optional(),
				tags: z.array(z.string().regex(TAG, 'Tags are lowercase words joined by hyphens: "24th-street".')).default([]),
				series: reference("series").optional(),
				veracity: z.enum(["satire", "reported"]).default("satire"),
				// What a reported story is based on.
				source: z.url().optional(),
				corrections: z.array(z.object({ date: z.coerce.date(), text: z.string() }).strict()).default([]),
				// On the front page: the newest "lead" tops it, the "featured" follow.
				placement: z.enum(["lead", "featured"]).optional(),
				ingredients: z.array(z.string()).optional(),
				serves: z.string().optional(),
				time: z.string().optional(),
				draft: z.boolean().default(false),
			})
			// A misspelt key fails the build instead of vanishing.
			.strict()
			.superRefine((story, ctx) => {
				if (story.kind === "recipe" && !story.ingredients?.length) {
					ctx.addIssue({ code: "custom", path: ["ingredients"], message: "A recipe needs ingredients." });
				}
				if (story.kind !== "recipe" && (story.ingredients || story.serves || story.time)) {
					ctx.addIssue({ code: "custom", path: ["kind"], message: 'Only kind: "recipe" takes ingredients, serves or time.' });
				}
				if (story.kind !== "tidbit" && !story.dek) {
					ctx.addIssue({ code: "custom", path: ["dek"], message: "An article or recipe needs a dek." });
				}
				if (story.veracity === "reported" && !story.source) {
					ctx.addIssue({ code: "custom", path: ["source"], message: "A reported story needs a source." });
				}
				if (story.updateNote && !story.updated) {
					ctx.addIssue({ code: "custom", path: ["updated"], message: "An updateNote needs the date of the update." });
				}
				if (story.updated && story.updated < story.date) {
					ctx.addIssue({ code: "custom", path: ["updated"], message: "A story can't be updated before it's published." });
				}
			});

/** A running bit, in src/content/series/<id>.md: every story naming it is
 *  listed at /series/<id>/. */
export const seriesSchema = z.object({ name: z.string(), description: z.string() }).strict();

/** A story copied from a feed (feed-loader.ts). Its body is the feed item's
 *  content_html and its dek the item's summary; `canonical` is where it was
 *  first published, and `authors` is the feed's `author`. */
export const wireSchema = z.object({
	title: z.string(),
	date: z.coerce.date(),
	modified: z.coerce.date().optional(),
	dek: z.string().optional(),
	section: z.string(),
	slug: z.string(),
	canonical: z.url(),
	source: z.string(),
	authors: authors(),
});

/**
 * Someone on the masthead, in src/content/staff/<id>.md; the body is the long
 * bio. A paper can mix real people and personas: `real: false` keeps a
 * persona out of structured data, where the paper itself stands in for it.
 * `group` is the masthead heading they're listed under, one of
 * paper.staffGroups; `order` sorts them within it (then by name).
 */
export const staffSchema =
	(paper: Paper) =>
	({ image }: SchemaContext) =>
		z
			.object({
				name: z.string(),
				title: z.string(),
				beat: z.string().optional(),
				// One line: the bio box at the end of a story, and the masthead.
				short: z.string(),
				photo: image().optional(),
				links: z.array(z.url()).optional(),
				email: z.email().optional(),
				real: z.boolean(),
				group: z.string().refine((g) => paper.staffGroups.includes(g), {
					message: `Must be one of paper.staffGroups: ${paper.staffGroups.join(", ")}.`,
				}),
				order: z.number().optional(),
			})
			.strict();
