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
draft: true         # shown by `bun run dev` only
---

The body.
```

A **tidbit** prints whole on the front page. A **recipe** also takes `ingredients` (a list), and optionally `serves` and `time`; its body is the method. The examples in each folder show all three.

## Columns

`/columns/` is copied at build time from the JSON Feeds in `paper.config.ts` (today, tristantimblin.dev's `/feed.json`). Only posts with `syndicate: true` in their frontmatter on tristantimblin.dev are copied. Each copy's canonical link points at the original, and the copy is `noindex, follow`. Headings in a copy start at `<h2>`, and its relative links point at the original.

A feed that can't be fetched (an error status, no answer in 10 s after a retry, or not JSON) is a warning on the dev server. In CI (`CI` set) the build prints the last good copy instead, `/wire.json` on the deployed paper, and fails if that can't be fetched either; a 404 there is a wrong URL, and fails at once. A feed filed under a section that isn't configured, and two stories at one URL, fail the build everywhere.

tristantimblin.dev rebuilds the paper when it deploys, by sending this repo a `repository_dispatch` of type `tristantimblin-deployed`.

## Layout

- `paper.config.ts` — the name, tagline, address, founding date (the issue number counts weeks from it), footer line, sections and feeds, and `index` (off: every page is `noindex` until the paper has a domain).
- `src/theme/` — the reusable part: layout, story list and page, schemas, feed loader, and `paper.css` (empty). It knows nothing about The Ergonomist, so it can become its own package once there's a design.
- `src/pages/` — the routes: front page, sections, stories, RSS, sitemap, robots.txt, `wire.json` (the copied stories), 404.
- `public/_headers` — cache headers: a year for `/_astro/*`, five minutes for the feeds and sitemap.

Every page carries Open Graph tags; the paper's own stories carry schema.org JSON-LD (`SatiricalArticle`, or `Recipe`).

```sh
bun install
bun run dev
bun run build
bun run deploy   # build, then publish dist/ to https://ergonomist.tatimblin.workers.dev
```

Set `TRISTANTIMBLIN_FEED` to read Columns from another feed URL (e.g. a local build of tristantimblin.dev).

It's hosted as a Cloudflare Worker serving static files (`wrangler.jsonc`). `.github/workflows/deploy.yml` deploys it from main once the repo has the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.
