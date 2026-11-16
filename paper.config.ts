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
	site: "https://ergonomist.tatimblin.workers.dev",
	// Vol. I, No. 1. The masthead's issue number is the weeks since.
	founded: "2026-11-15",
	// Keep search engines out (a noindex on every page) while this is a
	// preview on workers.dev. Flip, and change `site`, once it has a domain.
	index: false,
	// The line printed in every page's footer.
	disclaimer: "If a school newspaper were made by adults",
	// Sections in masthead order. A local story's section is its folder under
	// src/content/stories; a syndicated story's section is named by its feed.
	sections: [
		{ id: "tech", label: "Tech" },
		{ id: "mission", label: "Mission" },
		{ id: "recipes", label: "Recipes" },
		{ id: "columns", label: "Columns" },
	],
	// The staff id (src/content/staff) on a story that names no authors.
	byline: "ergonomist-staff",
	// The masthead at /staff/, in this order. A staff entry's `group` is one.
	staffGroups: ["Editors", "Correspondents", "Test Kitchen", "Columnists"],
	// The tags that are places, down to the street, listed at /places/. A place
	// tag is an ordinary tag otherwise: /tags/valencia/.
	places: ["mission-district", "dolores-park", "valencia", "24th-street"],
	// The front page's "Most Read", picked by hand: story ids, <section>/<slug>.
	// One that names no story fails the build.
	mostRead: ["tech/standing-desk-reaches-full-height", "mission/dolores-park-fog-returns"],
	// The editorial standards, named in the front page's structured data.
	standards: "/standards/",
	// The default card, in public/: the image of a recipe with no photo yet,
	// since Google wants one in a Recipe's structured data.
	card: "/card.png",
	// Posts copied from elsewhere. Each item keeps a canonical link back to
	// where it was first published.
	feeds: [
		{
			// TRISTANTIMBLIN_FEED overrides it locally, e.g. with an unmerged build of the feed.
			url: process.env.TRISTANTIMBLIN_FEED ?? "https://tristantimblin.dev/feed.json",
			section: "columns",
			source: "tristantimblin.dev",
			// Copies are bylined to whoever wrote them there.
			author: "tristan-timblin",
			// Only the posts marked `syndicate: true` in their frontmatter there.
			include: (item) => (item._tristantimblin as { syndicate?: boolean } | undefined)?.syndicate === true,
		},
	],
} satisfies Paper;
