# The Ergonomist

Serving the Mission since 2026. A small-town paper: tech, Mission news, recipes, and columns copied from [tristantimblin.dev](https://tristantimblin.dev).

Bare HTML for now; the design comes once there's enough in it.

## Writing

A story is a markdown file in `src/content/stories/<section>/<slug>.md`, where `<section>` is `tech`, `mission` or `recipes`. It's served at `/<section>/<slug>/`.

To start one:

```sh
bun run new <kind> <section> "Headline"   # e.g. bun run new recipe recipes "The Desk-Lunch Burrito"
bun run new recipe recipes "Philly Cheesesteak" --author tristan-timblin   # bylined
```

`scripts/new.ts` writes `src/content/stories/<section>/<slug>.md` (the slug made from the headline), dated today, with `draft: true` and the fields that kind needs, `TODO` where it needs a value: a `dek` for an article; a `dek`, `serves`, `prep`, `cook`, `ingredients` and a `## Method` list for a recipe; nothing more for a tidbit; and no body for a headline. `--author <staff id>` (more than once for more than one) sets `authors`. It refuses a kind, a section or an author it doesn't know (a feed's section, `columns`, is written elsewhere), and a file that's already there.

On the GitHub mobile editor, each section folder has a `_template.md` to copy: every field, the optional ones commented out, with placeholder values. A file whose name starts with `_` isn't a story (the glob in `src/content.config.ts` skips it).

```md
---
title: Fog Returns to Dolores Park, Declines to Comment
date: 2026-11-15
kind: tidbit        # article (the default), tidbit, recipe or headline
kicker: Fog Watch   # optional; the rubric above the headline (the series' name when left out)
dek: One line under the headline and in the lists. Articles and recipes need one.
dateline: Mission District, S.F.   # optional; opens the body as "MISSION DISTRICT, S.F.—"
authors: [tristan-timblin]  # staff ids; The Ergonomist Staff when left out
image:              # optional; the lead image
  src: ./fog.jpg    # next to this file
  alt: Fog over the Dolores Park palms.
  caption: The fog, Sunday.          # optional
  credit: Photo by Tristan Timblin   # optional, printed as written
updated: 2026-11-16 # optional; printed beside the date, and the sitemap's lastmod
updateNote: Adds a response from the fog.  # optional (needs `updated`), at the foot of the story
tags: [fog, dolores-park, mission-district]  # optional; lowercase words joined by hyphens
series: fog-watch   # optional; an id in src/content/series
veracity: satire    # optional: satire, or reported, which needs a `source`; no label when left out
source: https://example.com/the-real-story  # what a reported story is based on
corrections:        # optional, at the foot of the story, and at /corrections/
  - date: 2026-11-16
    text: An earlier version misidentified the fog.
    significant: true # optional; prints it at the top of the story instead
placement: lead     # optional; lead or featured, on the front page
draft: true         # shown by `bun run dev`, and built with INCLUDE_DRAFTS=1, only
---

The body.
```

A **tidbit** prints whole on the front page; its own page is `noindex` and out of the sitemap, a paragraph being too thin a page to send searchers to. A **recipe** and a **headline** are below. The examples in each folder show all four, and between them every field above.

### Recipes

A recipe is an article with a recipe card. Its frontmatter takes, as well as the fields above:

```md
kind: recipe
serves: 2                   # a whole number; required
yield: 2 large burritos     # optional; printed instead of "Serves 2"
prep: PT15M                 # ISO 8601 durations; prep and cook are required
cook: PT25M
active: PT30M               # optional
total: PT40M                # optional; prep plus cook when left out
difficulty: easy            # optional; easy, medium or hard
course: Lunch               # optional; schema.org's recipeCategory
cuisine: Mexican            # optional
diet: [vegetarian]          # optional
equipment: [Large skillet, Aluminum foil]  # optional
ingredients:                # required; a list, or a list per group:
  - group: For the beans
    items: [1 tablespoon olive oil, 1 (15-ounce) can pinto beans]
  - group: To assemble
    items:
      - 2 flour tortillas
      - item: 2 ciabatta demi-baguettes     # an item can name the product it's bought as
        product: ciabatta-demi-baguette     # an id in src/content/products
        buy: 2                              # optional; how many to buy, 1 when left out
        servings: 6.2                       # optional; how many of the product's servings the recipe uses
calories: 780               # optional; per serving (estimated from the products when left out)
testedBy: Tristan Timblin   # optional
```

Its body has a shape (`src/theme/markdown.ts` checks it, and a body that breaks it fails the build, drafts included):

