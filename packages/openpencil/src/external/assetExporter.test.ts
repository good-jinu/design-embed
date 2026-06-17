import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import type { FigmaNode } from "@design-embed/figma";
import type { SceneGraph } from "@open-pencil/core";
import { collectVectorExportNodes, exportAssets } from "./assetExporter.ts";

describe("collectVectorExportNodes", () => {
	test("captures the topmost vector-only subtree and stops descending", () => {
		const root: FigmaNode = {
			id: "0:1",
			type: "FRAME",
			children: [
				{
					id: "1:1",
					type: "GROUP",
					children: [
						{ id: "1:2", type: "VECTOR" },
						{ id: "1:3", type: "ELLIPSE" },
					],
				},
				{ id: "2:1", type: "TEXT", characters: "Label" },
			],
		};

		const exportNodes = collectVectorExportNodes(root);
		assert.equal(exportNodes.length, 1);
		assert.equal(exportNodes[0]?.id, "1:1");
	});

	test("does not export a subtree that contains an image fill", () => {
		const root: FigmaNode = {
			id: "0:1",
			type: "FRAME",
			children: [
				{
					id: "1:1",
					type: "RECTANGLE",
					fills: [{ type: "IMAGE", imageRef: "x" }],
				},
			],
		};
		assert.equal(collectVectorExportNodes(root).length, 0);
	});
});

describe("exportAssets", () => {
	test("writes image-fill bytes and records the public path on the fill", () => {
		const outDir = mkdtempSync(join(tmpdir(), "openpencil-assets-"));
		try {
			const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]);
			const graph = {
				images: new Map<string, Uint8Array>([["hash-1", pngBytes]]),
			} as unknown as SceneGraph;

			const rootNode: FigmaNode = {
				id: "0:1",
				type: "FRAME",
				fills: [{ type: "IMAGE", imageRef: "hash-1" }],
				children: [],
			};

			const written = exportAssets(graph, "page-1", rootNode, outDir, {
				publicPath: "assets",
			});

			assert.equal(written.length, 1);
			assert.equal(rootNode.fills?.[0]?.imageLocalPath, "assets/hash-1.png");
			const onDisk = readFileSync(join(outDir, "hash-1.png"));
			assert.deepEqual(new Uint8Array(onDisk), pngBytes);
		} finally {
			rmSync(outDir, { recursive: true, force: true });
		}
	});

	test("skips image fills whose bytes are missing from the graph", () => {
		const outDir = mkdtempSync(join(tmpdir(), "openpencil-assets-"));
		try {
			const graph = {
				images: new Map<string, Uint8Array>(),
			} as unknown as SceneGraph;
			const rootNode: FigmaNode = {
				id: "0:1",
				type: "FRAME",
				fills: [{ type: "IMAGE", imageRef: "missing" }],
				children: [],
			};

			const written = exportAssets(graph, "page-1", rootNode, outDir, {
				publicPath: "assets",
			});

			assert.equal(written.length, 0);
			assert.equal(rootNode.fills?.[0]?.imageLocalPath, undefined);
		} finally {
			rmSync(outDir, { recursive: true, force: true });
		}
	});
});
