import { defineConfig, fromFile } from "design-embed";
import { ReactTarget } from "@design-embed/react";

export default defineConfig({
	sources: [{ source: fromFile(new URL("./button.html", import.meta.url)), output: { viewName: "UnsupportedSelector" } }],
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: new ReactTarget(),
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
