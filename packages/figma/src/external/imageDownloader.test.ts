import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { getNodeStyles } from "../compilers/compilerUtils.ts";
import type { FigmaNode } from "../types.ts";
import { downloadFigmaImageFills } from "./imageDownloader.ts";

describe("downloadFigmaImageFills", () => {
	test("downloads image fills and attaches local paths for compilers", async () => {
		const outDir = mkdtempSync(join(tmpdir(), "figma-images-"));
		const node: FigmaNode = {
			name: "Hero",
			type: "RECTANGLE",
			fills: [
				{
					type: "IMAGE",
					scaleMode: "FILL",
					imageRef: "image/ref",
					imageUrl: "https://example.com/image.png",
				},
			],
		};
		const fetcher = async () =>
			new Response("image-bytes", {
				headers: { "content-type": "image/png" },
			});

		try {
			const downloaded = await downloadFigmaImageFills(node, outDir, {
				fetcher,
				publicPath: "assets",
			});

			assert.equal(downloaded.length, 1);
			assert.equal(downloaded[0]?.publicPath, "assets/image_ref.png");
			assert.equal(
				readFileSync(downloaded[0]?.filePath || "", "utf-8"),
				"image-bytes",
			);
			assert.equal(node.fills?.[0]?.imageLocalPath, "assets/image_ref.png");
			assert.equal(
				getNodeStyles(node).backgroundImage,
				'url("assets/image_ref.png")',
			);
		} finally {
			rmSync(outDir, { recursive: true, force: true });
		}
	});
});
