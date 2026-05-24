import { defineConfig } from "../../../packages/config/src/index.ts";
import { reactTarget } from "../../../packages/target-react/src/index.ts";

export default defineConfig({
	output: {
		viewsDir: "tests/fixtures/phase3/generated",
		target: reactTarget,
		viewName: "TailwindCard",
		styleMode: "tailwind",
	},
	tokens: {
		spacing: {
			unit: "px",
			threshold: 2,
			values: {
				"4": 16,
			},
		},
		colors: {
			"blue-600": "#3B82F6",
			"neutral-900": "#111827",
		},
		colorThreshold: 4,
	},
	styleMappings: {
		spacing: {
			"padding:spacing.4": "p-4",
		},
		colors: {
			"background-color:colors.blue-600": "bg-blue-600",
			"color:colors.neutral-900": "text-neutral-900",
		},
	},
});
