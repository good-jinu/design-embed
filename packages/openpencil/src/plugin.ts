import { join } from "node:path";
import { compileHtmlFragment } from "@design-embed/figma";
import type {
	SourcePlugin,
	SourcePluginInput,
	SourcePluginResult,
} from "design-embed";
import {
	extractParamsFromPath,
	fetchOpenPencilNode,
} from "./external/openPencilClient.ts";

export interface OpenPencilHtmlPluginOptions {
	/**
	 * Local `.fig` or `.pen` file path, optionally suffixed with `#nodeId`
	 * to compile a specific node (e.g. `./design.pen#12:3`).
	 */
	file: string;
	/** Directory (relative to cwd) to write exported assets into. Default "assets". */
	assetsDir?: string;
}

export class OpenPencilHtmlPlugin implements SourcePlugin {
	readonly name = "openpencil-html";
	private readonly options: OpenPencilHtmlPluginOptions;

	constructor(options: OpenPencilHtmlPluginOptions) {
		this.options = options;
	}

	async run(input: SourcePluginInput): Promise<SourcePluginResult> {
		const { file, assetsDir = "assets" } = this.options;

		if (!file) {
			return {
				diagnostics: [
					{
						code: "OPENPENCIL_FILE_REQUIRED",
						message:
							"openpencil-html requires a `file` path to a local .fig or .pen file.",
						severity: "error",
					},
				],
			};
		}

		try {
			const { fileKey, nodeId } = extractParamsFromPath(file);
			const rootNode = await fetchOpenPencilNode(fileKey, nodeId, {
				outputDir: join(input.cwd, assetsDir),
				publicPath: assetsDir,
			});

			return {
				html: compileHtmlFragment(rootNode),
				meta: {
					fileId: fileKey,
					nodeId,
					viewName: rootNode.name ?? fileKey,
				},
				diagnostics: [],
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				diagnostics: [
					{
						code: "OPENPENCIL_HTML_FAILED",
						message,
						severity: "error",
					},
				],
			};
		}
	}
}
