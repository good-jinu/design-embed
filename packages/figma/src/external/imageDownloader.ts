import { mkdirSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import type { FigmaNode } from "../types.ts";
import type { FigmaFetcher } from "./figmaApi.ts";
import {
	fetchWithRetry,
	mapWithConcurrency,
	type RetryOptions,
} from "./httpClient.ts";

/** Default cap on simultaneous asset downloads to avoid CDN throttling. */
const DEFAULT_DOWNLOAD_CONCURRENCY = 6;

export interface DownloadFigmaImagesOptions {
	fetcher?: FigmaFetcher;
	publicPath?: string;
	/** Max simultaneous downloads (default 6). */
	concurrency?: number;
	/** Retry/backoff behavior for rate limits and transient server errors. */
	retry?: Omit<RetryOptions, "fetcher">;
}

export interface DownloadedFigmaImage {
	imageRef: string;
	sourceUrl: string;
	filePath: string;
	publicPath: string;
}

interface ImageFillTarget {
	imageRef: string;
	imageUrl: string;
	fills: NonNullable<FigmaNode["fills"]>;
	fillIndex: number;
}

export async function downloadFigmaImageFills(
	rootNode: FigmaNode,
	outDir: string,
	options: DownloadFigmaImagesOptions = {},
): Promise<DownloadedFigmaImage[]> {
	const targets = collectImageFillTargets(rootNode);
	const uniqueTargets = Array.from(
		new Map(targets.map((target) => [target.imageRef, target])).values(),
	);

	if (uniqueTargets.length === 0) return [];

	mkdirSync(outDir, { recursive: true });

	const downloadedImages = await mapWithConcurrency(
		uniqueTargets,
		options.concurrency ?? DEFAULT_DOWNLOAD_CONCURRENCY,
		(target) => downloadImageFill(target, outDir, options),
	);
	const publicPathByRef = new Map(
		downloadedImages.map((image) => [image.imageRef, image.publicPath]),
	);

	for (const target of targets) {
		const fill = target.fills[target.fillIndex];
		if (fill) {
			fill.imageLocalPath = publicPathByRef.get(target.imageRef);
		}
	}

	return downloadedImages;
}

function collectImageFillTargets(node: FigmaNode): ImageFillTarget[] {
	const targets: ImageFillTarget[] = [];

	node.fills?.forEach((fill, fillIndex, fills) => {
		if (fill.type === "IMAGE" && fill.imageRef && fill.imageUrl) {
			targets.push({
				imageRef: fill.imageRef,
				imageUrl: fill.imageUrl,
				fills,
				fillIndex,
			});
		}
	});

	for (const child of node.children || []) {
		targets.push(...collectImageFillTargets(child));
	}

	return targets;
}

async function downloadImageFill(
	target: ImageFillTarget,
	outDir: string,
	options: DownloadFigmaImagesOptions,
): Promise<DownloadedFigmaImage> {
	return downloadImage(target.imageRef, target.imageUrl, outDir, options);
}

/**
 * Downloads SVG exports attached to nodes via `exportUrl` and records their
 * public paths on the nodes (`exportLocalPath`).
 */
export async function downloadFigmaNodeExports(
	rootNode: FigmaNode,
	outDir: string,
	options: DownloadFigmaImagesOptions = {},
): Promise<DownloadedFigmaImage[]> {
	const targets = collectNodeExportTargets(rootNode);
	if (targets.length === 0) return [];

	mkdirSync(outDir, { recursive: true });

	const downloadedImages = await mapWithConcurrency(
		targets,
		options.concurrency ?? DEFAULT_DOWNLOAD_CONCURRENCY,
		async (node) => {
			const image = await downloadImage(
				node.id || "export",
				node.exportUrl as string,
				outDir,
				options,
			);
			node.exportLocalPath = image.publicPath;
			return image;
		},
	);

	return downloadedImages;
}

function collectNodeExportTargets(node: FigmaNode): FigmaNode[] {
	const targets: FigmaNode[] = [];
	if (node.exportUrl) targets.push(node);
	for (const child of node.children || []) {
		targets.push(...collectNodeExportTargets(child));
	}
	return targets;
}

async function downloadImage(
	ref: string,
	url: string,
	outDir: string,
	options: DownloadFigmaImagesOptions,
): Promise<DownloadedFigmaImage> {
	const response = await fetchWithRetry(url, undefined, {
		fetcher: options.fetcher,
		...options.retry,
	});

	if (!response.ok) {
		throw new Error(
			`Figma image download failed for ${ref}: ${response.status} ${response.statusText}`,
		);
	}

	const extension = extensionFromResponse(response, url);
	const filename = `${sanitizeFilename(ref)}.${extension}`;
	const filePath = join(outDir, filename);
	const publicPath = posix.join(options.publicPath || outDir, filename);

	writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));

	return {
		imageRef: ref,
		sourceUrl: url,
		filePath,
		publicPath,
	};
}

function extensionFromResponse(response: Response, url: string): string {
	const contentType = response.headers.get("content-type")?.split(";")[0];
	switch (contentType) {
		case "image/jpeg":
			return "jpg";
		case "image/png":
			return "png";
		case "image/svg+xml":
			return "svg";
		case "image/webp":
			return "webp";
		case "image/gif":
			return "gif";
	}

	const pathname = safeUrlPathname(url);
	const extension = pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
	return extension || "img";
}

function safeUrlPathname(url: string): string {
	try {
		return new URL(url).pathname;
	} catch {
		return url;
	}
}

function sanitizeFilename(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}
