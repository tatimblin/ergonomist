/**
 * The Newswire's inbox (`bun run wire`): reads the sources the Newswire
 * watches, drops anything it has already seen, and writes what's new to
 * src/data/wire/inbox.json for the Newswire's scheduled Claude task
 * (src/newswire/PROMPT.md) to judge. No model runs here: this is only
 * fetching, so it's cheap and gives the same result for the same sources.
 *
 * Sources:
 * - Mission Local and SF Standard, by RSS. The feeds carry a summary only, so
 *   each new story's page is fetched for its text: the Buzz roundups hide
 *   news (sandbags, a Muni line's hours) below their headlines.
 * - Weather Service warnings for the San Francisco zone (CAZ006), from Iowa
 *   State's archive of NWS alerts, which also serves the backtest. Advisories
 *   and statements are left out here; only warnings reach the inbox. One
 *   warning is one item however often it's reissued.
 *
 * What's been seen is src/data/wire/seen.json (gitignored), keyed by URL or
 * warning id. A run adds this run's items to it.
 *
 * - `--since 2026-10-31` reads back to that date (Mission Local's feed pages
 *   back about four weeks; SF Standard's holds its latest 10 stories),
 *   ignores seen.json and doesn't write it: the backtest.
 * - `--dry` prints the inbox and writes nothing.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Element, Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import { visit } from "unist-util-visit";

const DIR = "src/data/wire";
const AGENT = "Mozilla/5.0 (compatible; ErgonomistNewswire/1.0; +https://ergonomist.tatimblin.workers.dev/)";
/** A story's text is cut here: enough for a Buzz roundup, not a feature. */
const MAX_BODY = 6000;
/** Without --since, how far back a first run reaches. */
const FIRST_RUN_DAYS = 2;

export type InboxItem = {
	id: string;
	source: "Mission Local" | "SF Standard" | "National Weather Service";
	url: string;
	title: string;
	date: string;
	summary?: string;
	body?: string;
	/** Links in the story's text to places a primary source lives. */
	links?: string[];
	/** Weather warnings: when the warning starts and ends. */
	starts?: string;
	ends?: string;
};

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const sinceArg = args[args.indexOf("--since") + 1];
const backtest = args.includes("--since");
if (backtest && !/^\d{4}-\d{2}-\d{2}$/.test(sinceArg ?? "")) throw new Error("--since takes a date, like 2026-10-31.");
const since = backtest ? new Date(`${sinceArg}T00:00:00-08:00`) : new Date(Date.now() - FIRST_RUN_DAYS * 86_400_000);

const get = async (url: string) => {
	const res = await fetch(url, { headers: { "User-Agent": AGENT } });
	if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
	return res.text();
};

// --- RSS --------------------------------------------------------------------

const decode = (s: string) =>
	s
		.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1")
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
		.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[e as string]!)
		.trim();

const tag = (xml: string, name: string) => {
	const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml);
	return m ? decode(m[1]) : undefined;
};

const plain = (html: string) => decode(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));

function rssItems(xml: string, source: InboxItem["source"]): InboxItem[] {
	return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap(([, item]) => {
		const url = tag(item, "link");
		const title = tag(item, "title");
		const date = tag(item, "pubDate");
		if (!url || !title || !date) return [];
		const summary = tag(item, "description");
		return [{ id: url, source, url, title, date: new Date(date).toISOString(), summary: summary && plain(summary) }];
	});
}

/** A feed's items back to `since`, following WordPress's ?paged=N. */
async function feed(base: string, source: InboxItem["source"]): Promise<InboxItem[]> {
	const items: InboxItem[] = [];
	for (let page = 1; page <= 12; page++) {
		let xml: string;
		try {
			xml = await get(page === 1 ? base : `${base}?paged=${page}`);
		} catch (err) {
			if (page === 1) throw err;
			break;
		}
		const found = rssItems(xml, source).filter((i) => !items.some((j) => j.id === i.id));
		items.push(...found);
		if (!found.length || found.every((i) => new Date(i.date) < since) || !backtest) break;
	}
	return items.filter((i) => new Date(i.date) >= since);
}

// --- Story text -------------------------------------------------------------

const text = (node: Element): string => {
	let out = "";
	visit(node, "text", (t) => void (out += t.value));
	return out.replace(/\s+/g, " ").trim();
};

/** Where a story's own source is likely to be: officials' posts and the city's pages. */
const PRIMARY = /^https:\/\/(?:www\.)?(?:x\.com|twitter\.com|instagram\.com|facebook\.com|threads\.net|bsky\.app|[a-z.]*sf\.gov|sfgov\.org|[a-z.]*sfmta\.com|sfpublicworks\.org|bart\.gov|sfelections\.org|[a-z.]*weather\.gov)\//;

