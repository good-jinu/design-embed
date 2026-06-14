import { defineConfig, fromFile } from "design-embed";
import { VueTarget } from "@design-embed/vue";

export default defineConfig({
	sources: [{ plugin: fromFile(new URL("./simple-card.html", import.meta.url)) }],
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
