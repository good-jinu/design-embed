import { defineConfig } from "../../../packages/config/src/index.ts";

export default defineConfig({
	output: {
		viewsDir: "tests/fixtures/phase2/generated",
		target: "react",
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
