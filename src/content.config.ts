import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import paper from "../paper.config";
import { feedLoader } from "./theme/feed-loader";
import { storySchema, wireSchema } from "./theme/schema";

// Stories written here: src/content/stories/<section>/<slug>.md.
const stories = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/stories" }),
	schema: storySchema,
});

// Stories copied from the feeds in paper.config.ts.
const wire = defineCollection({
	loader: feedLoader(paper),
	schema: wireSchema,
});

export const collections = { stories, wire };
