import { defineConfig, fromFile } from "design-embed";
import { ReactTarget } from "@design-embed/react";

export default defineConfig({
	source: fromFile(new URL("./product-list.html", import.meta.url)),
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: new ReactTarget(),
		viewName: "ProductList",
	},
	tests: { assertions: { screenshot: false, layout: false } },
	components: [
		{
			selector: ".filter-section",
			component: "ProductFilter",
		},
		{
			selector: ".product-grid",
			component: "ProductGrid",
		},
		{
			selector: ".product-card",
			component: "ProductCard",
		},
	],
});
