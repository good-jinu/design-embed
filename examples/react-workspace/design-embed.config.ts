import { defineConfig, fromFile } from "design-embed";
import { ReactTarget } from "@design-embed/react";

export default defineConfig({
	sources: [{ source: fromFile(new URL("./design/button.html", import.meta.url)) }],
	output: {
		target: new ReactTarget(),
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