- The prose before the first `##` is the headnote, where the joke goes. It prints above the recipe card.
- `## Method` is required: an ordered list, or `###` subsections (`### For the sauce`), each holding one ordered list and nothing else. The steps are numbered on through the subsections, and each has an anchor, `#step-3`.
- `## Notes`, `## Make Ahead and Storage` and `## Substitutions`, or any other `##`, print as written after the Method.

The page prints the headnote, then the card (yield, times as "1 hr 10 min", difficulty, course, cuisine, diet, equipment, calories and who tested it), the ingredients with a checkbox each, then the Method and notes. Its header has a "Jump to recipe" link and a Print button (the paper's only script), and printing it prints the recipe alone, black on white, ingredients in two columns, with a "Clipped from The Ergonomist, <url>" line (`src/theme/print.css`, the paper's only CSS besides `embeds.css`, which keeps embeds from overflowing a phone screen). Its structured data is a schema.org `Recipe`, following Google's recipe guidelines: its author and dates, the headnote as `text`, the times, yield, ingredients, the Method's steps (in `HowToSection`s for its subsections, each step linked to its anchor), course, cuisine, the diets schema.org names (`suitableForDiet`), nutrition, and its tags but the course and cuisine as keywords. Its `image` is its photo cropped to 1:1, 4:3 and 16:9, up to 1200 wide; a recipe with no `image` uses the paper's default card, `public/card.png`, since Google wants one, so give each recipe a photo of the dish. Its page title ends in "Recipe" (unless the headline says it), as searches do. There's no rating; it'd need real ones.

#### Products

An ingredient that names a `product` prints its image and a link to it on the store's site, and the card ends with a shopping list: each product once, how many to buy, its size and price, and the total, "as of" the oldest price. Products are shared: every recipe that uses the shaved beef names the same `product: all-natural-shaved-beef-steak`.

```sh
bun run products [word]          # what there is: id, name, size, price, serving size, and the recipes using it
bun run product <url>…           # a new one, from its Trader Joe's page
bun run product inbox/<page>.html  # or from a page saved from a browser
```

A product is `src/content/products/<id>.md`. `bun run product <url>` opens the page in Chrome, in a window, on this computer (Trader Joe's turns away headless browsers, so it can't run in CI; it needs Google Chrome installed), and keeps it in `inbox/`, which isn't committed. Saving the page yourself (Save Page As, Webpage, Complete) into `inbox/` and passing the file does the same. It writes `src/content/products/<id>.md` (the id from its name, `all-natural-shaved-beef-steak`): its name, store, URL, image, price and size as of today (`priced`), category, ingredients, and `nutrition` per serving from the label. It reads Trader Joe's pages, and refuses a file that's already there; edit a price by hand, with its `priced` date. When the store's page has no nutrition facts (produce), add them by hand from another source and link it as `nutrition.source` (the onion and crimini use USDA FoodData Central).

**Nutrition facts.** An ingredient that names a product with `nutrition` and says how many of its `servings` the recipe uses (by the product's `servingSize`: a 1 lb pack of 4 oz servings is 4) counts toward the recipe's nutrition facts: the sum, divided by `serves`, printed per serving after the shopping list, in the structured data's `NutritionInformation`, and as the card's calories unless `calories` says otherwise. A nutrient prints only when every counted product gives it. The page says it's an estimate, links any other source, and names the ingredients it doesn't count.

The image stays on the store's site. A reader's browser loads it; crawlers can't, so it's never a page's share image (a recipe's own `image` is that, or `public/card.png`), and feeds carry the link without it, since feed readers fetch images the same way.

### Headlines

A headline is the Newswire, after The Onion's: a `title`, a `date`, and optionally `authors` and `tags`, with no body and no dek (either fails the build, as does anything else a page would print).

```md
---
title: Mission Resident Describes Weather as "a Microclimate" for 14th Consecutive Year
date: 2026-11-13
kind: headline
tags: [fog, mission-district]
---
```

It has no page of its own. The latest ten print in the front page's Newswire, and all of them at `/newswire/`, newest first, each at its anchor, `/newswire/#<slug>`; that's where the lists, the feeds and the search link to it. Two headlines with one slug, in any sections, fail the build.

A story's page prints, top to bottom: kicker, headline, dek; byline and titles, the date (and update), reading time; its label, if it has one (**Satire**, or **Reported** with its source); any significant corrections; the lead image, caption and credit; the body; the update note and the other corrections; tags; the bio box; the membership ask (if `asks.membership` is set); up to three related stories (the rest of its series, then those sharing the most tags, then its section); and the previous and next stories in its section. Lists print the Satire or Reported label too, and a satire's description (`og:description` and all) starts "Satire: ". Copied stories are labelled **Column**: the author's own post, neither satire nor reporting.

