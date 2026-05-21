import { defineConfig } from "../../../packages/config/src/index.ts";

export default defineConfig({
	output: {
		viewsDir: "tests/fixtures/phase2/generated",
		target: "react",
		viewName: "CardWithImage",
	},
	components: [
		{
			selector: "img",
			component: "@/components/media/ProductImage",
			importName: "ProductImage",
			props: {
				src: "$attr.src",
				alt: "$attr.alt",
			},
		},
		{
			selector: "a.product-link",
			component: "@/components/ui/ProductLink",
			importName: "ProductLink",
			props: {
				href: "$attr.href",
				children: "$children",
			},
		},
	],
});
