import { defineConfig, fromFile } from "design-embed";
import { VueTarget } from "@design-embed/vue";

export default defineConfig({
	sources: [{ source: fromFile(new URL("./simple-card.html", import.meta.url)), output: { viewName: "SimpleCard" } }],
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: new VueTarget(),
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
