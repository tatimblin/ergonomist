/**
 * The paper: everything that makes this The Ergonomist rather than any other
 * paper the theme (src/theme) could print. The theme reads only this.
 */
import type { Paper } from "./src/theme/paper";

export default {
	name: "The Ergonomist",
	tagline: "Serving the Mission since 2026",
	price: "25¢",
	// The deployed origin: canonical links and the feed are built against it.
	site: "https://ergonomist.news",
	// Sections in masthead order. A local story's section is its folder under
	// src/content/stories; a syndicated story's section is named by its feed.
	sections: [
		{ id: "tech", label: "Tech" },
		{ id: "mission", label: "Mission" },
		{ id: "recipes", label: "Recipes" },
		{ id: "columns", label: "Columns" },
	],
	// Posts copied from elsewhere. Each item keeps a canonical link back to
	// where it was first published.
	feeds: [
		{
			url: "https://tristantimblin.dev/feed.json",
			section: "columns",
			source: "tristantimblin.dev",
		},
	],
} satisfies Paper;
