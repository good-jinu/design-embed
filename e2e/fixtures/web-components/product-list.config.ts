import { defineConfig } from "../../../packages/design-embed/src/config/index.ts";

export default defineConfig({
	output: {
		viewsDir: "e2e/fixtures/web-components/generated",
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
