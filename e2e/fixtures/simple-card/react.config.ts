import { defineConfig, fromFile } from "design-embed";
import { ReactTarget } from "@design-embed/target-react";

export default defineConfig({
	source: fromFile(new URL("./simple-card.html", import.meta.url)),
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: new ReactTarget(),
		viewName: "SimpleCard",
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
