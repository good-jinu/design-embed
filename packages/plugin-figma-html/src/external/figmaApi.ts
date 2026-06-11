import type { ExtractedParams, FigmaNode } from "../types.ts";

interface FigmaFileResponse {
	document?: FigmaNode;
	nodes?: Record<string, { document?: FigmaNode }>;
}

interface FigmaImageFillsResponse {
	meta?: { images?: Record<string, string | null> };
}

interface FigmaImageRenderResponse {
	err?: string | null;
	images?: Record<string, string | null>;
}

export type FigmaApiResponse = unknown;

export type FigmaFetcher = (
	input: string,
	init?: RequestInit,
) => Promise<Response>;

export interface FigmaClientOptions {
	token: string;
	fetcher?: FigmaFetcher;
}

export function extractParamsFromURL(input: string): ExtractedParams {
	const cleanInput = input.trim();
	const fileKeyPattern = /figma\.com\/(?:file|design)\/([^/]+)/;
	const fileKeyMatch = cleanInput.match(fileKeyPattern);
	const fileKey = fileKeyMatch?.[1] || cleanInput;

	let nodeId: string | null = null;
	try {
		if (cleanInput.includes("figma.com")) {
			const url = new URL(cleanInput);
			const rawNodeId = url.searchParams.get("node-id");
			if (rawNodeId) {
				nodeId = rawNodeId.replace(/-/g, ":");
			}
		}
	} catch {
		// Treat non-URL input as a raw Figma file key.
	}

	return { fileKey, nodeId };
}

export async function fetchFigmaNode(
	fileKey: string,
	nodeId: string | null,
	options: FigmaClientOptions,
): Promise<FigmaNode> {
	const data = (await fetchFigmaApiResponse(
		fileKey,
		nodeId,
		options,
	)) as FigmaFileResponse;
	const rootNode = nodeId ? data.nodes?.[nodeId]?.document : data.document;

	if (!rootNode) {
		throw new Error(`Could not find valid element tree for Node ID: ${nodeId}`);
	}

	const imageFills = await fetchFigmaImageFills(fileKey, options);
	attachImageFillUrls(rootNode, imageFills);

	const exportNodes = collectVectorExportNodes(rootNode);
	if (exportNodes.length > 0) {
		const renderUrls = await fetchFigmaNodeRenderUrls(
			fileKey,
			exportNodes.map((node) => node.id).filter((id): id is string => !!id),
			options,
		);
		for (const node of exportNodes) {
			if (node.id && renderUrls[node.id]) {
				node.exportUrl = renderUrls[node.id];
			}
		}
	}

	return rootNode;
}

const VECTOR_NODE_TYPES = new Set([
	"VECTOR",
	"BOOLEAN_OPERATION",
	"LINE",
	"ELLIPSE",
	"REGULAR_POLYGON",
	"STAR",
]);

/**
 * Finds the topmost subtrees made up entirely of vector shapes (icons,
 * illustrations). Rendering those as per-node divs loses the path data, so
 * they are exported as a single SVG image instead.
 */
export function collectVectorExportNodes(rootNode: FigmaNode): FigmaNode[] {
	const exportNodes: FigmaNode[] = [];

	const walk = (node: FigmaNode): void => {
		if (node.visible === false) return;
		if (isVectorOnlySubtree(node)) {
			exportNodes.push(node);
			return;
		}
		for (const child of node.children || []) {
			walk(child);
		}
	};

	walk(rootNode);
	return exportNodes;
}

function isVectorOnlySubtree(node: FigmaNode): boolean {
	if (node.visible === false) return true;
	if (VECTOR_NODE_TYPES.has(node.type || "")) return true;
	if (node.type === "TEXT") return false;
	if (node.fills?.some((fill) => fill.type === "IMAGE")) return false;
	if (!node.children?.length) return false;
	return node.children.every(isVectorOnlySubtree);
}

export async function fetchFigmaNodeRenderUrls(
	fileKey: string,
	nodeIds: string[],
	options: FigmaClientOptions,
): Promise<Record<string, string>> {
	const fetcher = options.fetcher ?? fetch;
	const renderUrls: Record<string, string> = {};

	const chunkSize = 100;
	for (let index = 0; index < nodeIds.length; index += chunkSize) {
		const chunk = nodeIds.slice(index, index + chunkSize);
		const endpoint = buildFigmaImageRenderEndpoint(fileKey, chunk);
		const response = await fetcher(endpoint, {
			method: "GET",
			headers: { "X-Figma-Token": options.token },
		});

		if (!response.ok) {
			throw new Error(
				`Figma image render API Error: ${response.status} ${response.statusText}`,
			);
		}

		const data = (await response.json()) as FigmaImageRenderResponse;
		for (const [id, url] of Object.entries(data.images || {})) {
			if (typeof url === "string") renderUrls[id] = url;
		}
	}

	return renderUrls;
}

export function buildFigmaImageRenderEndpoint(
	fileKey: string,
	nodeIds: string[],
): string {
	return `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(nodeIds.join(","))}&format=svg`;
}

export async function fetchFigmaApiResponse(
	fileKey: string,
	nodeId: string | null,
	options: FigmaClientOptions,
): Promise<FigmaApiResponse> {
	const endpoint = buildFigmaNodeEndpoint(fileKey, nodeId);
	const fetcher = options.fetcher ?? fetch;
	const response = await fetcher(endpoint, {
		method: "GET",
		headers: { "X-Figma-Token": options.token },
	});

	if (!response.ok) {
		throw new Error(
			`Figma API Error: ${response.status} ${response.statusText}`,
		);
	}

	return response.json();
}

export function buildFigmaNodeEndpoint(
	fileKey: string,
	nodeId: string | null,
): string {
	if (!nodeId) {
		return `https://api.figma.com/v1/files/${fileKey}?depth=2`;
	}

	return `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`;
}

export async function fetchFigmaImageFills(
	fileKey: string,
	options: FigmaClientOptions,
): Promise<Record<string, string>> {
	const endpoint = buildFigmaImageFillsEndpoint(fileKey);
	const fetcher = options.fetcher ?? fetch;
	const response = await fetcher(endpoint, {
		method: "GET",
		headers: { "X-Figma-Token": options.token },
	});

	if (!response.ok) {
		throw new Error(
			`Figma image fills API Error: ${response.status} ${response.statusText}`,
		);
	}

	const data = (await response.json()) as FigmaImageFillsResponse;
	return Object.fromEntries(
		Object.entries(data.meta?.images || {}).filter(
			(entry): entry is [string, string] => typeof entry[1] === "string",
		),
	);
}

export function buildFigmaImageFillsEndpoint(fileKey: string): string {
	return `https://api.figma.com/v1/files/${fileKey}/images`;
}

function attachImageFillUrls(
	node: FigmaNode,
	imageFills: Record<string, string>,
): void {
	for (const fill of node.fills || []) {
		if (fill.type === "IMAGE" && fill.imageRef) {
			fill.imageUrl = imageFills[fill.imageRef];
		}
	}

	for (const child of node.children || []) {
		attachImageFillUrls(child, imageFills);
	}
}
