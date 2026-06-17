import { mkdirSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import type { FigmaNode } from "@design-embed/figma";
import { renderNodesToSVG, type SceneGraph } from "@open-pencil/core";

export interface ExportAssetsOptions {
	/** Public path prefix recorded on nodes for the emitted HTML (e.g. "assets"). */
	publicPath?: string;
}

export interface ExportedAsset {
	/** File written on disk (absolute or relative to cwd). */
	filePath: string;
	/** Path recorded on the node/fill for the emitted HTML. */
	publicPath: string;
}

/**
 * Writes every exportable asset reachable from `rootNode` into `outDir` and
 * records its public path on the owning node/fill so the HTML compiler emits a
 * correct `src`/`background-image`:
 *
 * - IMAGE fills are written from the scene graph's embedded image bytes.
 * - Topmost vector-only subtrees are rendered to a single SVG each.
 */
export function exportAssets(
	graph: SceneGraph,
	pageId: string,
	rootNode: FigmaNode,
	outDir: string,
	options: ExportAssetsOptions = {},
): ExportedAsset[] {
	const written: ExportedAsset[] = [];
	exportImageFills(graph, rootNode, outDir, options, written);
	exportVectorSubtrees(graph, pageId, rootNode, outDir, options, written);
	return written;
}

function exportImageFills(
	graph: SceneGraph,
	node: FigmaNode,
	outDir: string,
	options: ExportAssetsOptions,
	written: ExportedAsset[],
): void {
	for (const fill of node.fills ?? []) {
		if (fill.type !== "IMAGE" || !fill.imageRef) continue;
		const bytes = graph.images.get(fill.imageRef);
		if (!bytes) continue;
		const filename = `${sanitize(fill.imageRef)}.${detectImageExtension(bytes)}`;
		fill.imageLocalPath = write(outDir, filename, bytes, options, written);
	}
	for (const child of node.children ?? []) {
		exportImageFills(graph, child, outDir, options, written);
	}
}

function exportVectorSubtrees(
	graph: SceneGraph,
	pageId: string,
	rootNode: FigmaNode,
	outDir: string,
	options: ExportAssetsOptions,
	written: ExportedAsset[],
): void {
	for (const node of collectVectorExportNodes(rootNode)) {
		if (!node.id) continue;
		const svg = renderNodesToSVG(graph, pageId, [node.id]);
		if (!svg) continue;
		const filename = `${sanitize(node.id)}.svg`;
		node.exportLocalPath = write(
			outDir,
			filename,
			Buffer.from(svg, "utf-8"),
			options,
			written,
		);
	}
}

const VECTOR_NODE_TYPES = new Set([
	"VECTOR",
	"BOOLEAN_OPERATION",
	"LINE",
	"ELLIPSE",
	"POLYGON",
	"STAR",
]);

/**
 * Finds the topmost subtrees made up entirely of vector shapes (icons,
 * illustrations). Rendering those as per-node divs loses the path data, so they
 * are exported as a single SVG image instead.
 */
export function collectVectorExportNodes(rootNode: FigmaNode): FigmaNode[] {
	const exportNodes: FigmaNode[] = [];

	const walk = (node: FigmaNode): void => {
		if (node.visible === false) return;
		if (isVectorOnlySubtree(node)) {
			exportNodes.push(node);
			return;
		}
		for (const child of node.children ?? []) {
			walk(child);
		}
	};

	walk(rootNode);
	return exportNodes;
}

function isVectorOnlySubtree(node: FigmaNode): boolean {
	if (node.visible === false) return true;
	if (VECTOR_NODE_TYPES.has(node.type ?? "")) return true;
	if (node.type === "TEXT") return false;
	if (node.fills?.some((fill) => fill.type === "IMAGE")) return false;
	if (!node.children?.length) return false;
	return node.children.every(isVectorOnlySubtree);
}

function write(
	outDir: string,
	filename: string,
	bytes: Uint8Array,
	options: ExportAssetsOptions,
	written: ExportedAsset[],
): string {
	mkdirSync(outDir, { recursive: true });
	const filePath = join(outDir, filename);
	writeFileSync(filePath, bytes);
	const publicPath = options.publicPath
		? posix.join(options.publicPath, filename)
		: filename;
	written.push({ filePath, publicPath });
	return publicPath;
}

function sanitize(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function detectImageExtension(bytes: Uint8Array): string {
	if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
	if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
	if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";
	// "RIFF" container — WebP.
	if (
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46
	) {
		return "webp";
	}
	// Leading "<" — SVG/XML markup.
	if (bytes[0] === 0x3c) return "svg";
	return "png";
}
