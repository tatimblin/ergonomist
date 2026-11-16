# The Ergonomist

Serving the Mission since 2026. A small-town paper: tech, Mission news, recipes, and columns copied from [tristantimblin.dev](https://tristantimblin.dev).

Bare HTML for now; the design comes once there's enough in it.

## Writing

A story is a markdown file in `src/content/stories/<section>/<slug>.md`, where `<section>` is `tech`, `mission` or `recipes`. It's served at `/<section>/<slug>/`.

```md
---
title: Fog Returns to Dolores Park, Declines to Comment
date: 2026-11-15
kind: tidbit        # article (the default), tidbit or recipe
summary: One line under the headline. Articles and recipes need one.
authors: [dale-footrest]  # staff ids; The Ergonomist Staff when left out
draft: true         # shown by `bun run dev` only
---

The body.
```

A **tidbit** prints whole on the front page. A **recipe** also takes `ingredients` (a list), and optionally `serves` and `time`; its body is the method. The examples in each folder show all three.

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

## Columns

`/columns/` is copied at build time from the JSON Feeds in `paper.config.ts` (today, tristantimblin.dev's `/feed.json`). Only posts with `syndicate: true` in their frontmatter on tristantimblin.dev are copied. Each copy's canonical link points at the original, and the copy is `noindex, follow`. Headings in a copy start at `<h2>`, and its relative links point at the original.

A feed that can't be fetched (an error status, no answer in 10 s after a retry, or not JSON) is a warning on the dev server. In CI (`CI` set) the build prints the last good copy instead, `/wire.json` on the deployed paper, and fails if that can't be fetched either; a 404 there is a wrong URL, and fails at once. A feed filed under a section that isn't configured, and two stories at one URL, fail the build everywhere.

tristantimblin.dev rebuilds the paper when it deploys, by sending this repo a `repository_dispatch` of type `tristantimblin-deployed`.

## Layout

- `paper.config.ts` — the name, tagline, address, founding date (the issue number counts weeks from it), footer line, sections and feeds (each with its `author`), the default byline, the masthead's group order, and `index` (off: every page is `noindex` until the paper has a domain).
- `src/theme/` — the reusable part: layout, story list and page, byline and author box, schemas, feed loader, and `paper.css` (empty). It knows nothing about The Ergonomist, so it can become its own package once there's a design.
- `src/pages/` — the routes: front page, sections, stories, staff and masthead, RSS (the paper's and each author's), sitemap, robots.txt, `wire.json` (the copied stories), 404.
- `public/_headers` — cache headers: a year for `/_astro/*`, five minutes for the feeds and sitemap.

Every page carries Open Graph tags; the paper's own stories carry schema.org JSON-LD (`SatiricalArticle`, or `Recipe`), and staff pages a `ProfilePage`.

```sh
bun install
bun run dev
bun run build
bun run deploy   # build, then publish dist/ to https://ergonomist.tatimblin.workers.dev
```

Set `TRISTANTIMBLIN_FEED` to read Columns from another feed URL (e.g. a local build of tristantimblin.dev).

It's hosted as a Cloudflare Worker serving static files (`wrangler.jsonc`). `.github/workflows/deploy.yml` deploys it from main once the repo has the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.
