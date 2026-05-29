import { defineConfig } from "../../../packages/design-embed/src/config/index.ts";

export default defineConfig({
	output: {
		viewsDir: "e2e/fixtures/phase1/generated",
		assembliesDir: "fixtures/phase1/generated/pages",
		target: "html",
	},
	components: [
		{
			selector: "button[data-role='primary']",
			component: "@/components/ui/Button",
			importName: "Button",
			props: {
				variant: "primary",
				children: "$text",
			},
		},
	],
	tokens: {
		spacing: {
			unit: "px",
			threshold: 2,
			values: {
				"4": 16,
				"6": 24,
			},
		},
		colors: {
			"blue-600": "#3B82F6",
		},
	},
});
