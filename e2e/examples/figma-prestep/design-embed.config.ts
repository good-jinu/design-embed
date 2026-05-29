import { defineConfig } from "../../../packages/config/src/index.ts";
import { FigmaHtmlPlugin } from "../../../packages/plugin-figma-html/src/index.ts";

export default defineConfig({
	plugins: [
		new FigmaHtmlPlugin({
			url: process.env.FIGMA_URL ?? "",
		}),
	],
});
