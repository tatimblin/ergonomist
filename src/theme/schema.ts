import { reference, type SchemaContext } from "astro:content";
import { z } from "astro/zod";
import type { Paper } from "./paper";

/** A list of staff ids, as frontmatter writes them: `authors: [jane-doe]`. */
const authors = () => z.array(reference("staff")).min(1);

/**
 * A story written for the paper, in src/content/stories/<section>/<slug>.md.
 * `kind` decides how it prints:
 *   article — a headline, a dek and a body, on its own page.
 *   tidbit  — a brief: a headline and a paragraph or two, printed whole on the
 *             front page as well as on its own page. Needs no `summary`.
 *   recipe  — an article with `ingredients` (and optionally `serves`, `time`)
 *             printed above the method, which is the body.
 * `authors` are staff ids; a story that names none is the paper's `byline`.
 */
export const storySchema = (paper: Paper) =>
	z
		.object({
			title: z.string(),
			date: z.coerce.date(),
			kind: z.enum(["article", "tidbit", "recipe"]).default("article"),
			// The dek: one line under the headline and in the lists.
			summary: z.string().optional(),
			authors: authors().prefault([paper.byline]),
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
			if (story.kind !== "tidbit" && !story.summary) {
				ctx.addIssue({ code: "custom", path: ["summary"], message: "An article or recipe needs a summary." });
			}
		});

/** A story copied from a feed (feed-loader.ts). Its body is the feed item's
 *  content_html; `canonical` is where it was first published, and `authors`
 *  is the feed's `author`. */
export const wireSchema = z.object({
	title: z.string(),
	date: z.coerce.date(),
	modified: z.coerce.date().optional(),
	summary: z.string().optional(),
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
