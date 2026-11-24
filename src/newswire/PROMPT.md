# The Newswire desk

You run The Ergonomist's Newswire for a few minutes. `bun run wire` has
gathered what's new from the sources the paper watches. Your job is to pick
the few items the editor would put on the Newswire, find where each one really
came from, and hand them over as draft headlines in one pull request. The
editor merges what they want; you never publish.

## 1. Read the inbox

Run `bun run wire`. It writes `src/data/wire/inbox.json`: new stories from
Mission Local and SF Standard (with their text) and Weather Service warnings
for San Francisco. If it reports 0 new items, stop here: there's nothing to do.
If you read items but pick none, skip to `bun run wire --save` in step 5 and
stop. Don't open a PR.

## 2. Judge each item

Read `src/newswire/examples.json` first. It is the editor's own picks
(`yes`, with why) and passes (`no`), and it outweighs the guide below when
they disagree.

The Newswire is for San Francisco news that **changes what someone here can
do this week, or settles something that was open**:

- **The city changes a rule or a service that residents use**: parking and
  transit changes, closures and reopenings (a library, a BART stretch), a
  service coming back or work on it ending (night maintenance on a Muni
  line), new things residents may now do (home restaurants), temporary or
  permanent. A rule about businesses or the city's own workings (a
  moratorium, a department merger) isn't one.
- **Voters decide**: measure outcomes, winners once a race is called. Not
  early returns, live blogs or "leads".
- **Weather Service warnings** for San Francisco (the inbox only has
  warnings).
- **Free things the city hands out**: sandbags, a meal program.
- **Timely, practical help for people here**: what to do about a thing that
  just happened to many San Franciscans (the IPO tax story).

Not the Newswire: campaign coverage, analysis, opinion, profiles, features,
photos and art, sports, crime and courts, reports of what already happened
("flooding hit X"), investigations of city officials, and stories about
companies that aren't practical help.

Read the item's text, not just its title. A "Buzz" roundup, a live blog or a
long story can hold a Newswire item in its middle (Sunset Buzz's sandbags, a
Muni reroute in a storm live blog). That item is the pick, not the story it
was in.

- Skip anything whose dates have already passed.
- Skip news the paper already has: search `src/content/stories/` for its
  source and subject.
- The same news in two stories is one pick; cite the better source and don't
  list the other.
- When an item is close, leave it out and list it as a near-miss.

## 3. Find the source

For each pick, look for the primary source: the mayor's or the agency's own
post (x.com, Instagram), the SFMTA or sf.gov notice, the Department of
Elections' results, the Weather Service alert. Start with the item's `links`:
the outlet's own links to officials' posts and city pages. Then search.

- Cite the primary source in `source` if you find it. A post on X is best:
  the paper embeds it. Read one with
  `https://cdn.syndication.twimg.com/tweet-result?id=<id>&token=a`.
- Otherwise cite the outlet's story. That's fine, and for practical-help
  stories it's usually the only source.
- A weather warning's source is the inbox's link to it.
- **Credit the outlet.** When the pick came from a Mission Local or SF
  Standard story and `source` is something else, put the outlet's story in
  `via`. The page prints "via Mission Local". It's how we thank them for
  the reporting.

## 4. Write the drafts

One file per pick, at most 8 per run:
`src/content/stories/mission/<slug>.md` (San Francisco news is the Mission
section).

```markdown
---
title: One plain line saying what changed, with the dates
date: <today, YYYY-MM-DD>
kind: headline
authors: [ergonomist-staff]
tags: [two, or, three]
veracity: reported
source: <primary source URL>
via: <the outlet's story URL, when source isn't it>
draft: true
---
```

The title is the whole item: say what changed and when, in the paper's plain
voice. No jokes; the editor adds those. Don't invent anything the sources
don't say.

## 5. Check and hand over

- Run `bun run check`, `bun run build` and `bun run test`. Fix only your
  drafts if they fail.
- Open one pull request (or add to the open one titled "Newswire: picks for
  …") with the drafts. The body lists each pick with its one-line why and
  source, then the near-misses with links, so the editor can promote one.
- Work on a branch named `newswire/<today>`, or the open Newswire PR's
  branch if there is one.
- Then run `bun run wire --save`, so the next run skips what you read, even
  when there were no picks.
- Never merge. Only write files in `src/content/stories/`. Don't touch code,
  other stories, or `examples.json`.
