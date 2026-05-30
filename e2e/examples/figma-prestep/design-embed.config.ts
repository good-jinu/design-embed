import { defineConfig } from "design-embed";
import { FigmaHtmlPlugin } from "@design-embed/plugin-figma-html";

export default defineConfig({
	source: new FigmaHtmlPlugin({
		url: process.env.FIGMA_URL ?? "",
	}),
});
