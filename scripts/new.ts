/**
 * A new story's file, ready to write: `bun run new <kind> <section> "Headline"`
 * (and `--author <staff id>`, more than once for more than one) writes
 * src/content/stories/<section>/<slug>.md, dated today and a draft,
 * with the frontmatter that kind needs (src/theme/schema.ts) and placeholders
 * where it needs a value. An unknown kind or section, or a file that's
 * already there, is refused.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import paper from "../paper.config";

const KINDS = ["article", "tidbit", "recipe", "headline"] as const;
type Kind = (typeof KINDS)[number];

// A feed's section is filled from the feed, not written here.
const sections = paper.sections.map((s) => s.id).filter((id) => !paper.feeds.some((f) => f.section === id));

const fail = (message: string): never => {
	console.error(message);
	process.exit(1);
};

// --author <id>, anywhere and as often as wanted; the rest are positional.
const args = process.argv.slice(2);
const authors: string[] = [];
const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
	if (args[i] === "--author") authors.push(args[++i] ?? "");
	else positional.push(args[i]);
}
const [kind, section, title] = positional;
const staff = readdirSync("src/content/staff").filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
const usage = `Usage: bun run new <kind> <section> "Headline" [--author <staff id>]\n  kinds: ${KINDS.join(", ")}\n  sections: ${sections.join(", ")}\n  staff: ${staff.join(", ")}`;
if (!kind || !section || !title?.trim()) fail(usage);
if (!KINDS.includes(kind as Kind)) fail(`"${kind}" isn't a kind.\n${usage}`);
if (!sections.includes(section)) fail(`"${section}" isn't a section written here.\n${usage}`);
for (const author of authors) if (!staff.includes(author)) fail(`"${author}" isn't on the staff.\n${usage}`);

// "Engineer Who Asked 'Quick Question'" → engineer-who-asked-quick-question.
const slug = title
	.toLowerCase()
	.normalize("NFKD")
	.replace(/[̀-ͯ'’"“”]/g, "")
	.replace(/[^a-z0-9]+/g, "-")
	.replace(/^-|-$/g, "");
if (!slug) fail(`"${title}" makes no slug; give it some letters or numbers.`);

// Today, in local time.
const now = new Date();
const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, "0")).join("-");

// Each kind's required fields, with placeholders; the rest are in the README.
const fields: Record<Kind, string[]> = {
	article: ["dek: TODO"],
	tidbit: [],
	recipe: ["dek: TODO", "serves: 1", "prep: PT10M", "cook: PT10M", "ingredients:", "  - TODO"],
	headline: [],
};
// A headline has no body; a recipe's needs a Method.
const bodies: Record<Kind, string> = { article: "\n", tidbit: "\n", recipe: "\n## Method\n\n1. TODO\n", headline: "" };

const frontmatter = [
	"---",
	// JSON's double-quoted string is YAML's: quotes and colons stay as written.
	`title: ${JSON.stringify(title.trim())}`,
	`date: ${today}`,
	`kind: ${kind}`,
	...(authors.length ? [`authors: [${authors.join(", ")}]`] : []),
	...fields[kind as Kind],
	"draft: true",
	"---",
].join("\n");

const dir = `src/content/stories/${section}`;
const file = `${dir}/${slug}.md`;
if (existsSync(file)) fail(`${file} is already there.`);
mkdirSync(dir, { recursive: true });
writeFileSync(file, `${frontmatter}\n${bodies[kind as Kind]}`, { flag: "wx" });
console.log(file);
