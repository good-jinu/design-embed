import { defineConfig, fromFile } from "design-embed";

export default defineConfig({
	sources: [{ source: fromFile(new URL("./button.html", import.meta.url)), output: { viewName: "ButtonExample" } }],
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: "html",
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
