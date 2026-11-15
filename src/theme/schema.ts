import { z } from "astro:content";

/**
 * A story written for the paper, in src/content/stories/<section>/<slug>.md.
 * `kind` decides how it prints:
 *   article — a headline, a dek and a body, on its own page.
 *   tidbit  — a brief: a headline and a paragraph or two, printed whole on the
 *             front page as well as on its own page. Needs no `summary`.
 *   recipe  — an article with `ingredients` (and optionally `serves`, `time`)
 *             printed above the method, which is the body.
 */
export const storySchema = z
	.object({
		title: z.string(),
		date: z.coerce.date(),
		kind: z.enum(["article", "tidbit", "recipe"]).default("article"),
		// The dek: one line under the headline and in the lists.
		summary: z.string().optional(),
		byline: z.string().optional(),
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
 *  content_html; `canonical` is where it was first published. */
export const wireSchema = z.object({
	title: z.string(),
	date: z.coerce.date(),
	modified: z.coerce.date().optional(),
	summary: z.string().optional(),
	section: z.string(),
	slug: z.string(),
	canonical: z.url(),
	source: z.string(),
});
