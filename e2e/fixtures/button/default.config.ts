import { defineConfig, fromFile } from "design-embed";

export default defineConfig({
	source: fromFile(new URL("./button.html", import.meta.url)),
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: "html",
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
