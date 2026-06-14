import { defineConfig, fromFile } from "design-embed";

export default defineConfig({
	sources: [{ plugin: fromFile(new URL("./design/button.html", import.meta.url)) }],
	output: {
		target: "html",
		viewName: "ButtonExample",
		viewsDir: new URL("./src/generated", import.meta.url),
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
