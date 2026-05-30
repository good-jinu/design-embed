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
			component: "components/product-filter",
			importName: "product-filter",
		},
		{
			selector: ".product-grid",
			component: "components/product-list",
			importName: "product-list",
		},
		{
			selector: ".product-card",
			component: "components/product-card",
			importName: "product-card",
		},
	],
});
