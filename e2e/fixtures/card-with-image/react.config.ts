import { defineConfig, fromFile } from "design-embed";
import { ReactTarget } from "@design-embed/target-react";

export default defineConfig({
	source: fromFile(new URL("./card-with-image.html", import.meta.url)),
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: new ReactTarget(),
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
