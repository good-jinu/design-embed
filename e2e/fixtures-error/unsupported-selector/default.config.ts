import { defineConfig, fromFile } from "design-embed";

export default defineConfig({
	sources: [{ plugin: fromFile(new URL("./button.html", import.meta.url)) }],
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: "html",
		viewName: "UnsupportedSelector",
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
