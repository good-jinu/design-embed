import { defineConfig, fromFile } from "design-embed";
import { ReactTarget } from "@design-embed/react";

export default defineConfig({
	sources: [{ source: fromFile(new URL("./ambiguous-token.html", import.meta.url)), output: { viewName: "AmbiguousToken" } }],
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: new ReactTarget(),
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
