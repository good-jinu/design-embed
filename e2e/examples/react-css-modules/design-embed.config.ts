import { defineConfig, fromFile } from "design-embed";
import { reactTarget } from "@design-embed/target-react";

export default defineConfig({
	source: fromFile(
		new URL("./design.html", import.meta.url),
		new URL("./design.css", import.meta.url),
	),
	output: {
		target: reactTarget,
		viewName: "CssModulesExample",
		viewsDir: new URL("./expected/src/generated/views", import.meta.url),
		styleMode: "css-modules",
	},
	tokens: {
		spacing: {
			unit: "px",
			threshold: 0,
			values: {
				"4": 16,
			},
		},
		radius: {
			lg: 8,
		},
		colors: {
			"gray-900": "#111827",
			white: "#ffffff",
		},
	},
});
