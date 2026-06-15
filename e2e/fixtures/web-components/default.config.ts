import { defineConfig, fromFile } from "design-embed";

export default defineConfig({
	sources: [{ source: fromFile(new URL("./product-list.html", import.meta.url)), output: { viewName: "ProductList" } }],
	output: {
		viewsDir: new URL("./generated", import.meta.url),
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
