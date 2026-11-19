/**
 * The Jobs desk: what the AI labs are hiring for in San Francisco, as
 * activity. A role appears here when it opens, changes or closes, and drops
 * off after a month with no change; each finished month stays as a one-line
 * summary for good. Everything else about a role is on the company's own
 * careers page.
 *
 * This file is the shared logic: reading the companies' public job feeds,
 * comparing a capture against the last one, and grouping the changes into
 * days, weeks and months with a line on what each period was about.
 * scripts/jobs.ts runs it every hour (.github/workflows/jobs.yml) and writes
 * src/data/jobs/; src/pages/jobs/ prints it.
 */

export const TIME_ZONE = "America/Los_Angeles";
/** A role drops off the page after this many days with no change. */
export const QUIET_DAYS = 30;
/** Changes are kept this long, so a month can be summed up once it ends. */
export const KEEP_DAYS = 70;

export type Company = { id: string; name: string; board: "greenhouse" | "ashby"; slug: string; careers: string };

export const COMPANIES: Company[] = [
	{ id: "anthropic", name: "Anthropic", board: "greenhouse", slug: "anthropic", careers: "https://www.anthropic.com/careers" },
	{ id: "openai", name: "OpenAI", board: "ashby", slug: "openai", careers: "https://openai.com/careers" },
	{ id: "thinkingmachines", name: "Thinking Machines", board: "ashby", slug: "thinkingmachines", careers: "https://thinkingmachines.ai/careers" },
];

/** One role as the paper tracks it: only what a change is measured on. */
export type Role = {
	company: string;
	id: string;
	title: string;
	team: string;
	location: string;
	pay?: string;
	url: string;
	firstSeen: string;
};

export type ChangeType = "opened" | "changed" | "closed";

export type JobEvent = {
	at: string;
	type: ChangeType;
	company: string;
	id: string;
	title: string;
	team: string;
	url: string;
	/** For "changed": each field that changed, [before, after]. */
	changes?: Partial<Record<"title" | "team" | "location" | "pay", [string, string]>>;
	/** For "closed": how many days it was open, as far as the paper saw. */
	openDays?: number;
};

export type Counts = { opened: number; closed: number; changed: number };

/** A finished month, kept for good. */
export type MonthSummary = {
	month: string;
	line: string;
	detail: string;
	counts: Counts;
	/** Opened, closed and changed by company and team: "openai/Go To Market". */
	byTeam: Record<string, Counts>;
};

export type State = {
	/** When the paper started watching; that capture is a starting point, not news. */
	since: string | null;
	roles: Record<string, Role>;
};

export type JobsData = {
	state: State;
	events: JobEvent[];
	months: MonthSummary[];
	/** Lines written for open periods (days, weeks), by period key; a model's, when one is set up. */
	lines: Record<string, { hash: string; line: string }>;
};

export const roleKey = (r: { company: string; id: string }) => `${r.company}/${r.id}`;

// ---------------------------------------------------------------- reading the feeds

const SF = /san francisco/i;

const decode = (html: string) =>
	html
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&[mn]dash;/g, "–");

