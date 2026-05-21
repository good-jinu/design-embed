import { defineConfig } from "../../../packages/config/src/index.ts";

export default defineConfig({
	output: {
		viewsDir: "tests/fixtures/phase2/generated",
		target: "react",
		viewName: "ButtonExample",
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
});
