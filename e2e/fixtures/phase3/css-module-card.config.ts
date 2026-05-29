import { defineConfig } from "../../../packages/config/src/index.ts";
import { reactTarget } from "../../../packages/target-react/src/index.ts";

export default defineConfig({
	output: {
		viewsDir: "e2e/fixtures/phase3/generated",
		target: reactTarget,
		viewName: "CssModuleCard",
		styleMode: "css-modules",
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
