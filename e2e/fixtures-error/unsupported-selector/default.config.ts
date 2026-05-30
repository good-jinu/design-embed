import { defineConfig, fromFile } from "design-embed";

export default defineConfig({
	source: fromFile(new URL("./button.html", import.meta.url)),
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: "html",
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
