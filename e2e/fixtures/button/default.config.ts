import { defineConfig, fromFile } from "design-embed";

export default defineConfig({
	sources: [{ plugin: fromFile(new URL("./button.html", import.meta.url)) }],
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: "html",
		viewName: "ButtonExample",
	},
	components: [
		{
			selector: "button[data-role='primary']",
			component: "Button",
			props: {
				variant: "primary",
				children: "$text",
			},
		},
	],
});