const money = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`);

/** The first "$X – $Y" range in a posting's text, normalized. */
export function payFromText(text: string): string | undefined {
	const m = /\$\s?([\d,]{4,})(?:\.\d+)?\s*(?:USD)?\s*[–—-]\s*\$\s?([\d,]{4,})/.exec(text);
	if (!m) return undefined;
	const [lo, hi] = [m[1], m[2]].map((s) => Number(s.replace(/,/g, "")));
	return `${money(lo)} – ${money(hi)}`;
}

type GreenhouseJob = {
	id: number;
	title: string;
	absolute_url: string;
	location?: { name?: string };
	departments?: { name: string }[];
	content?: string;
};

type AshbyJob = {
	id: string;
	title: string;
	department?: string;
	team?: string;
	location?: string;
	secondaryLocations?: { location?: string }[];
	jobUrl: string;
	isListed?: boolean;
	compensation?: { summaryComponents?: { compensationType: string; minValue: number | null; maxValue: number | null }[] };
};

/** A company's San Francisco roles, from its public job board. */
export async function fetchRoles(company: Company, now: string, fetcher: typeof fetch = fetch): Promise<Omit<Role, "firstSeen">[]> {
	if (company.board === "greenhouse") {
		const res = await fetcher(`https://boards-api.greenhouse.io/v1/boards/${company.slug}/jobs?content=true`);
		if (!res.ok) throw new Error(`${company.name}: Greenhouse answered ${res.status}`);
		const { jobs } = (await res.json()) as { jobs: GreenhouseJob[] };
		return jobs
			.filter((j) => SF.test(j.location?.name ?? ""))
			.map((j) => ({
				company: company.id,
				id: String(j.id),
				title: j.title.trim(),
				team: j.departments?.[0]?.name?.trim() || "Other",
				location: (j.location?.name ?? "").trim(),
				pay: payFromText(decode(j.content ?? "")),
				url: j.absolute_url,
			}));
	}
	const res = await fetcher(`https://api.ashbyhq.com/posting-api/job-board/${company.slug}?includeCompensation=true`);
	if (!res.ok) throw new Error(`${company.name}: Ashby answered ${res.status}`);
	const { jobs } = (await res.json()) as { jobs: AshbyJob[] };
	return jobs
		.filter((j) => j.isListed !== false)
		.filter((j) => [j.location, ...(j.secondaryLocations ?? []).map((l) => l.location)].some((l) => SF.test(l ?? "")))
		.map((j) => {
			const salary = j.compensation?.summaryComponents?.find((c) => c.compensationType === "Salary");
			const pay = salary?.minValue && salary?.maxValue ? `${money(salary.minValue)} – ${money(salary.maxValue)}` : undefined;
			return {
				company: company.id,
				id: j.id,
				title: j.title.trim(),
				team: (j.department || j.team || "Other").trim(),
				location: [j.location, ...(j.secondaryLocations ?? []).map((l) => l.location)].filter(Boolean).join(" | "),
				pay,
				url: j.jobUrl,
			};
		});
}

// ---------------------------------------------------------------- comparing captures

const DAY = 86_400_000;

/**
 * Compares a company's capture with what the paper last saw of it, and
 * returns the new state and the changes. The first capture of a company is a
 * starting point: every role is recorded, and none is news.
 */
export function compare(state: State, company: string, captured: Omit<Role, "firstSeen">[], now: string): { state: State; events: JobEvent[] } {
	const roles = { ...state.roles };
	const events: JobEvent[] = [];
	const known = Object.values(roles).some((r) => r.company === company);
	const seen = new Set<string>();

	for (const c of captured) {
		const key = roleKey(c);
		seen.add(key);
		const before = roles[key];
		if (!before) {
			roles[key] = { ...c, firstSeen: now };
			if (known) events.push({ at: now, type: "opened", company, id: c.id, title: c.title, team: c.team, url: c.url });
			continue;
		}
		const changes: JobEvent["changes"] = {};
		for (const field of ["title", "team", "location", "pay"] as const) {
			const [a, b] = [before[field] ?? "", c[field] ?? ""];
			// A pay range that only disappears from a posting isn't news.
			if (a !== b && !(field === "pay" && !b)) changes[field] = [a, b];
		}
		roles[key] = { ...c, pay: c.pay ?? before.pay, firstSeen: before.firstSeen };
		if (Object.keys(changes).length) {
			events.push({ at: now, type: "changed", company, id: c.id, title: c.title, team: c.team, url: c.url, changes });
		}
	}

	for (const [key, r] of Object.entries(state.roles)) {
		if (r.company !== company || seen.has(key)) continue;
		delete roles[key];
		const openDays = Math.max(0, Math.round((Date.parse(now) - Date.parse(r.firstSeen)) / DAY));
		events.push({ at: now, type: "closed", company, id: r.id, title: r.title, team: r.team, url: r.url, openDays });
	}

	return { state: { since: state.since ?? now, roles }, events };
}

// ---------------------------------------------------------------- dates

const dateParts = (iso: string) =>
	Object.fromEntries(
		new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
			.formatToParts(new Date(iso))
			.map((p) => [p.type, p.value]),
	);

/** The local (Pacific) date of an instant, "2026-11-18". */
export const localDate = (iso: string) => {
	const p = dateParts(iso);
	return `${p.year}-${p.month}-${p.day}`;
};

/** Days between two local dates. */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY);

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** The Monday a local date's week starts on. */
export const weekOf = (date: string) => addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));

export const monthOf = (date: string) => date.slice(0, 7);

export const formatTime = (iso: string) =>
	new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(new Date(iso)).replace("AM", "a.m.").replace("PM", "p.m.");

