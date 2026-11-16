/**
 * The structured-data check (`bun run test:jsonld [dist]`): every JSON-LD
 * block in the build is JSON, in schema.org's context, and every node in it
 * (top-level, in an @graph, or nested) has the fields its @type needs, by the
 * zod shapes below. A @type with no shape here fails, so a new one gets one.
 * And no Person is anyone but a real member of the staff (`real: true` in
 * src/content/staff), linked to their staff page: a persona's byline is the
 * paper, never a made-up Person.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "astro/zod";
import { filesIn, htmlFiles, jsonLdBlocks, paper, pathOf, report } from "./dist";

const { fail, done } = report("jsonld");

const url = z.url();
const date = z.iso.datetime();
const duration = z.string().regex(/^P(?!$)(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/, "an ISO 8601 duration");
/** A nested node of one of these types (checked as a node itself). */
const node = (...types: string[]) => z.looseObject({ "@type": z.enum(types as [string, ...string[]]) });
const oneOrMore = <T extends z.ZodType>(t: T) => z.union([t, z.array(t).nonempty()]);
const website = node("WebSite");

const article = z.object({
	headline: z.string().min(1),
	datePublished: date,
	dateModified: date,
	url,
	mainEntityOfPage: url,
	image: url.optional(),
	author: oneOrMore(node("Person", "NewsMediaOrganization")),
	publisher: node("NewsMediaOrganization"),
});

/** ListItems numbered 1, 2, 3… in order. */
const listItems = <T extends z.ZodRawShape>(item: T) =>
	z
		.array(z.object({ "@type": z.literal("ListItem"), position: z.number(), ...item }))
		.refine((items) => items.every((i, n) => (i as { position: number }).position === n + 1), "positions run 1, 2, 3… in order");

const shapes: Record<string, z.ZodType> = {
	SatiricalArticle: article,
	OpinionNewsArticle: article,
	// A reported story says what it's based on.
	NewsArticle: article.extend({ isBasedOn: url }),
	Recipe: article.extend({
		name: z.string().min(1),
		image: url,
		prepTime: duration,
		cookTime: duration,
		totalTime: duration,
		recipeYield: oneOrMore(z.string().min(1)),
		recipeIngredient: z.array(z.string().min(1)).nonempty(),
		recipeInstructions: z.array(node("HowToStep", "HowToSection")).nonempty(),
		nutrition: node("NutritionInformation").optional(),
	}),
	HowToStep: z.object({ text: z.string().min(1), url }),
	HowToSection: z.object({ name: z.string().min(1), itemListElement: z.array(node("HowToStep")).nonempty() }),
	NutritionInformation: z.object({ calories: z.string().regex(/^\d+ calories$/) }),
	ProfilePage: z.object({ url, mainEntity: node("Person", "NewsMediaOrganization") }),
	CollectionPage: z.object({ name: z.string().min(1), url, isPartOf: website, mainEntity: node("ItemList") }),
	AboutPage: z.object({ name: z.string().min(1), url, isPartOf: website }),
	WebPage: z.object({ name: z.string().min(1), url, isPartOf: website }),
	ItemList: z.object({ itemListElement: listItems({ url }) }),
	BreadcrumbList: z.object({
		itemListElement: listItems({ name: z.string().min(1), item: url }).refine(
			(items) => items.length > 0,
			"a breadcrumb trail has a step",
		),
	}),
	ListItem: z.object({ position: z.number().int().positive() }),
	NewsMediaOrganization: z.object({
		name: z.literal(paper.name),
		url: z.literal(paper.site),
		publishingPrinciples: url.optional(),
		correctionsPolicy: url.optional(),
		ethicsPolicy: url.optional(),
		email: z.email().optional(),
	}),
	WebSite: z.object({ name: z.literal(paper.name), url: z.literal(paper.site), potentialAction: node("SearchAction").optional() }),
	SearchAction: z.object({ target: node("EntryPoint"), "query-input": z.literal("required name=search_term_string") }),
	EntryPoint: z.object({ urlTemplate: z.string().includes("{search_term_string}") }),
	Person: z.object({ name: z.string().min(1), url, sameAs: z.array(url).optional() }),
};

// The staff who are real people, by the URL of their staff page.
const real = new Map<string, string>();
for (const file of filesIn("src/content/staff", /^[^/]+\.md$/)) {
	const frontmatter = /^---\n([\s\S]*?)\n---/.exec(readFileSync(join("src/content/staff", file), "utf8"))?.[1] ?? "";
	const name = /^name:\s*(.+)$/m.exec(frontmatter)?.[1].trim();
	if (name && /^real:\s*true\s*$/m.test(frontmatter)) real.set(new URL(`/staff/${file.replace(/\.md$/, "")}/`, paper.site).href, name);
}

let blocks = 0;
let nodes = 0;

/** Check every node in a JSON-LD value against its @type's shape. */
function check(value: unknown, where: string) {
	if (Array.isArray(value)) return value.forEach((v, i) => check(v, `${where}[${i}]`));
	if (!value || typeof value !== "object") return;
	const obj = value as Record<string, unknown>;
	const type = obj["@type"];
	if (type !== undefined) {
		nodes++;
		const shape = typeof type === "string" ? shapes[type] : undefined;
		if (!shape) fail(where, `@type ${JSON.stringify(type)} has no shape in scripts/jsonld.ts`);
		else {
			const result = shape.safeParse(obj);
			if (!result.success) {
				for (const issue of result.error.issues) fail(where, `${type}.${issue.path.join(".") || "(itself)"}: ${issue.message}`);
			}
		}
		if (type === "Person") {
			const name = real.get(String(obj.url));
			if (name !== obj.name) fail(where, `a Person, "${obj.name}" (${obj.url}), who isn't a real member of the staff at that URL`);
		}
	}
	for (const [key, v] of Object.entries(obj)) check(v, `${where}.${key}`);
}

for (const file of htmlFiles) {
	const path = pathOf(file);
	for (const block of jsonLdBlocks(file)) {
		blocks++;
		let data: unknown;
		try {
			data = JSON.parse(block);
		} catch (e) {
			fail(path, `JSON-LD isn't JSON: ${(e as Error).message}`);
			continue;
		}
		const top = data as Record<string, unknown>;
		if (top?.["@context"] !== "https://schema.org") fail(path, `JSON-LD's @context is ${JSON.stringify(top?.["@context"])}, not https://schema.org`);
		if (top?.["@type"] === undefined && !Array.isArray(top?.["@graph"])) fail(path, "JSON-LD with neither a @type nor an @graph");
		check(data, `${path} JSON-LD`);
	}
}

done(`${nodes} nodes in ${blocks} JSON-LD blocks on ${htmlFiles.length} pages`);
