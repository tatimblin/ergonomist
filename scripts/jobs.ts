/**
 * The Jobs desk's capture (`bun run jobs`, run by
 * .github/workflows/jobs.yml): reads each company's public job board, keeps
 * its San Francisco roles, compares them with the last capture, and writes
 * the changes to src/data/jobs/. A file is only rewritten when something in
 * it changed, so a capture with no news makes no commit.
 *
 * - The first capture of a company is a starting point: its roles are
 *   recorded, none is news.
 * - A board that can't be read, or that suddenly lists far fewer roles than
 *   last time, is skipped this time rather than read as mass closures.
 * - Changes are kept KEEP_DAYS; a month that has ended is summed up into
 *   months.json, which keeps it for good.
 * - With CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_TOKEN and JOBS_MODEL set, a
 *   Workers AI model writes each period's one-line theme from its counts (a
 *   structured-output call). Without them, the line comes from the counts
 *   alone (themeOf in src/jobs/jobs.ts).
 *
 * `bun run jobs --dry` prints what would change and writes nothing.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	byTeam,
	COMPANIES,
	compare,
	companyName,
	fetchRoles,
	finishedMonths,
	formatMonth,
	hashOf,
	KEEP_DAYS,
	localDate,
	themeOf,
	viewOf,
	type JobEvent,
	type JobsData,
	type MonthSummary,
	type State,
} from "../src/jobs/jobs";

const DIR = "src/data/jobs";
const dry = process.argv.includes("--dry");
const now = new Date().toISOString();

const read = <T>(name: string, empty: T): T => {
	const file = join(DIR, name);
	return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : empty;
};

const data: JobsData = {
	state: read<State>("state.json", { since: null, roles: {} }),
	events: read<JobEvent[]>("events.json", []),
	months: read<MonthSummary[]>("months.json", []),
	lines: read<JobsData["lines"]>("lines.json", {}),
};
const before = JSON.stringify(data);

// Capture each board.
const fresh: JobEvent[] = [];
for (const company of COMPANIES) {
	const previous = Object.values(data.state.roles).filter((r) => r.company === company.id).length;
	let captured: Awaited<ReturnType<typeof fetchRoles>>;
	try {
		captured = await fetchRoles(company, now);
	} catch (err) {
		console.warn(`${company.name}: skipped this time (${(err as Error).message})`);
		continue;
	}
	if (previous >= 20 && captured.length < previous * 0.5) {
		console.warn(`${company.name}: skipped this time (${captured.length} roles, down from ${previous}; likely a feed glitch)`);
		continue;
	}
	const result = compare(data.state, company.id, captured, now);
	data.state = result.state;
	fresh.push(...result.events);
	const counts = { opened: 0, changed: 0, closed: 0 };
	for (const e of result.events) counts[e.type]++;
	console.log(`${company.name}: ${captured.length} San Francisco roles; ${counts.opened} opened, ${counts.changed} changed, ${counts.closed} closed${previous ? "" : " (first capture: recorded, not news)"}`);
}
data.events.push(...fresh);

// Keep KEEP_DAYS of changes.
const cutoff = Date.parse(now) - KEEP_DAYS * 86_400_000;
data.events = data.events.filter((e) => Date.parse(e.at) >= cutoff).sort((a, b) => a.at.localeCompare(b.at));

// A model, if one is set up, for the lines.
const ai = process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AI_TOKEN && process.env.JOBS_MODEL;

async function writeLine(label: string, teams: Record<string, ReturnType<typeof byTeam>[string]>, unit: "day" | "week" | "month"): Promise<string | undefined> {
	if (!ai) return undefined;
	const facts = Object.entries(teams)
		.map(([k, c]) => {
			const [company, team] = k.split(/\/(.*)/s);
			return { company: companyName(company), team, ...c };
		})
		.sort((a, b) => b.opened + b.closed - (a.opened + a.closed))
		.slice(0, 12);
	const fallback = themeOf(teams, unit).line;
	const prompt = [
		`These are the changes to San Francisco job postings at AI labs for ${label}: roles opened, closed and changed, by company and team.`,
		JSON.stringify(facts),
		`Write one headline, at most 8 words, saying what the labs were hiring for in this ${unit}. Name the team and company that stand out.`,
		"Plain newspaper style, sentence case, no numbers, no exclamation marks, no adjectives like 'massive'. Say only what the counts show.",
		`If nothing stands out, say so plainly, like "${fallback}".`,
	].join("\n\n");
	try {
		const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${process.env.JOBS_MODEL}`, {
			method: "POST",
			headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_AI_TOKEN}`, "Content-Type": "application/json" },
			body: JSON.stringify({
				messages: [{ role: "user", content: prompt }],
				response_format: {
					type: "json_schema",
					json_schema: { type: "object", properties: { headline: { type: "string" } }, required: ["headline"] },
				},
			}),
		});
		// Older models answer in result.response; newer ones in OpenAI's shape, result.choices.
		const body = (await res.json()) as { success?: boolean; result?: { response?: unknown; choices?: { message?: { content?: unknown } }[] } };
		const response = body.result?.response ?? body.result?.choices?.[0]?.message?.content;
		const text = typeof response === "string" ? response.replace(/^```(?:json)?\s*|\s*```$/g, "") : undefined;
		const parsed = text !== undefined ? JSON.parse(text) : response;
		const line = String((parsed as { headline?: string })?.headline ?? "").trim().replace(/\.$/, "");
		if (!body.success || !line || line.length > 70) throw new Error("no usable headline");
		return line;
	} catch (err) {
		console.warn(`${label}: kept the line from the counts (${(err as Error).message})`);
		return undefined;
	}
}

// Sum up the months that have ended; they're kept for good.
for (const month of finishedMonths(data, now)) {
	const written = await writeLine(formatMonth(month.month), month.byTeam, "month");
	if (written) month.line = written;
	data.months.push(month);
	console.log(`${formatMonth(month.month)}: ${month.line}`);
}

// Lines for the open days and weeks, rewritten only when their counts change.
if (ai) {
	const view = viewOf(data, now);
	const keep = new Set<string>();
	for (const p of [...view.days, ...view.weeks]) {
		keep.add(p.key);
		const hash = hashOf(byTeam(p.events));
		if (data.lines[p.key]?.hash === hash) continue;
		const line = await writeLine(p.label, byTeam(p.events), p.key.startsWith("day:") ? "day" : "week");
		if (line) data.lines[p.key] = { hash, line };
	}
	for (const key of Object.keys(data.lines)) if (!keep.has(key)) delete data.lines[key];
}

// Write what changed.
const sortedRoles = Object.fromEntries(Object.entries(data.state.roles).sort(([a], [b]) => a.localeCompare(b)));
const files: [string, unknown][] = [
	["state.json", { since: data.state.since, roles: sortedRoles }],
	["events.json", data.events],
	["months.json", data.months.sort((a, b) => a.month.localeCompare(b.month))],
	["lines.json", data.lines],
];
if (JSON.stringify(data) === before) {
	console.log("No changes.");
} else if (dry) {
	console.log(`Dry run: ${fresh.length} changes, nothing written. Today is ${localDate(now)}.`);
} else {
	mkdirSync(DIR, { recursive: true });
	for (const [name, value] of files) {
		const text = `${JSON.stringify(value, null, "\t")}\n`;
		const file = join(DIR, name);
		if (!existsSync(file) || readFileSync(file, "utf8") !== text) writeFileSync(file, text);
	}
	console.log(`Wrote ${DIR}.`);
}