export const formatDay = (date: string) =>
	new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00Z`));

export const formatWeek = (monday: string) =>
	`Week of ${new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${monday}T12:00:00Z`))}`;

export const formatMonth = (month: string) =>
	new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${month}-15T12:00:00Z`));

// ---------------------------------------------------------------- summing up

export const companyName = (id: string) => COMPANIES.find((c) => c.id === id)?.name ?? id;

export function countsOf(events: JobEvent[]): Counts {
	const c = { opened: 0, closed: 0, changed: 0 };
	for (const e of events) c[e.type]++;
	return c;
}

export function byTeam(events: JobEvent[]): Record<string, Counts> {
	const out: Record<string, Counts> = {};
	for (const e of events) {
		const k = `${e.company}/${e.team}`;
		out[k] ??= { opened: 0, closed: 0, changed: 0 };
		out[k][e.type]++;
	}
	return out;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The counts under a period's line: "22 new · 15 closed · 1 changed · net +7". */
export function countsLine(c: Counts): string {
	if (!c.opened && !c.closed && !c.changed) return "No changes";
	const parts = [`${c.opened} new`, `${c.closed} closed`];
	if (c.changed) parts.push(`${c.changed} changed`);
	const net = c.opened - c.closed;
	parts.push(`net ${net > 0 ? "+" : net < 0 ? "−" : "±"}${Math.abs(net)}`);
	return parts.join(" · ");
}

/**
 * What a period was about, from its counts alone, for when no model is set up
 * (and as the facts a model's line has to agree with): the team and company
 * that opened the most roles, if they stand out.
 */
export function themeOf(teams: Record<string, Counts>, unit: "day" | "week" | "month"): { line: string; detail?: string } {
	const total = Object.values(teams).reduce((n, c) => n + c.opened, 0);
	const closed = Object.values(teams).reduce((n, c) => n + c.closed, 0);
	const changed = Object.entries(teams).filter(([, c]) => c.changed > 0);
	if (!total && !closed && !changed.length) return { line: "No changes" };
	if (!total && !closed) {
		const labs = [...new Set(changed.map(([k]) => companyName(k.split("/")[0])))];
		const n = changed.reduce((sum, [, c]) => sum + c.changed, 0);
		return { line: `${labs.join(" and ")} ${labs.length > 1 ? "update" : "updates"} ${plural(n, "posting")}` };
	}
	const ranked = Object.entries(teams).sort((a, b) => b[1].opened - a[1].opened);
	const [topKey, top] = ranked[0];
	const [company, team] = topKey.split(/\/(.*)/s);
	// The same team across labs, summed.
	const acrossLabs = new Map<string, number>();
	for (const [k, c] of ranked) {
		const t = k.split(/\/(.*)/s)[1];
		acrossLabs.set(t, (acrossLabs.get(t) ?? 0) + c.opened);
	}
	const [sharedTeam, sharedCount] = [...acrossLabs.entries()].sort((a, b) => b[1] - a[1])[0];

	if (total >= 3 && top.opened / total >= 0.3) {
		return { line: `${companyName(company)} hires for ${team}`, detail: top.opened < total ? `${top.opened} of ${plural(total, "new role")}` : undefined };
	}
	if (total >= 3 && sharedCount / total >= 0.3) {
		return { line: `${sharedTeam}, across labs`, detail: sharedCount < total ? `${sharedCount} of ${plural(total, "new role")}` : undefined };
	}
	if (closed > total * 1.5 && closed >= 3) return { line: "More roles closed than opened" };
	if (total + closed < 3) return { line: `A quiet ${unit}` };
	return { line: "Hiring across teams" };
}

/** The companies by name, as prose: "Anthropic, OpenAI and Thinking Machines". */
export const companyList = (names = COMPANIES.map((c) => c.name)) =>
	names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

/** A short hash of a period's counts, so its line is only rewritten when they change. */
export function hashOf(value: unknown): string {
	const s = JSON.stringify(value);
	let h = 5381;
	for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
	return (h >>> 0).toString(36);
}

// ---------------------------------------------------------------- the page's periods

export type Period = {
	key: string;
	label: string;
	line: string;
	detail?: string;
	counts: Counts;
	events: JobEvent[];
};

export type View = {
	today: { date: string; opened: JobEvent[]; changed: JobEvent[]; closed: JobEvent[] };
	days: Period[];
	weeks: Period[];
	months: MonthSummary[];
	/** Activity this month and today, by company. */
	companies: { id: string; name: string; today: Counts; month: Counts }[];
	teams: string[];
};

/**
 * The page, as of `now`: today's changes one by one, the rest of the past
 * week by day, the weeks before that by week (up to QUIET_DAYS back), and
 * every finished month. With `team`, only that team's activity.
 */
export function viewOf(data: JobsData, now: string, team?: string): View {
	const today = localDate(now);
	const recent = data.events
		.filter((e) => daysBetween(localDate(e.at), today) < QUIET_DAYS)
		.filter((e) => !team || teamSlug(e.team) === team)
		.sort((a, b) => b.at.localeCompare(a.at));
	const line = (key: string, events: JobEvent[], unit: "day" | "week") => {
		const teams = byTeam(events);
		const fallback = themeOf(teams, unit);
		// A model's line is only for the whole page; a team's page uses the counts.
		const written = !team ? data.lines[key] : undefined;
		return written && written.hash === hashOf(teams) ? { line: written.line, detail: fallback.detail } : fallback;
	};

	const todays = recent.filter((e) => localDate(e.at) === today);
	const days: Period[] = [];
	for (let n = 1; n < 7; n++) {
		const date = addDays(today, -n);
		const events = recent.filter((e) => localDate(e.at) === date);
		if (!events.length) continue;
		days.push({ key: `day:${date}`, label: formatDay(date), ...line(`day:${date}`, events, "day"), counts: countsOf(events), events });
	}
	const weekKeys = [...new Set(recent.filter((e) => daysBetween(localDate(e.at), today) >= 7).map((e) => weekOf(localDate(e.at))))];
	const weeks: Period[] = weekKeys.map((monday) => {
		const events = recent.filter((e) => daysBetween(localDate(e.at), today) >= 7 && weekOf(localDate(e.at)) === monday);
		return { key: `week:${monday}`, label: formatWeek(monday), ...line(`week:${monday}`, events, "week"), counts: countsOf(events), events };
	});

	const months = [...data.months]
		.sort((a, b) => b.month.localeCompare(a.month))
		.map((m) => {
			if (!team) return m;
			const teams = Object.fromEntries(Object.entries(m.byTeam).filter(([k]) => teamSlug(k.split(/\/(.*)/s)[1]) === team));
			const counts = Object.values(teams).reduce((c, t) => ({ opened: c.opened + t.opened, closed: c.closed + t.closed, changed: c.changed + t.changed }), { opened: 0, closed: 0, changed: 0 });
			const theme = themeOf(teams, "month");
			return { ...m, line: theme.line, detail: theme.detail ?? "", counts, byTeam: teams };
		})
		.filter((m) => m.counts.opened || m.counts.closed || m.counts.changed);

	const thisMonth = monthOf(today);
	const companies = COMPANIES.map((c) => ({
		id: c.id,
		name: c.name,
		today: countsOf(todays.filter((e) => e.company === c.id)),
		month: countsOf(recent.filter((e) => e.company === c.id && monthOf(localDate(e.at)) === thisMonth)),
	}));

	const teams = [...new Set(data.events.filter((e) => daysBetween(localDate(e.at), today) < QUIET_DAYS).map((e) => e.team))].sort();

	return {
		today: {
			date: today,
			opened: todays.filter((e) => e.type === "opened"),
			changed: todays.filter((e) => e.type === "changed"),
			closed: todays.filter((e) => e.type === "closed"),
		},
		days,
		weeks,
		months,
		companies,
		teams,
	};
}

/** The months that have ended since they were last summed up, summed up. */
export function finishedMonths(data: JobsData, now: string): MonthSummary[] {
	const current = monthOf(localDate(now));
	const done = new Set(data.months.map((m) => m.month));
	const since = data.state.since ? monthOf(localDate(data.state.since)) : current;
	const months = [...new Set(data.events.map((e) => monthOf(localDate(e.at))))].filter((m) => m < current && m >= since && !done.has(m));
	return months.map((month) => {
		const events = data.events.filter((e) => monthOf(localDate(e.at)) === month);
		const teams = byTeam(events);
		const theme = themeOf(teams, "month");
		return { month, line: theme.line, detail: theme.detail ?? "", counts: countsOf(events), byTeam: teams };
	});
}

/** A team's name in a URL: "Go To Market" → "go-to-market". */
export const teamSlug = (team: string) =>
	team
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "") || "other";

/** One line on what changed in a role: "pay range $207K – $285K → $230K – $310K". */
export function describeChange(e: JobEvent): string {
	const c = e.changes ?? {};
	const parts: string[] = [];
	if (c.pay) parts.push(c.pay[0] ? `pay range ${c.pay[0]} → ${c.pay[1]}` : `pay range posted: ${c.pay[1]}`);
	if (c.title) parts.push(`retitled from "${c.title[0]}"`);
	if (c.team) parts.push(`moved from ${c.team[0]} to ${c.team[1]}`);
	if (c.location) parts.push(`locations now ${c.location[1]}`);
	return parts.join("; ");
}
