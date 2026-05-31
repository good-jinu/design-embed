import { defineConfig, fromFile } from "design-embed";
import { VueTarget } from "@design-embed/target-vue";

export default defineConfig({
	source: fromFile(new URL("./simple-card.html", import.meta.url)),
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: new VueTarget(),
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
