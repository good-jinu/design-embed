import { defineConfig, fromFile } from "design-embed";

export default defineConfig({
	source: fromFile(new URL("./product-list.html", import.meta.url)),
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		viewName: "ProductList",
		target: "html",
	},
	components: [
		{
			selector: ".filter-section",
			component: "product-filter",
		},
		{
			selector: ".product-grid",
			component: "product-list",
		},
		{
			selector: ".product-card",
			component: "product-card",
		},
	],
});
