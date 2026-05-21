import type { ExtractedParams, FigmaNode } from "../types.ts";

interface FigmaFileResponse {
	document?: FigmaNode;
	nodes?: Record<string, { document?: FigmaNode }>;
}

interface FigmaImageFillsResponse {
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

	return rootNode;
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
		Object.entries(data.images || {}).filter(
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
