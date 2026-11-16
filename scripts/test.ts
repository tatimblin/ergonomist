/**
 * `bun run test [dist]`: every check of a build, each to the end, so one
 * run reports every problem; it fails if any check did. Build first, with the
 * INCLUDE_DRAFTS the checks should expect (smoke.ts reads it).
 */
import { spawnSync } from "node:child_process";

const dist = process.argv[2] ?? "dist";
const checks: [string, string[]][] = [
	["smoke", ["scripts/smoke.ts", dist]],
	["html", ["x", "html-validate", dist]],
	["links", ["scripts/links.ts", dist]],
	["jsonld", ["scripts/jsonld.ts", dist]],
];

const failed = checks.filter(([, args]) => spawnSync("bun", args, { stdio: "inherit" }).status !== 0);
if (failed.length) {
	console.error(`Failed: ${failed.map(([name]) => name).join(", ")}.`);
	process.exit(1);
}
console.log(`All ${checks.length} checks passed (${checks.map(([name]) => name).join(", ")}).`);
