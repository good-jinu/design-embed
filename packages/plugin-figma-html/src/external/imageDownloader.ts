import { mkdirSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import type { FigmaNode } from "../types.ts";
import type { FigmaFetcher } from "./figmaApi.ts";

export interface DownloadFigmaImagesOptions {
	fetcher?: FigmaFetcher;
	publicPath?: string;
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

	const downloadedImages = await Promise.all(
		uniqueTargets.map((target) => downloadImageFill(target, outDir, options)),
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
	const fetcher = options.fetcher ?? fetch;
	const response = await fetcher(target.imageUrl);

	if (!response.ok) {
		throw new Error(
			`Figma image download failed for ${target.imageRef}: ${response.status} ${response.statusText}`,
		);
	}

	const extension = extensionFromResponse(response, target.imageUrl);
	const filename = `${sanitizeFilename(target.imageRef)}.${extension}`;
	const filePath = join(outDir, filename);
	const publicPath = posix.join(options.publicPath || outDir, filename);

	writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));

	return {
		imageRef: target.imageRef,
		sourceUrl: target.imageUrl,
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
