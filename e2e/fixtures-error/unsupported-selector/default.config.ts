import { defineConfig, fromFile } from "design-embed";

export default defineConfig({
	sources: [{ source: fromFile(new URL("./button.html", import.meta.url)), output: { viewName: "UnsupportedSelector" } }],
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: "html",
	},
	components: [
		{
			selector: ".card button",
			component: "Button",
			props: {
				children: "$text",
			},
		},
	],
});
