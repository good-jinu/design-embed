import { defineConfig, fromFile } from "design-embed";
import { VanJsTarget } from "@design-embed/target-vanjs";

export default defineConfig({
	source: fromFile(new URL("./design/simple-card.html", import.meta.url)),
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
