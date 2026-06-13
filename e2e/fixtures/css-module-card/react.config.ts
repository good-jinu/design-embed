import { defineConfig, fromFile } from "design-embed";
import { ReactTarget } from "@design-embed/react";

export default defineConfig({
	source: fromFile(
		new URL("./css-module-card.html", import.meta.url),
		new URL("./css-module-card.css", import.meta.url),
	),
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: new ReactTarget(),
		viewName: "CssModuleCard",
		styleMode: "css-modules",
	},
	tests: { assertions: { screenshot: false, layoutTolerance: 10 } },
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
