import { defineConfig } from "../../../packages/config/src/index.ts";

export default defineConfig({
	output: {
		viewsDir: "tests/fixtures/phase3/generated",
		target: "react",
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
