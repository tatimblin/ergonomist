// @ts-check
import { defineConfig } from "astro/config";
import paper from "./paper.config.ts";

// https://astro.build/config
export default defineConfig({
	site: paper.site,
	// Every page is a directory, served at its slashed URL; links match.
	trailingSlash: "always",
});
