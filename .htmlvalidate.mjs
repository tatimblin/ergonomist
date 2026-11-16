// html-validate's rules for dist/ (`bun run test:html`): its recommended set,
// less what the theme does on purpose.
export default {
	extends: ["html-validate:recommended"],
	rules: {
		// A story's <title> is its headline and the paper's name, however long
		// the headline; search engines cut it where they like.
		"long-title": "off",
	},
};
