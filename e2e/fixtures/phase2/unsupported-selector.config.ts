import { defineConfig } from "../../../packages/config/src/index.ts";
import { reactTarget } from "../../../packages/target-react/src/index.ts";

export default defineConfig({
	output: {
		viewsDir: "e2e/fixtures/phase2/generated",
		target: reactTarget,
		viewName: "UnsupportedSelector",
	},
	components: [
		{
			selector: ".card button",
			component: "@/components/ui/Button",
			importName: "Button",
			props: {
				children: "$text",
			},
		},
	],
});
