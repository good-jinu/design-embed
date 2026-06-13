import { defineConfig, fromFile } from "design-embed";
import { ReactTarget } from "@design-embed/react";

export default defineConfig({
	source: fromFile(new URL("./button.html", import.meta.url)),
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: new ReactTarget(),
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
