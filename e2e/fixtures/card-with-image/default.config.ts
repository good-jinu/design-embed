import { defineConfig, fromFile } from "design-embed";

export default defineConfig({
	sources: [{ plugin: fromFile(new URL("./card-with-image.html", import.meta.url)) }],
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: "html",
		viewName: "CardWithImage",
	},
	components: [
		{
			selector: "img",
			component: "ProductImage",
			props: {
				src: "$attr.src",
				alt: "$attr.alt",
			},
		},
		{
			selector: "a.product-link",
			component: "ProductLink",
			props: {
				href: "$attr.href",
				children: "$children",
			},
		},
	],
});
