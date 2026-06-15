import { defineConfig, fromFile } from "design-embed";

export default defineConfig({
	sources: [{ source: fromFile(
		new URL("./css-module-card.html", import.meta.url),
		new URL("./css-module-card.css", import.meta.url),
	), output: { viewName: "CssModuleCard" } }],
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: "html",
	},
	tokens: {
		spacing: {
			unit: "px",
			threshold: 2,
			values: {
				"1": 4,
				"4": 16,
			},
		},
		colors: {
			"blue-600": "#3B82F6",
		},
		colorThreshold: 4,
		radius: {
			lg: 8,
		},
	},
});
