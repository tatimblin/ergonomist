/**
 * The paper's feeds: RSS (the paper's, each section's, tag's and staff
 * member's) and one JSON Feed. The paper's own stories carry their whole body
 * as their page prints it (FeedContent, rendered through Astro's Container
 * API), every URL in it absolute. A copy links to where it was first
 * published, and a headline to its place in the Newswire; both carry no more
 * than their dek.
 */
import rss from "@astrojs/rss";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import FeedContent from "./FeedContent.astro";
import { cleanHtml } from "./feed-loader";
import { isHeadline, modifiedOf, shareImage, staffHref, storyUrl, tagsOf, type Paper, type Story } from "./paper";

// One container for the whole build, made on first use.
let container: Promise<AstroContainer> | undefined;

/** A story of the paper's own as a feed item's HTML, its relative links and
 *  images resolved against its page. A copy or a headline has none. */
export async function storyContent(paper: Paper, story: Story): Promise<string | undefined> {
	if (story.origin !== "local" || isHeadline(story)) return undefined;
	container ??= AstroContainer.create();
	const html = await (await container).renderToString(FeedContent, { props: { story } });
	return cleanHtml(html, storyUrl(paper, story));
}

/** A story as an RSS item: its dek as the description, its section and tags
 *  as categories. Links are absolute: @astrojs/rss would put a trailing slash
 *  after a relative link's #anchor. */
const rssItem = async (paper: Paper, story: Story) => ({
	title: story.entry.data.title,
	pubDate: story.entry.data.date,
	description: story.entry.data.dek,
	link: storyUrl(paper, story),
	categories: [story.section, ...tagsOf(story)],
	content: await storyContent(paper, story),
});

/** An RSS feed of some stories, newest first. */
export async function rssFeed(paper: Paper, feed: { title: string; description: string; stories: Story[] }): Promise<Response> {
	return rss({
		title: feed.title,
		description: feed.description,
		site: paper.site,
		items: await Promise.all(feed.stories.map((s) => rssItem(paper, s))),
	});
}

/** Some stories as a JSON Feed 1.1 (https://www.jsonfeed.org/version/1.1/)
 *  served at `path`: the same items as the RSS, with their authors, tags,
 *  lead image and date modified. */
export async function jsonFeed(paper: Paper, feed: { title: string; description: string; path: string; stories: Story[] }): Promise<Response> {
	const items = await Promise.all(
		feed.stories.map(async (story) => {
			const { title, date, dek } = story.entry.data;
			const html = await storyContent(paper, story);
			// The lead image as the story's page shares it; the default card is no story's.
			const shared = await shareImage(paper, story);
			const image = shared !== paper.card && shared;
			const tags = tagsOf(story);
			return {
				id: storyUrl(paper, story),
				url: storyUrl(paper, story),
				title,
				// An item needs a body: a copy's or a headline's is its dek, else its title.
				...(html ? { content_html: html } : { content_text: dek ?? title }),
				...(dek && { summary: dek }),
				...(image && { image: new URL(image.src, paper.site).href }),
				date_published: date.toISOString(),
				date_modified: modifiedOf(story).toISOString(),
				authors: story.authors.map((a) => ({ name: a.data.name, url: new URL(staffHref(a.id), paper.site).href })),
				...(tags.length && { tags }),
			};
		}),
	);
	return new Response(
		JSON.stringify({
			version: "https://jsonfeed.org/version/1.1",
			title: feed.title,
			description: feed.description,
			home_page_url: paper.site,
			feed_url: new URL(feed.path, paper.site).href,
			language: "en",
			items,
		}),
		{ headers: { "content-type": "application/feed+json" } },
	);
}
