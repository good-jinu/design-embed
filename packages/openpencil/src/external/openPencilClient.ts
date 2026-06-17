import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtractedParams, FigmaNode } from "@design-embed/figma";
import {
	FigmaAPI,
	parseFigFile,
	parsePenFile,
	type SceneGraph,
} from "@open-pencil/core";
import { exportAssets } from "./assetExporter.ts";
import { proxyToDesignNode } from "./sceneToDesignNode.ts";

export interface OpenPencilClientOptions {
	/**
	 * Directory where exported asset files (SVG vectors, image fills) are
	 * written. Defaults to a fresh OS temp directory per call.
	 */
	outputDir?: string;
	/**
	 * Public path prefix recorded on nodes for the emitted HTML (e.g. "assets").
	 * Should match how `outputDir` is served. Defaults to bare filenames.
	 */
	publicPath?: string;
}

/**
 * Parse a local file reference into a file path and optional node ID.
 *
 * Accepted formats:
 *   /path/to/design.fig              -> { fileKey: "/path/to/design.fig", nodeId: null }
 *   /path/to/design.fig#1:23         -> { fileKey: "/path/to/design.fig", nodeId: "1:23" }
 *   design.pen#5:10                  -> { fileKey: "design.pen",           nodeId: "5:10" }
 */
export function extractParamsFromPath(input: string): ExtractedParams {
	const cleanInput = input.trim();
	const hashIndex = cleanInput.lastIndexOf("#");
	if (hashIndex !== -1) {
		return {
			fileKey: cleanInput.slice(0, hashIndex),
			nodeId: cleanInput.slice(hashIndex + 1) || null,
		};
	}
	return { fileKey: cleanInput, nodeId: null };
}

async function loadSceneGraph(filePath: string): Promise<SceneGraph> {
	if (filePath.toLowerCase().endsWith(".pen")) {
		return parsePenFile(readFileSync(filePath, "utf-8"));
	}
	const buffer = readFileSync(filePath);
	const arrayBuffer = buffer.buffer.slice(
		buffer.byteOffset,
		buffer.byteOffset + buffer.byteLength,
	);
	return parseFigFile(arrayBuffer, { populate: "all" });
}

/**
 * Loads a local OpenPencil/Figma file, resolves the requested node (or the
 * current page when no node ID is given), exports its assets into `outputDir`,
 * and returns the normalized {@link FigmaNode} tree ready for the HTML compiler.
 */
export async function fetchOpenPencilNode(
	filePath: string,
	nodeId: string | null,
	options: OpenPencilClientOptions = {},
): Promise<FigmaNode> {
	const graph = await loadSceneGraph(filePath);
	const api = new FigmaAPI(graph);

	const rootProxy = nodeId ? api.getNodeById(nodeId) : api.currentPage;
	if (!rootProxy) {
		throw new Error(`Could not find valid element tree for Node ID: ${nodeId}`);
	}

	const rootNode = proxyToDesignNode(rootProxy);

	const outDir =
		options.outputDir ?? mkdtempSync(join(tmpdir(), "openpencil-"));
	exportAssets(graph, api.currentPageId, rootNode, outDir, {
		publicPath: options.publicPath,
	});

	return rootNode;
}
