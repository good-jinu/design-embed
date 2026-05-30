import { defineConfig, fromFile } from "design-embed";
import { reactTarget } from "@design-embed/target-react";

export default defineConfig({
	source: fromFile(new URL("./product-list.html", import.meta.url)),
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: reactTarget,
		viewName: "ProductList",
	},
	components: [
		{
			selector: ".filter-section",
			component: "@/components/ProductFilter",
			importName: "ProductFilter",
		},
		{
			selector: ".product-grid",
			component: "@/components/ProductGrid",
			importName: "ProductGrid",
		},
		{
			selector: ".product-card",
			component: "@/components/ProductCard",
			importName: "ProductCard",
		},
	],
});
