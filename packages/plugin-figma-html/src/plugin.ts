import { join } from "node:path";
import type {
	SourcePlugin,
	SourcePluginInput,
	SourcePluginResult,
} from "design-embed";
import { compileHtml } from "./compilers/index.ts";
import { extractParamsFromURL, fetchFigmaNode } from "./external/figmaApi.ts";
import { downloadFigmaImageFills } from "./external/imageDownloader.ts";

export interface FigmaHtmlPluginOptions {
	url: string;
	token?: string;
	assetsDir?: string;
}

export class FigmaHtmlPlugin implements SourcePlugin {
	readonly name = "figma-html";

	constructor(private readonly options: FigmaHtmlPluginOptions) {}

	async run(input: SourcePluginInput): Promise<SourcePluginResult> {
		const { url, token: optionsToken, assetsDir = "assets" } = this.options;
		const token = optionsToken ?? process.env.FIGMA_TOKEN;

		if (!token) {
			return {
				diagnostics: [
					{
						code: "FIGMA_TOKEN_REQUIRED",
						message:
							"figma-html requires a Figma token. Pass token in the FigmaHtmlPlugin constructor or set the FIGMA_TOKEN environment variable.",
						severity: "error",
					},
				],
			};
		}

		try {
			const { fileKey, nodeId } = extractParamsFromURL(url);
			const rootNode = await fetchFigmaNode(fileKey, nodeId, { token });
			const downloadedImages = await downloadFigmaImageFills(
				rootNode,
				join(input.cwd, assetsDir),
				{ publicPath: assetsDir },
			);
			const [htmlFile] = compileHtml(rootNode);

			return {
				html: htmlFile?.contents,
				diagnostics:
					downloadedImages.length > 0
						? [
								{
									code: "FIGMA_ASSETS_DOWNLOADED",
									message: `Downloaded ${downloadedImages.length} image asset(s).`,
									severity: "info",
								},
							]
						: [],
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				diagnostics: [
					{
						code: "FIGMA_HTML_FAILED",
						message,
						severity: "error",
					},
				],
			};
		}
	}
}
