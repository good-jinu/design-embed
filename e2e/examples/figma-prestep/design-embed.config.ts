import { defineConfig } from "../../../packages/design-embed/src/config/index.ts";
import { FigmaHtmlPlugin } from "../../../packages/plugin-figma-html/src/index.ts";

export default defineConfig({
	plugins: [
		new FigmaHtmlPlugin({
			url: process.env.FIGMA_URL ?? "",
		}),
	],
});
