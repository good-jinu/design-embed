import { join } from "node:path";
import type {
	SourcePlugin,
	SourcePluginInput,
	SourcePluginResult,
} from "design-embed";
import { compileHtmlFragment } from "./compilers/index.ts";
import type { FigmaFetcher } from "./external/figmaApi.ts";
import { extractParamsFromURL, fetchFigmaNode } from "./external/figmaApi.ts";
import {
	downloadFigmaImageFills,
	downloadFigmaNodeExports,
} from "./external/imageDownloader.ts";

export interface FigmaHtmlPluginOptions {
	url: string;
	token?: string;
	assetsDir?: string;
	/** Custom fetch implementation, mainly for testing without the Figma API. */
	fetcher?: FigmaFetcher;
}

export class FigmaHtmlPlugin implements SourcePlugin {
	readonly name = "figma-html";
	private readonly options: FigmaHtmlPluginOptions;

	constructor(options: FigmaHtmlPluginOptions) {
		this.options = options;
	}

	async run(input: SourcePluginInput): Promise<SourcePluginResult> {
		const {
			url,
			token: optionsToken,
			assetsDir = "assets",
			fetcher,
		} = this.options;
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
			const rootNode = await fetchFigmaNode(fileKey, nodeId, {
				token,
				fetcher,
			});
			const outDir = join(input.cwd, assetsDir);
			const downloadedImages = [
				...(await downloadFigmaImageFills(rootNode, outDir, {
					publicPath: assetsDir,
					fetcher,
				})),
				...(await downloadFigmaNodeExports(rootNode, outDir, {
					publicPath: assetsDir,
					fetcher,
				})),
			];

			return {
				html: compileHtmlFragment(rootNode),
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
