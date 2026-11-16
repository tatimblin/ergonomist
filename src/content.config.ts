import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import paper from "../paper.config";
import { feedLoader } from "./theme/feed-loader";
import { pageSchema, seriesSchema, staffSchema, storySchema, wireSchema } from "./theme/schema";

// Stories written here: src/content/stories/<section>/<slug>.md. A file whose
// name starts with "_" (each section's _template.md) isn't a story.
const stories = defineCollection({
	loader: glob({ pattern: ["**/*.{md,mdx}", "!**/_*"], base: "./src/content/stories" }),
	schema: storySchema(paper),
});

// Stories copied from the feeds in paper.config.ts.
const wire = defineCollection({
	loader: feedLoader(paper),
	schema: wireSchema,
});

// The masthead: src/content/staff/<id>.md, bylined by id.
const staff = defineCollection({
	loader: glob({ pattern: "*.md", base: "./src/content/staff" }),
	schema: staffSchema(paper),
});

// Running bits: src/content/series/<id>.md, named by a story's `series`.
const series = defineCollection({
	loader: glob({ pattern: "*.md", base: "./src/content/series" }),
	schema: seriesSchema,
});

// The paper's own pages: src/content/pages/<id>.md, each printed by its route
// (src/pages/about.astro and the rest).
const pages = defineCollection({
	loader: glob({ pattern: "*.md", base: "./src/content/pages" }),
	schema: pageSchema,
});

export const collections = { stories, wire, staff, series, pages };