/**
 * A story page's paragraphs: Mission Local's (WordPress) inside the
 * article's .entry-content, SF Standard's marked .article-body. With them,
 * the paragraphs' links to a likely primary source (PRIMARY).
 */
export function storyText(html: string): { body: string; links: string[] } {
	const tree: Root = fromHtml(html);
	const paras: string[] = [];
	const links = new Set<string>();
	visit(tree, "element", (el, _i, parent) => {
		if (el.tagName !== "p") return;
		const cls = String(el.properties.className ?? "");
		const inEntry = (parent as Element | undefined)?.properties?.className?.toString().includes("entry-content");
		if (cls.includes("article-body") || cls.includes("wp-block-paragraph") || inEntry) {
			const t = text(el);
			if (!t || /^ADVERTISEMENT$/i.test(t)) return;
			paras.push(t);
			visit(el, "element", (a) => {
				const href = a.tagName === "a" ? String(a.properties.href ?? "") : "";
				if (PRIMARY.test(href)) links.add(href.replace(/[?#].*$/, ""));
			});
		}
	});
	return { body: paras.join("\n\n").slice(0, MAX_BODY), links: [...links] };
}

async function withBodies(items: InboxItem[]) {
	const queue = [...items];
	const worker = async () => {
		for (let item = queue.shift(); item; item = queue.shift()) {
			if (item.source === "National Weather Service") continue;
			try {
				const { body, links } = storyText(await get(item.url));
				item.body = body;
				if (links.length) item.links = links;
			} catch (err) {
				console.warn(`wire: no text for ${item.url} (${(err as Error).message}).`);
			}
		}
	};
	await Promise.all(Array.from({ length: 4 }, worker));
}

// --- Weather warnings -------------------------------------------------------

type IemEvent = { issue: string; expire: string; eventid: number; phenomena: string; significance: string; wfo: string; name: string; url: string };

async function warnings(): Promise<InboxItem[]> {
	const from = new Date(since.getTime() - 86_400_000).toISOString().slice(0, 10);
	const to = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
	const data = JSON.parse(await get(`https://mesonet.agron.iastate.edu/json/vtec_events_byugc.py?ugc=CAZ006&sdate=${from}&edate=${to}`)) as { events: IemEvent[] };
	return data.events
		.filter((e) => e.significance === "W" && new Date(e.issue) >= new Date(since.getTime() - 86_400_000))
		.map((e) => {
			const year = e.issue.slice(0, 4);
			const id = `nws:${e.wfo}.${e.phenomena}.W.${e.eventid}.${year}`;
			return {
				id,
				source: "National Weather Service" as const,
				url: `https://mesonet.agron.iastate.edu${e.url}`,
				title: `${e.name} for San Francisco`,
				date: new Date(e.issue).toISOString(),
				starts: new Date(e.issue).toISOString(),
				ends: new Date(e.expire).toISOString(),
			};
		});
}

// --- Run --------------------------------------------------------------------

const results = await Promise.allSettled([
	feed("https://missionlocal.org/feed/", "Mission Local"),
	feed("https://sfstandard.com/feed/", "SF Standard"),
	warnings(),
]);
const failed = results.filter((r) => r.status === "rejected");
for (const f of failed) console.warn(`wire: a source failed (${(f as PromiseRejectedResult).reason}).`);
if (failed.length === results.length) process.exit(1);

mkdirSync(DIR, { recursive: true });
const seenFile = join(DIR, "seen.json");
const seen: Record<string, string> = !backtest && existsSync(seenFile) ? JSON.parse(readFileSync(seenFile, "utf8")) : {};

const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
const inbox = all.filter((i) => !seen[i.id]).sort((a, b) => a.date.localeCompare(b.date));
await withBodies(inbox);

const counts = Object.entries(Object.groupBy(inbox, (i) => i.source)).map(([s, l]) => `${l!.length} ${s}`).join(", ");
console.log(`wire: ${inbox.length} new since ${since.toISOString().slice(0, 10)}${counts ? ` (${counts})` : ""}.`);

if (dry) {
	for (const i of inbox) console.log(`${i.date.slice(0, 10)}  ${i.source.padEnd(24)}  ${i.title}`);
	process.exit(0);
}

writeFileSync(join(DIR, "inbox.json"), `${JSON.stringify(inbox, null, "\t")}\n`);
if (!backtest) {
	const now = new Date().toISOString();
	for (const i of inbox) seen[i.id] = now;
	writeFileSync(seenFile, `${JSON.stringify(seen, null, "\t")}\n`);
}
