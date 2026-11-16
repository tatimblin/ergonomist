# The Ergonomist

Serving the Mission since 2026. A small-town paper: tech, Mission news, recipes, and columns copied from [tristantimblin.dev](https://tristantimblin.dev).

Bare HTML for now; the design comes once there's enough in it.

## Writing

A story is a markdown file in `src/content/stories/<section>/<slug>.md`, where `<section>` is `tech`, `mission` or `recipes`. It's served at `/<section>/<slug>/`.

```md
---
title: Fog Returns to Dolores Park, Declines to Comment
date: 2026-11-15
kind: tidbit        # article (the default), tidbit, recipe or headline
kicker: Fog Watch   # optional; the rubric above the headline (the series' name when left out)
dek: One line under the headline and in the lists. Articles and recipes need one.
dateline: Mission District, S.F.   # optional; opens the body as "MISSION DISTRICT, S.F.—"
authors: [dale-footrest]  # staff ids; The Ergonomist Staff when left out
image:              # optional; the lead image
  src: ./fog.jpg    # next to this file
  alt: Fog over the Dolores Park palms.
  caption: The fog, Sunday.          # optional
  credit: Photo by Dale Footrest     # optional, printed as written
updated: 2026-11-16 # optional; printed beside the date, and the sitemap's lastmod
updateNote: Adds a response from the fog.  # optional (needs `updated`), at the foot of the story
tags: [fog, dolores-park, mission-district]  # optional; lowercase words joined by hyphens
series: fog-watch   # optional; an id in src/content/series
veracity: satire    # the default; or reported, which needs a `source`
source: https://example.com/the-real-story  # what a reported story is based on
corrections:        # optional, at the foot of the story, and at /corrections/
  - date: 2026-11-16
    text: An earlier version misidentified the fog.
    significant: true # optional; prints it at the top of the story instead
placement: lead     # optional; lead or featured, on the front page
draft: true         # shown by `bun run dev` only
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
    items: [2 flour tortillas]
calories: 780               # optional; per serving
testedBy: Marguerite Swivel # optional
```

Its body has a shape (`src/theme/markdown.ts` checks it, and a body that breaks it fails the build, drafts included):

- The prose before the first `##` is the headnote, where the joke goes. It prints above the recipe card.
- `## Method` is required: an ordered list, or `###` subsections (`### For the sauce`), each holding one ordered list and nothing else. The steps are numbered on through the subsections, and each has an anchor, `#step-3`.
- `## Notes`, `## Make Ahead and Storage` and `## Substitutions`, or any other `##`, print as written after the Method.

The page prints the headnote, then the card (yield, times as "1 hr 10 min", difficulty, course, cuisine, diet, equipment, calories and who tested it), the ingredients with a checkbox each, then the Method and notes. Its header has a "Jump to recipe" link and a Print button (the paper's only script), and printing it prints the recipe alone, black on white, ingredients in two columns, with a "Clipped from The Ergonomist, <url>" line (`src/theme/print.css`, the paper's only CSS). Its structured data is a schema.org `Recipe` with the times, yield, ingredients, the Method's steps (in `HowToSection`s for its subsections, each step linked to its anchor), course, cuisine, calories, and its tags but the course and cuisine as keywords. A recipe with no `image` uses the paper's default card, `public/card.png`, since Google wants one. There's no rating.

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

A story's page prints, top to bottom: kicker, headline, dek; byline and titles, the date (and update), reading time; **Satire** or **Reported** (with its source); any significant corrections; the lead image, caption and credit; the body; the update note and the other corrections; tags; the bio box; the membership ask; up to three related stories (the rest of its series, then those sharing the most tags, then its section); and the previous and next stories in its section. Lists print the Satire or Reported label too, and a satire's description (`og:description` and all) starts "Satire: ". Copied stories are labelled **Column**: the author's own post, neither satire nor reporting.

The front page leads with the newest `placement: lead` story, then the `featured` ones, then the **Newswire**'s latest headlines, then each section's latest (without the stories and headlines already printed above), then **Most Read**: the story ids, `<section>/<slug>`, in `mostRead` in `paper.config.ts`, picked by hand. An id that names no story fails the build.

## Tags, places, series and the archive

- `/tags/<tag>/` lists a tag's stories. Until a tag has 5 stories its page is `noindex` and out of the sitemap.
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
name: Marguerite Swivel
title: Ergonomics Correspondent   # printed under the byline
beat: Chairs, desks, and the people bent over them   # optional
short: One line, for the bio box at the end of each story and the masthead.
photo: ./marguerite.jpg   # optional, next to this file
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

Every page's footer links About, Staff, Standards, Corrections and Tips; then the Newswire, Latest, Archive, Places, Search and RSS; then the newsletter line, the disclaimer, and "Satire unless marked Reported.", linked to the standards.

## Columns

`/columns/` is copied at build time from the JSON Feeds in `paper.config.ts` (today, tristantimblin.dev's `/feed.json`). Only posts with `syndicate: true` in their frontmatter on tristantimblin.dev are copied. Each copy's canonical link points at the original, and the copy is `noindex, follow`. Headings in a copy start at `<h2>`, and its relative links point at the original.

A feed that can't be fetched (an error status, no answer in 10 s after a retry, or not JSON) is a warning on the dev server. In CI (`CI` set) the build prints the last good copy instead, `/wire.json` on the deployed paper, and fails if that can't be fetched either; a 404 there is a wrong URL, and fails at once. A feed filed under a section that isn't configured, and two stories at one URL, fail the build everywhere.

tristantimblin.dev rebuilds the paper when it deploys, by sending this repo a `repository_dispatch` of type `tristantimblin-deployed`.

## Layout

- `paper.config.ts` — the name, tagline, address, founding date (the issue number counts weeks from it), footer line, sections and feeds (each with its `author`), the default byline, the masthead's group order, the place tags, Most Read, the standards page's path, the default card, the contact, the parody asks, and `index` (off: every page is `noindex` until the paper has a domain).
- `astro.config.mjs` — adds the theme's Markdown rules (`src/theme/markdown.ts`) to Astro's Markdown processor, Sätteri.
- `src/content/pages/` — the prose of `/about/`, `/standards/`, `/tips/` and `/corrections/`.
- `src/theme/` — the reusable part: layout, story list and page, the paper's own pages and contact line, body (with its dateline), recipe card, Satire/Reported label, byline and author box, schemas, the Markdown rules for recipes and headlines, feed loader, search indexer, `paper.css` (empty) and `print.css` (a recipe, printed). It knows nothing about The Ergonomist, so it can become its own package once there's a design.
- `src/pages/` — the routes: front page, sections, stories, tags, places, series, the Newswire, latest, archive, search, staff and masthead, about, standards, tips, corrections, RSS (the paper's, each author's and the corrections'), sitemap, robots.txt, `wire.json` (the copied stories), 404.
- `public/_headers` — cache headers: a year for `/_astro/*`, five minutes for the paper's feed, the corrections feed, `wire.json` and the sitemap.
- `public/card.png` — the default card: a recipe's image in structured data until it has a photo.

Every page carries Open Graph tags. The paper's own stories carry schema.org JSON-LD: `SatiricalArticle` (`NewsArticle` when reported, `Recipe` for a recipe) with `dateModified`, `image` and `mainEntityOfPage`, and a `BreadcrumbList`. Sections, tags, series, the Newswire, the latest and the archive years are `CollectionPage`s; staff pages are `ProfilePage`s; `/about/` is an `AboutPage` and the standards, tips and corrections are `WebPage`s; the front page and `/about/` have the paper as a `NewsMediaOrganization` (its `publishingPrinciples` the standards page, its `correctionsPolicy` and `ethicsPolicy` that page's `#corrections` and `#ethics`, and its `email` once `contact.email` is set), and the front page a `WebSite` with a `SearchAction`. The sitemap lists the indexable pages, each with the newest `updated` among its stories as its lastmod (the corrections page's, its newest correction).

```sh
bun install
bun run dev
bun run build
bun run deploy   # build, then publish dist/ to https://ergonomist.tatimblin.workers.dev
```

Set `TRISTANTIMBLIN_FEED` to read Columns from another feed URL (e.g. a local build of tristantimblin.dev).

It's hosted as a Cloudflare Worker serving static files (`wrangler.jsonc`). `.github/workflows/deploy.yml` deploys it from main once the repo has the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.
