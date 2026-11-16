// @ts-check
import { satteri } from "@astrojs/markdown-satteri";
import { defineConfig } from "astro/config";
import paper from "./paper.config.ts";
import { storyBodies } from "./src/theme/markdown.ts";

// https://astro.build/config
export default defineConfig({
	site: paper.site,
	// Every page is a directory, served at its slashed URL; links match.
	trailingSlash: "always",
	// Astro's own Markdown processor, with the theme's rules for a recipe's
	// and a headline's body (src/theme/markdown.ts).
	markdown: { processor: satteri({ mdastPlugins: [storyBodies] }) },
});
