import { defineConfig, fromFile } from "design-embed";
import { VueTarget } from "@design-embed/vue";

export default defineConfig({
	sources: [{ source: fromFile(new URL("./design/simple-card.html", import.meta.url)) }],
	output: {
		viewsDir: new URL("./src/generated/views", import.meta.url),
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
