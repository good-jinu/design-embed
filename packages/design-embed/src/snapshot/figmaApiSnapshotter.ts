import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
	DesignSnapshotter,
	SnapshotInput,
	SnapshotResult,
} from "../core/types.ts";

interface FigmaSourceMeta {
	fileId: string;
	nodeId: string;
	viewName: string;
}

export class FigmaApiSnapshotter implements DesignSnapshotter {
	private readonly figmaToken: string;

	constructor(figmaToken: string) {
		this.figmaToken = figmaToken;
	}

	async capture(input: SnapshotInput): Promise<SnapshotResult> {
		const { config, source } = input;
		const { fileId, nodeId, viewName } =
			source.meta as unknown as FigmaSourceMeta;

		const url = new URL(`https://api.figma.com/v1/images/${fileId}`);
		url.searchParams.set("ids", nodeId);
		url.searchParams.set("format", config.format ?? "png");
		url.searchParams.set("scale", String(config.scale ?? 1));

		const res = await fetch(url.toString(), {
			headers: { "X-Figma-Token": this.figmaToken },
		});

		if (!res.ok) {
			throw new Error(
				`Figma images API error: ${res.status} ${res.statusText}`,
			);
		}

		const body = (await res.json()) as { images: Record<string, string> };
		const imageUrl = body.images[nodeId];
		if (!imageUrl) {
			throw new Error(`Figma returned no image for node ${nodeId}`);
		}

		const imgRes = await fetch(imageUrl);
		const buffer = Buffer.from(await imgRes.arrayBuffer());

		const filePath = join(
			config.dir ?? ".",
			`${viewName}.${config.format ?? "png"}`,
		);
		mkdirSync(dirname(filePath), { recursive: true });
		writeFileSync(filePath, buffer);

		return { filePath, width: 0, height: 0 };
	}
}
