/**
 * The theme's rules for a story's body, by its `kind`: an mdast plugin for
 * Sätteri, Astro's Markdown processor (astro.config.mjs adds it). A body that
 * breaks them fails the build, drafts included.
 *
 *   recipe   — The prose before the first `##` is the headnote. It prints
 *              above the recipe card, so it's taken out of the body here and
 *              kept, as HTML, for StoryPage. `## Method` is required: an
 *              ordered list, or `###` subsections ("For the sauce") each
 *              holding one. Its steps are numbered on through the
 *              subsections, each gets an id="step-N" anchor, and they're kept
 *              for the Recipe's structured data. Other `##` sections (Notes,
 *              Make Ahead and Storage, Substitutions) print as written.
 *   headline — has no body at all.
 *
 * What's kept goes in the entry's rendered frontmatter, under `recipe`:
 * recipeOf in paper.ts reads it back.
 */
import { fileURLToPath } from "node:url";
import type { Heading, List, RootContent } from "mdast";
import { defineMdastPlugin, markdownToHtml, type MdastVisitorContext, type PluginFactoryContext } from "satteri";

/** A recipe's body, as the plugin leaves it for the page. */
export interface RecipeBody {
	/** The headnote's HTML, if it has one. */
	headnote?: string;
	/** The Method: one untitled section for a plain list, else one per `###`. */
	method: { name?: string; steps: { id: string; text: string }[] }[];
}

interface Astro {
	frontmatter: Record<string, unknown>;
}

const isH2 = (n: RootContent): n is Heading => n.type === "heading" && n.depth === 2;
const isH3 = (n: RootContent | undefined): n is Heading => n?.type === "heading" && n.depth === 3;
const isOl = (n: RootContent | undefined): n is List => n?.type === "list" && n.ordered === true;
const hasImage = (n: RootContent): boolean => n.type === "image" || ("children" in n && n.children.some(hasImage));

export const storyBodies = (factory: PluginFactoryContext) => {
	const astro = factory.data.astro as Astro | undefined;
	const kind = astro?.frontmatter.kind;
	const file = factory.fileURL ? fileURLToPath(factory.fileURL) : "A story";
	const fail = (message: string): never => {
		throw new Error(`${file}: ${message}`);
	};
	if (kind === "headline") {
		if (factory.source.trim()) fail("a headline has no body. Delete everything after the frontmatter.");
		return null;
	}
	if (kind !== "recipe") return null;

	return defineMdastPlugin({
		name: "ergonomist-recipe",
		// The headnote is cut out of the source by its position.
		options: { position: true },
		before(root, ctx) {
			const children = root.children as RootContent[];
			const firstH2 = children.findIndex(isH2);
			const headnote = firstH2 === -1 ? children : children.slice(0, firstH2);
			const at = children.findIndex((n) => isH2(n) && ctx.textContent(n).trim().toLowerCase() === "method");
			if (at === -1) fail("a recipe needs a `## Method`: an ordered list of its steps.");
			const next = children.findIndex((n, i) => i > at && isH2(n));
			const body = children.slice(at + 1, next === -1 ? undefined : next);

			let n = 0;
			// Number a list's items on from the last list's, each with its anchor.
			const steps = (list: List) => {
				ctx.setField(list, "start", n + 1);
				return list.children.map((item) => {
					const id = `step-${++n}`;
					ctx.setField(item, "data", { ...item.data, hProperties: { id } });
					return { id, text: ctx.textContent(item).replace(/\s+/g, " ").trim() };
				});
			};
			const method: RecipeBody["method"] = [];
			if (body.length === 1 && isOl(body[0])) {
				method.push({ steps: steps(body[0]) });
			} else {
				for (let i = 0; i < body.length; i += 2) {
					const [heading, list] = [body[i], body[i + 1]];
					if (!isH3(heading) || !isOl(list)) break;
					method.push({ name: ctx.textContent(heading).trim(), steps: steps(list) });
				}
				if (!body.length || method.length * 2 !== body.length) {
					fail("`## Method` must be an ordered list (1. 2. 3.), or `###` subsections each holding one and nothing else.");
				}
			}

			const recipe: RecipeBody = { method, headnote: headnoteHtml(headnote, ctx, factory, fail) };
			for (const node of headnote) ctx.removeNode(node);
			(ctx.data.astro as Astro).frontmatter.recipe = recipe;
		},
	});
};

/** The headnote as HTML, rendered from its own source with the document's
 *  Markdown features (smart quotes and all). */
function headnoteHtml(
	nodes: RootContent[],
	ctx: MdastVisitorContext,
	factory: PluginFactoryContext,
	fail: (message: string) => never,
): string | undefined {
	if (!nodes.length) return undefined;
	if (nodes.some(hasImage)) fail("a recipe's headnote can't hold an image; the lead image is `image`.");
	const [start, end] = [nodes[0].position?.start.offset, nodes.at(-1)!.position?.end.offset];
	if (start === undefined || end === undefined) return fail("the headnote's position is unknown.");
	return markdownToHtml(ctx.source.slice(start, end), { features: factory.features }).html;
}
