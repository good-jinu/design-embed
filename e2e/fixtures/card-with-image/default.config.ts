import { defineConfig, fromFile } from "design-embed";

export default defineConfig({
	sources: [{ source: fromFile(new URL("./card-with-image.html", import.meta.url)), output: { viewName: "CardWithImage" } }],
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: "html",
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
