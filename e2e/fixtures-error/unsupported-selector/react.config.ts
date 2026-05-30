import { defineConfig, fromFile } from "design-embed";
import { ReactTarget } from "@design-embed/target-react";

export default defineConfig({
	source: fromFile(new URL("./button.html", import.meta.url)),
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: new ReactTarget(),
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
