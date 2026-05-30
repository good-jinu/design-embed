import { defineConfig, fromFile } from "design-embed";
import { reactTarget } from "@design-embed/target-react";

export default defineConfig({
	source: fromFile(new URL("./ambiguous-token.html", import.meta.url)),
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: reactTarget,
		viewName: "AmbiguousToken",
		styleMode: "inline",
	},
	tokens: {
		spacing: {
			unit: "px",
			threshold: 2,
			values: {
				"near-a": 14,
				"near-b": 16,
			},
		},
	},
});
