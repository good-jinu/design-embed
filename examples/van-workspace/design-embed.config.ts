import { defineConfig, fromFile } from "design-embed";
import { VanJsTarget } from "@design-embed/vanjs";

export default defineConfig({
	sources: [{ plugin: fromFile(new URL("./design/simple-card.html", import.meta.url)) }],
	output: {
		viewsDir: new URL("./src/generated/views", import.meta.url),
		target: new VanJsTarget(),
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
