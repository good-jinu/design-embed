import { defineConfig } from "../../../packages/design-embed/src/config/index.ts";
import { reactTarget } from "../../../packages/target-react/src/index.ts";

export default defineConfig({
	output: {
		viewsDir: "e2e/fixtures/phase2/generated",
		target: reactTarget,
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