The front page leads with the newest `placement: lead` story, then the `featured` ones, then the **Newswire**'s latest headlines, then each section's latest (without the stories and headlines already printed above), then **Most Read**: the story ids, `<section>/<slug>`, in `mostRead` in `paper.config.ts`, picked by hand. An id that names no story fails the build.

### Embeds

A paragraph holding nothing but a link to an Instagram post or reel prints the post in Instagram's own embed frame, with a "Watch on Instagram" link under it for readers and feeds that don't load the frame (`socialEmbeds` in `src/theme/markdown.ts`). Paste the URL on a line of its own; tracking parameters are dropped. The paper loads no script of Instagram's, and `src/theme/embeds.css` keeps the frame within the column on a phone. A link inside a sentence stays a link.

```md
https://www.instagram.com/reel/Df5J0IxqHv8/
```

## Tags, places, series and the archive

- `/tags/<tag>/` lists a tag's stories, with its feed at `/tags/<tag>/rss.xml`. Until a tag has 5 stories its page is `noindex` and out of the sitemap.
- A place is a tag, down to the street (`valencia`, `24th-street`); `places` in `paper.config.ts` says which tags are places, and `/places/` lists those with stories.
- A series is a markdown file in `src/content/series/<id>.md` with a `name` and a `description`; `/series/<id>/` lists its stories.
- `/latest/` is everything, copies included, newest first; `/archive/` links a page per year, `/archive/<year>/`.
- An empty section's page is `noindex` and out of the sitemap.

## Search

`/search/` is [Pagefind](https://pagefind.app)'s default UI (with its own stylesheet; `?q=` runs a search, as the masthead's search form does). After `astro build`, `bun run build` runs `src/theme/search-index.ts`, which indexes only the paper's own stories (those marked `data-pagefind-body`) into `dist/pagefind/`: no lists, and no copies, whose search result belongs to the original. The one list it indexes is `/newswire/`, since headlines have no pages; each is found at its anchor. There's no index on the dev server; try it with `bun run build && bun run preview`.

## Staff

Everyone who can be on a byline is a markdown file in `src/content/staff/<id>.md`; the body is the long bio. Each has a page at `/staff/<id>/` (bio, links, and everything they've filed, newest first) with its own feed at `/staff/<id>/rss.xml`, and the masthead at `/staff/` lists them all.

```md
---
name: A. Correspondent
title: Correspondent      # printed under the byline
beat: What they cover     # optional
short: One line, for the bio box at the end of each story and the masthead.
photo: ./photo.jpg        # optional, next to this file
links: [https://example.com]   # optional
email: tips@example.com   # optional, printed as the tip line
real: false               # a persona
group: Correspondents     # a masthead heading, one of staffGroups in paper.config.ts
order: 1                  # optional, within the group; then by name
---
```

`real` matters for search engines: a real person's stories carry them as a schema.org `Person`, linked to their staff page and their `links`. A persona's carry the paper itself as the author, so no made-up person appears in structured data. A byline naming someone who isn't in `src/content/staff` fails the build.

The paper's default byline (`byline` in `paper.config.ts`) is `ergonomist-staff`. Copied stories are bylined to their feed's `author`: Columns to `tristan-timblin`.

## The paper's own pages

`/about/`, `/standards/`, `/tips/` and `/corrections/` are written in `src/content/pages/<id>.md`: a `title`, a `description` (for search and sharing), and prose. Edit the markdown; each page's route (`src/pages/about.astro` and the rest) only adds what isn't prose:

- `/about/`, the fake founding history, then the real information, ends with a contact line. Its structured data is an `AboutPage` about the paper.
- `/standards/` (`standards` in `paper.config.ts`) also ends with the contact line. It must keep its `## Corrections` and `## Ethics` headings, since structured data names `#corrections` and `#ethics` as the paper's policies; without them the build fails.
- `/tips/` prints the real way to send a tip above the prose.
- `/corrections/` lists every story's corrections under the prose, newest first, each linked to its place on its story (`#correction-N`), with its own feed at `/corrections/rss.xml`. A satirical story can carry a satirical correction; it's listed like any other. Until there's one, the page is `noindex` and out of the sitemap.

The contact line is `contact` in `paper.config.ts`: its `email` once it's set, and until then "via tristantimblin.dev", linked. `asks` there holds the paper's parody asks: `membership`, printed at the foot of every story, and `newsletter`, printed in the footer with a link to the RSS feed. Leave either out to drop it.

Every page's footer links About, Staff, Standards, Corrections and Tips; then the Newswire, Latest, Archive, Places, Search, RSS and Feeds; then the newsletter line, the disclaimer, and "Satire unless marked Reported.", linked to the standards.

## Feeds

`src/theme/feeds.ts` writes them all:

- `/rss.xml` and `/feed.json` (a [JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/)): everything in the paper, newest first.
- `/<section>/rss.xml`: a section's stories.
- `/tags/<tag>/rss.xml`: a tag's stories.
- `/staff/<id>/rss.xml`: everything bylined to someone.
- `/corrections/rss.xml`: every correction.

The paper's own stories go in whole: the lead image, caption and credit, then the body as its page prints it (dateline, and a recipe's headnote and card), rendered by `src/theme/FeedContent.astro` through Astro's Container API, with every link and image made absolute. A copied story links to where it was first published, and a headline to its place in the Newswire; each carries only its dek. Each list page advertises its feed with `<link rel="alternate">` (every page advertises the paper's two) and links it as "RSS". `/feeds/` lists every feed, and is linked from the footer.

