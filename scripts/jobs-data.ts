/**
 * The Jobs desk's data lives on its own branch, `jobs-data`, so the hourly
 * captures don't fill main's history. This puts that branch's files in
 * src/data/jobs/ (gitignored), where the build and `bun run jobs` read them.
 * It runs before `bun run dev` and `bun run build`.
 *
 * - In CI (CI is set), data that can't be fetched fails, so the paper is
 *   never built with an empty Jobs desk.
 * - Locally, a failed fetch keeps the files already there, or writes empty
 *   ones, with a warning.
 * - JOBS_DATA=local skips the fetch and keeps what's in src/data/jobs/, so a
 *   capture or an edit there can be previewed.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BRANCH = "jobs-data";
const DIR = "src/data/jobs";
const EMPTY: Record<string, unknown> = {
	"state.json": { since: null, roles: {} },
	"events.json": [],
	"months.json": [],
	"lines.json": {},
};

const git = (...args: string[]) => {
	const run = spawnSync("git", args);
	if (run.status !== 0) throw new Error(`git ${args.join(" ")}: ${run.stderr.toString().trim()}`);
	return run.stdout;
};

mkdirSync(DIR, { recursive: true });

if (process.env.JOBS_DATA === "local") {
	console.log(`jobs-data: JOBS_DATA=local, keeping ${DIR}.`);
	process.exit(0);
}

try {
	git("fetch", "--quiet", "--depth=1", "origin", BRANCH);
	const commit = git("rev-parse", "--short", "FETCH_HEAD").toString().trim();
	for (const name of Object.keys(EMPTY)) writeFileSync(join(DIR, name), git("show", `FETCH_HEAD:${name}`));
	console.log(`jobs-data: ${DIR} from ${BRANCH} at ${commit}.`);
} catch (err) {
	if (process.env.CI) {
		console.error(`jobs-data: couldn't read the ${BRANCH} branch (${(err as Error).message}).`);
		process.exit(1);
	}
	let wrote = 0;
	for (const [name, value] of Object.entries(EMPTY)) {
		const file = join(DIR, name);
		if (existsSync(file)) continue;
		writeFileSync(file, `${JSON.stringify(value, null, "\t")}\n`);
		wrote++;
	}
	console.warn(`jobs-data: couldn't read the ${BRANCH} branch (${(err as Error).message}); ${wrote ? `wrote ${wrote} empty files` : "kept the files already there"}.`);
}
