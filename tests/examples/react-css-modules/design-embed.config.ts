import { defineConfig } from "../../../packages/config/src/index.ts";
import { reactTarget } from "../../../packages/target-react/src/index.ts";

export default defineConfig({
	output: {
		target: reactTarget,
		viewName: "CssModulesExample",
		viewsDir: "tests/examples/react-css-modules/expected/src/generated/views",
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