## Sharing

Every page has an `og:image`, with `og:image:alt`, `og:image:width` and `og:image:height`, and `twitter:card` is `summary_large_image`. A story's is its lead image, at most 1200 wide, as a JPEG or PNG; anything else's, and an SVG lead image's (Astro won't rasterize one), is the default card, `card` in `paper.config.ts` (`public/card.png`; its `alt`, `width` and `height` are set there and must match the file). A story also has `article:published_time`, `article:modified_time`, `article:section` and an `article:tag` per tag. Every URL in them is absolute. There are no generated per-story cards yet.

## Analytics

`analytics` in `paper.config.ts` is a [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/) token (in the Cloudflare dashboard: Analytics & Logs, Web Analytics, add the site, and copy the token from its JS snippet). It's unset, and nothing is loaded. Once it's set, every page loads Cloudflare's beacon, `https://static.cloudflareinsights.com/beacon.min.js`, which sets no cookies, and `/about/` says so in one line.

## Columns

`/columns/` is copied at build time from the JSON Feeds in `paper.config.ts` (today, tristantimblin.dev's `/feed.json`). Only posts with `syndicate: true` in their frontmatter on tristantimblin.dev are copied. Each copy's canonical link points at the original, and the copy is `noindex, follow`. Headings in a copy start at `<h2>`, and its relative links point at the original.

A feed that can't be fetched (an error status, no answer in 10 s after a retry, or not JSON) is a warning on the dev server. In CI (`CI` set) the build prints the last good copy instead, `/wire.json` on the deployed paper, and fails if that can't be fetched either; a 404 there is a wrong URL, and fails at once. A feed filed under a section that isn't configured, and two stories at one URL, fail the build everywhere.

tristantimblin.dev rebuilds the paper when it deploys, by sending this repo a `repository_dispatch` of type `tristantimblin-deployed`.

## Layout

- `paper.config.ts` — the name, tagline, address, founding date (the issue number counts weeks from it), footer line, sections and feeds (each with its `author`), the default byline, the masthead's group order, the place tags, Most Read, the standards page's path, the default card, the analytics token, the contact, the parody asks, and `index` (off: every page is `noindex` until the paper has a domain).
- `astro.config.mjs` — adds the theme's Markdown rules (`src/theme/markdown.ts`) to Astro's Markdown processor, Sätteri.
- `src/content/pages/` — the prose of `/about/`, `/standards/`, `/tips/` and `/corrections/`.
- `src/theme/` — the reusable part: layout, story list and page, the paper's own pages and contact line, body (with its dateline), recipe card, Satire/Reported label, byline and author box, schemas, the Markdown rules for recipes and headlines, feed loader, the feeds it writes (`feeds.ts` and `FeedContent.astro`), search indexer, `paper.css` (empty), `print.css` (a recipe, printed) and `embeds.css` (embeds that fit a phone). It knows nothing about The Ergonomist, so it can become its own package once there's a design.
- `src/pages/` — the routes: front page, sections, stories, tags, places, series, the Newswire, latest, archive, search, staff and masthead, about, standards, tips, corrections, the feeds (RSS for the paper, each section, tag and author and the corrections; `feed.json`) and `/feeds/`, sitemap, robots.txt, `wire.json` (the copied stories), 404.
- `scripts/new.ts` — `bun run new`, a new story's file.
- `scripts/product.ts` — `bun run product`, a product's file from its page.
- `scripts/products.ts` — `bun run products`, the products there are and what uses them.
- `scripts/test.ts`, `smoke.ts`, `links.ts`, `jsonld.ts` (and `dist.ts`, what they share), `.htmlvalidate.mjs` — `bun run test`, the checks of a build (see Checks).
- `public/_headers` — cache headers: a year for `/_astro/*`, five minutes for the feeds, `wire.json` and the sitemap.
- `public/card.png` — the default card: the image a page is shared with when it has none, and a recipe's image in structured data until it has a photo.

Every page carries Open Graph tags (see Sharing). The paper's own stories carry schema.org JSON-LD: `Article` (`SatiricalArticle` for satire, `NewsArticle` when reported, `Recipe` for a recipe) with `dateModified`, `image` (its lead image in Google's three shapes) and `mainEntityOfPage`, and a `BreadcrumbList`. Sections, tags, series, the Newswire, the latest and the archive years are `CollectionPage`s; staff pages are `ProfilePage`s; `/about/` is an `AboutPage` and the standards, tips and corrections are `WebPage`s; the front page and `/about/` have the paper as a `NewsMediaOrganization` (its `publishingPrinciples` the standards page, its `correctionsPolicy` and `ethicsPolicy` that page's `#corrections` and `#ethics`, and its `email` once `contact.email` is set), and the front page a `WebSite` with a `SearchAction`. The sitemap lists the indexable pages, each with the newest `updated` among its stories as its lastmod (the corrections page's, its newest correction), and a story's own image as an `image:image`. Once the paper is indexed, an indexable page's robots meta is `max-image-preview:large`, so search and Discover can show its photo large.

