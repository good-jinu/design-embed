import { defineConfig } from "../../../packages/config/src/index.ts";
import { reactTarget } from "../../../packages/target-react/src/index.ts";

export default defineConfig({
	output: {
		viewsDir: "e2e/fixtures/phase2/generated",
		target: reactTarget,
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
