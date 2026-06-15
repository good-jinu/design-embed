import { defineConfig, fromFile } from "design-embed";

export default defineConfig({
	sources: [{ source: fromFile(new URL("./simple-card.html", import.meta.url)) }],
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: "html",
	},
	components: [
		{
			selector: "button[data-role='primary']",
			component: "Button",
			props: {
				variant: "primary",
				children: "$text",
			},
		},
	],
	tokens: {
		spacing: {
			unit: "px",
			threshold: 2,
			values: {
				"4": 16,
				"6": 24,
			},
		},
		colors: {
			"blue-600": "#3B82F6",
		},
	},
});