```sh
bun install
bun run dev
bun run build
bun run check    # astro check
bun run test     # the checks, over an existing dist/
bun run deploy   # build, then publish dist/ to https://ergonomist.tatimblin.workers.dev
```

Set `TRISTANTIMBLIN_FEED` to read Columns from another feed URL (e.g. a local build of tristantimblin.dev). Set `INCLUDE_DRAFTS=1` to build the drafts too, as the dev server does.

It's hosted as a Cloudflare Worker serving static files (`wrangler.jsonc`). `.github/workflows/deploy.yml` checks every pull request, and deploys from main once the checks pass and the repo has the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.

## Checks

`bun run test` checks a build in `dist/` (or the directory it's given), every check to the end, and fails if any found a problem. Build first, with the same `INCLUDE_DRAFTS`: the smoke test expects the drafts' pages only then.

```sh
bun run build && bun run test
INCLUDE_DRAFTS=1 bun run build && INCLUDE_DRAFTS=1 bun run test
```

- **smoke** (`scripts/smoke.ts`): the front page, `/latest/`, `/staff/`, `/about/`, `/standards/`, `/feeds/`, `/search/`, the 404, the sitemap, `robots.txt`, `/rss.xml` and `/feed.json` are there; every story has its page (a headline, its place in the Newswire; a recipe, its card), and no draft does unless `INCLUDE_DRAFTS=1`; there's at least one copied story in `/columns/` (a warning outside CI, where a build without the network has none); every page has one `<h1>` and one `<main id="main">`; every page but the 404 has a canonical link, to itself or, for a copy, elsewhere and then `noindex`; the robots meta is on every page while `index` is off, and otherwise only on pages `noindex` in their own right (the layout marks which with `data-noindex`, `page` or `paper`); the sitemap lists pages in the build, by their canonical URL, and none `noindex` in its own right.
- **html** ([html-validate](https://html-validate.org), `.htmlvalidate.mjs`): every page, by the recommended rules, but `long-title` (a story's title is its headline, however long).
- **links** (`scripts/links.ts`): every link to the paper's own site (an `href`, `src`, `srcset` or form `action`, the `og:url` and `og:image`, and every URL in the JSON-LD) is a file in the build, and its `#fragment` an id on that page. A directory's link needs its trailing slash. Links elsewhere aren't checked.
- **jsonld** (`scripts/jsonld.ts`): every JSON-LD block is JSON in schema.org's context, and every node has what its `@type` needs, by zod shapes; a `@type` with none fails, so a new one gets one. A `Person` is only ever a real member of the staff, at their staff page's URL.

CI runs `astro check`, the build and `bun run test` twice, as published and with `INCLUDE_DRAFTS=1`, and deploys the published build.
