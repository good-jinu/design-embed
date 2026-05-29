import { defineConfig } from "../../../packages/config/src/index.ts";
import { reactTarget } from "../../../packages/target-react/src/index.ts";

export default defineConfig({
	output: {
		viewsDir: "e2e/fixtures/phase3/generated",
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
